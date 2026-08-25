# GAFFER

FPL decision-intelligence: not *what* your score is — **why your rank moved, what it costs you next, and what to do about it**.

## Quick start

```bash
pnpm install
cp .env.example .env.local   # all vars optional locally
pnpm dev                     # http://localhost:3000
```

Enter any FPL team ID on `/`. No auth, no paywall.

## The screens

| Route | What it answers |
|---|---|
| `/live` | What is happening to my score and my rank right now |
| `/field` | Where the points, ownership, swing, leverage and risk sit in my XI — plus the market boards: top performers, bonus, DEFCON |
| `/planner` | **Who should I bring in** — pitch + full market, projected over six gameweeks, with the chip lane, the fixture ticker and the price watch |
| `/board` | How kind the fixture run is, per player, over any horizon |
| `/leagues` | Where I stand and what my rivals own |

The Planner is the only place transfers are staged: rules in
`lib/engines/planner.ts` (pure, unit-tested), composition in
`lib/server/buildPlanner.ts`, UI in `components/gaffer/planner/*`. Plans live in
the browser under `gaffer_board_v2_{teamId}` — nothing is ever written back to
your real FPL team.

## Architecture

- **Next.js 15 / React 19 / Tailwind v4**, TypeScript strict.
- **All FPL traffic server-side** (`lib/fpl/*`) behind a single-flight SWR cache (`lib/cache/*`). One upstream request serves unlimited users; falls back to an in-process store without Redis env vars.
- **Domain engines are pure functions** in `lib/engines/*` — bonus tie rules, auto-subs projection, EO, rank curve + derivative, swing attribution, leverage, multiverse, paired Monte Carlo, price pressure, DNA. Each has unit tests against recorded live fixtures (`__fixtures__/`, via `pnpm record`).
- **Charts hand-built in SVG** (`components/charts/*`) on `d3-scale`/`d3-shape` only — no chart library.
- **Fonts self-hosted** via `next/font` (`config/fonts.ts`); no third-party stylesheet on the critical path.
- **The shell never awaits upstream**: FPL-backed header fragments stream in behind Suspense (`components/gaffer/HeaderStatus.tsx`) and every heavy route ships a `loading.tsx`, so a slow FPL costs a pill, not the page.

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
3. On Vercel: set `DATABASE_URL`, `UPSTASH_REDIS_REST_URL/TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`. Only the once-daily finalise cron registers on Vercel (Hobby allows daily only).
4. **High-frequency crons run from GitHub Actions** (`.github/workflows/prod-cron.yml`, every 5 min). Add two repository secrets: `PROD_URL` (your deployment URL) and `CRON_SECRET` — the workflow skips itself until they exist.
5. The cohort builder is resumable: each invocation does ≤20s of upstream work and continues across ticks, so it fits Hobby's function limits.
6. Smoke: hit `/api/cron/warm`, enter a team ID, confirm `/live` composes.

## Data honesty

Every estimated number renders with `~` + method tooltip. With Postgres configured, EO is sampled from real cohorts (labelled with sample size + margin of error); without it, a labelled pre-GW1 prior is used. See `docs/NOTES.md` for verified findings (live-rank probe, schema drift) and open assumptions (BPS constants).

## Environment

All optional for local dev: `DATABASE_URL`, `UPSTASH_REDIS_REST_URL/TOKEN`, `CRON_SECRET`, `FPL_USER_AGENT`, `NEXT_PUBLIC_APP_URL`.

`FPL_API_BASE` overrides the upstream base URL — point it at a local mirror to
develop without hitting the real API. Leave it unset in production.
