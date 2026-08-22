# GAFFER

FPL decision-intelligence: not *what* your score is — **why your rank moved, what it costs you next, and what to do about it**.

## Quick start

```bash
pnpm install
cp .env.example .env.local   # all vars optional locally
pnpm dev                     # http://localhost:3000
```

Enter any FPL team ID on `/`. No auth, no paywall.

## Architecture

- **Next.js 15 / React 19 / Tailwind v4**, TypeScript strict.
- **All FPL traffic server-side** (`lib/fpl/*`) behind a single-flight SWR cache (`lib/cache/*`). One upstream request serves unlimited users; falls back to an in-process store without Redis env vars.
- **Domain engines are pure functions** in `lib/engines/*` — bonus tie rules, auto-subs projection, EO, rank curve + derivative, swing attribution, leverage, multiverse, paired Monte Carlo, price pressure, DNA. Each has unit tests against recorded live fixtures (`__fixtures__/`, via `pnpm record`).
- **Charts hand-built in SVG** (`components/charts/*`) on `d3-scale`/`d3-shape` only — no chart library.

## Commands

| Command | What |
|---|---|
| `pnpm dev` / `build` | app |
| `pnpm typecheck` · `lint` · `test` | gates (also enforced by CI) |
| `pnpm db:generate` / `db:migrate` | drizzle schema → SQL / apply to `DATABASE_URL` |
| `pnpm record` | snapshot every FPL endpoint into `__fixtures__/` |
| `pnpm replay` | exact-match gate vs a finished GW (auto-skips until data is final) |
| `pnpm e2e` | Playwright smoke |

## Deploy

All env vars are optional locally; for production:

1. Provision **Postgres** (Neon, or Supabase via its transaction pooler on :6543 — the client sets `prepare: false`) and run `pnpm db:migrate`.
2. Provision **Upstash Redis** (free tier fine) — without it, swing/rank/price state resets on cold starts.
3. On Vercel: set `DATABASE_URL`, `UPSTASH_REDIS_REST_URL/TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`. Crons register from `vercel.json`; Vercel sends the secret as a Bearer header automatically.
4. Note: `/api/cron/cohort` declares `maxDuration = 300` — needs Fluid Compute or Pro, or shrink `TARGET_SAMPLE` in `lib/server/cohortBuilder.ts`.
5. Smoke: hit `/api/cron/warm`, enter a team ID, confirm `/live` composes.

## Data honesty

Every estimated number renders with `~` + method tooltip. With Postgres configured, EO is sampled from real cohorts (labelled with sample size + margin of error); without it, a labelled pre-GW1 prior is used. See `docs/NOTES.md` for verified findings (live-rank probe, schema drift) and open assumptions (BPS constants).

## Environment

All optional for local dev: `DATABASE_URL`, `UPSTASH_REDIS_REST_URL/TOKEN`, `CRON_SECRET`, `FPL_USER_AGENT`, `NEXT_PUBLIC_APP_URL`.
