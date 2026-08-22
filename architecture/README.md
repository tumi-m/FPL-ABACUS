# GAFFER — Architecture & Why We Chose This Stack

This document explains the production setup: what each moving part is for,
why that specific tool was chosen over alternatives, and why the go-live
steps happen in the order they do.

---

## 1. The system in one picture

```
                        ┌────────────────────────────── Vercel ─────────────────────────────┐
   Browser ── HTTPS ──▶ │  Next.js 15 app (RSC + client polling)                            │
                        │    │                                                              │
                        │    ├─ lib/fpl/*      all FPL traffic, server-side only            │
                        │    ├─ lib/cache/*    single-flight SWR cache ◀── Upstash Redis    │
                        │    │                 (MemoryStore fallback without Redis env)     │
                        │    ├─ lib/engines/*  pure domain logic (bonus, EO, rank, swing…)  │
                        │    └─ lib/db/*       drizzle client ──────────────▶ Neon/Supabase │
                        │                                                                   │
                        │  Cron scheduler (vercel.json) ── Bearer CRON_SECRET ──▶ /api/cron/*│
                        └───────────────────────────────────────────────────────────────────┘
                                             │                                  │
                                             ▼                                  ▼
                                   fantasy.premierleague.com          Postgres (durable state)
```

Core principle: **one copy of upstream data serves everyone.** Ten thousand
users hitting `/live` produce at most a handful of requests to the official
FPL API per minute. Everything else reads from cache or precomputed models.

---

## 2. Why each tool

### Next.js on Vercel
The product is server-rendered React with per-gameweek dynamic pages and
background jobs. Vercel hosts Next natively, registers cron schedules straight
from `vercel.json`, and automatically attaches `Authorization: Bearer
CRON_SECRET` when its scheduler calls our endpoints — which is exactly what
`lib/server/cronGuard.ts` expects.

### Postgres — Neon or Supabase (`DATABASE_URL`)
Durable state the cache can't hold: sampled cohort EO snapshots, hourly price
history, finished-GW archives, score distributions (`lib/db/schema.ts`).

- **Neon**: serverless Postgres, generous free tier, pooled connection strings.
- **Supabase**: equally valid; use its **transaction pooler URL (port 6543)**.

Both are supported because we deliberately did **not** take Neon's HTTP-only
driver. Instead:

### postgres.js + Drizzle (`lib/db/index.ts`, `drizzle.config.ts`)
- **postgres.js** is a plain TCP driver that works against *any* Postgres —
  Neon TCP, Supabase pooler, or local Docker. One code path, no vendor lock-in.
- `prepare: false` is set because transaction-mode poolers (pgbouncer) can't
  reuse prepared statements across connections. Without it, Supabase pooled
  URLs fail intermittently.
- **Drizzle** gives us the schema as typed TypeScript, generates plain SQL
  migrations offline (`pnpm db:generate`), and needs no codegen step or
  runtime daemon. The migration was validated against real pg16 before deploy
  (upsert idempotency, composite PKs, quoted reserved words like `"from"`).

### Upstash Redis (`UPSTASH_REDIS_REST_URL/TOKEN`)
Serverless functions die constantly. Three things must outlive a single
invocation:

1. **SWR cache entries** (`lib/cache/swr.ts`) so warm data survives cold starts.
2. **Single-flight locks** so concurrent users don't stampede the FPL API.
3. **Swing/rank/price accumulators** (`lib/server/swingStore.ts`) built by
   polling diffs — losing them means re-deriving match history from scratch.

Upstash is Redis exposed as REST over HTTPS, which is precisely what fits
serverless (no TCP connection pooling problems). The free tier is enough.

**Without Redis** nothing breaks: an in-process MemoryStore takes over
(identical single-flight semantics within one instance), but state resets on
every cold start and isn't shared between instances.

### CRON_SECRET
`/api/cron/*` endpoints trigger expensive work — a cohort sweep fetches ~24
standings pages plus up to 2,000 picks payloads. Left unguarded, anyone who
discovers the deployment URL could hammer them and burn the FPL API quota we
all depend on. The secret is just an unguessable password:

- You generate it once (`openssl rand -hex 32`) and paste it into Vercel.
- Vercel's scheduler sends it as `Authorization: Bearer <secret>` automatically.
- `cronGuard` compares and rejects strangers with 401.
- No secret configured → guard lets traffic through (dev convenience) but logs
  a loud warning in production.

---

## 3. Why the go-live steps in that order

| Step | Why here |
|---|---|
| 1. Create Postgres, run `pnpm db:migrate` | Tables must exist before the first cohort/price cron fires, otherwise the first writes fail. Migrating locally first also proves the connection string works before anything is deployed. |
| 2. Upstash Redis | Must be in place before real traffic so swing accumulation starts at kickoff, not after the first redeploy wipes state. |
| 3. Generate `CRON_SECRET` | Needed as an input for step 4's env vars. Nothing else uses it — it travels only between Vercel's scheduler and your own API routes. |
| 4. Deploy with all env vars | Env vars are baked per-deployment; setting them before the first deploy avoids a wasted build and guarantees crons are authenticated from run #1. |
| 5. Check cron duration | The cohort sweep declares `maxDuration = 300`. On Hobby hardware it may exceed the limit — better to discover this from the Crons tab than from silent missing data later. |
| 6. Smoke test in dependency order | Warm endpoint first (proves auth + cache + FPL reachability), then browser flow (proves RSC + gate cookie), then DB tables filling (proves end-to-end persistence). Each check depends on the previous passing. |

---

## 4. What degrades gracefully when something is missing

| Missing piece | Behaviour |
|---|---|
| `DATABASE_URL` | Crons no-op explicitly (`skipped:"no-database-configured"`); EO falls back to the labelled estimated prior; UI shows "~estimated EO" instead of sampled-n label. |
| Upstash Redis | MemoryStore fallback; single-flight still works per instance; swing/rank/price state resets on cold start. |
| `CRON_SECRET` | Crons still function but are unauthenticated; production logs warn loudly on every boot. |
| Cohort snapshot not yet built | Matchday model prices swings/leverage with the estimated prior until the builder lands the first snapshot for the gameweek. |

Nothing above requires a redeploy to recover — provide the env var and let the
next cron tick fill the gap.
