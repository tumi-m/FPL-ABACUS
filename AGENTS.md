# GAFFER — agent instructions

FPL analytics app. Next.js 15 App Router, React 19, TS strict, Tailwind v4, drizzle/postgres.js, Vitest + Playwright.

## Design system (read before touching any component)

The v2 "FLOODLIGHT" spec lives in `architecture/`:

1. **`architecture/GAFFER_STYLE_GUIDE.md`** — revision 02, *stadium blue*. **Supersedes §1–§5 of the UI doc; where they disagree, this file wins.** Tokens, skew system, chrome recipes, chart palette rules.
2. `architecture/GAFFER_V2_UI_UPGRADE.md` — §6 charts · §7 Field view · §8 generative visuals · §9 generative interface · §10 Board · §11 IA.
3. `architecture/GAFFER_V2_FEATURES.md` — the 30-feature backlog with build priorities.
4. `architecture/GAFFER_V2_PROMPTS.md` — per-session prompts + the audit prompt to run after each session.
5. `floodlight-styleguide.html` — rendered reference; copy CSS from it.

Non-negotiables: zero raw hex outside `globals.css` · no grey/neutral tokens · skew/gloss/bevel on **chrome only**, never data · every figure italic Saira, every name upright Barlow · fixture heat blue→green never red→green · chart series use the validated 8-slot palette (`#3987e5 #d95926 #199e70 #c98500 #d55181 #008300 #9085e9 #e66767`), never UI accents · one gradient hero figure per screen · `prefers-reduced-motion` genuinely stops everything · estimated numbers wrapped in `<Est>`.

## Commands

- `pnpm lint` / `pnpm typecheck` — must pass before committing
- `pnpm test` — vitest (colocated `*.test.ts` in lib/)
- `pnpm build` — Next production build
- `pnpm e2e` — Playwright (builds + starts first)
- `pnpm db:generate` / `pnpm db:migrate` — drizzle

## Architecture quick facts

- One copy of upstream FPL data serves everyone: all traffic through `lib/fpl/*`, cached in `lib/cache/swr.ts` (single-flight SWR → Upstash Redis REST, MemoryStore fallback).
- Engines are pure functions in `lib/engines/*`; composition happens server-side (`lib/server/buildMatchday.ts`).
- Durable state in Postgres via drizzle (`lib/db/schema.ts`): cohort EO snapshots, price history, GW archives, score distributions.
- Cron endpoints under `/api/cron/*` guarded by `CRON_SECRET` (Vercel sends it automatically). Frequent schedule runs from GitHub Actions `.github/workflows/prod-cron.yml` using repo secrets `PROD_URL` + `CRON_SECRET` (Hobby plan allows only daily Vercel crons).
- Team id persists via cookie `gaffer_team`; theme via localStorage + `data-theme`.
