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
| `pnpm typecheck` · `lint` · `test` | gates |
| `pnpm record` | snapshot every FPL endpoint into `__fixtures__/` |
| `pnpm replay` | exact-match gate vs a finished GW (auto-skips until data is final) |
| `pnpm e2e` | Playwright smoke |

## Data honesty

Every estimated number renders with `~` + method tooltip. Cohort EO currently uses the labelled pre-GW1 fallback; cohort sampling activates with Postgres wiring. See `docs/NOTES.md` for verified findings (live-rank probe, schema drift) and open assumptions (BPS constants).

## Environment

All optional for local dev: `DATABASE_URL`, `UPSTASH_REDIS_REST_URL/TOKEN`, `CRON_SECRET`, `FPL_USER_AGENT`, `NEXT_PUBLIC_APP_URL`.
