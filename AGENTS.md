# GAFFER — agent instructions

FPL analytics app. Next.js 15 App Router, React 19, TS strict, Tailwind v4, drizzle/postgres.js, Vitest + Playwright.

**Current work:** v9 — resume from `docs/GAFFER_V9_PLAN.md`. The design system is still v2 FLOODLIGHT (`docs/GAFFER_V2_PLAN.md` for the locked decisions).

## Design system (read before touching any component)

The v2 "FLOODLIGHT" spec lives in `architecture/`:

1. **`architecture/GAFFER_STYLE_GUIDE.md`** — revision 02, *stadium blue*. **Supersedes §1–§5 of the UI doc; where they disagree, this file wins.** Tokens, skew system, chrome recipes, chart palette rules.
2. `architecture/GAFFER_V2_UI_UPGRADE.md` — §6 charts · §7 Field view · §8 generative visuals · §9 generative interface · §10 Board · §11 IA.
3. `architecture/GAFFER_V2_FEATURES.md` — the 30-feature backlog with build priorities.
4. `architecture/GAFFER_V2_PROMPTS.md` — per-session prompts + the audit prompt to run after each session.
5. `floodlight-styleguide.html` — rendered reference; copy CSS from it.

Non-negotiables: zero raw hex outside `globals.css` (sole exception: `config/brand.ts` themeColor for the meta tag) · no grey/neutral tokens · skew/gloss/bevel on **chrome only**, never data · every figure italic Saira, every name upright Barlow · fixture heat blue→green never red→green · chart series use the validated 8-slot palette (`#3987e5 #d95926 #199e70 #c98500 #d55181 #008300 #9085e9 #e66767`), never UI accents · one gradient hero figure per screen · `prefers-reduced-motion` genuinely stops everything · estimated numbers wrapped in `<Est>`.

## Commands

- `pnpm lint` / `pnpm typecheck` — must pass before committing
- `pnpm test` — vitest (colocated `*.test.ts` in lib/)
- `pnpm build` — Next production build
- `pnpm e2e` — Playwright (builds + starts first)
- `pnpm db:generate` / `pnpm db:migrate` — drizzle

## Architecture quick facts

- One copy of upstream FPL data serves everyone: all traffic through `lib/fpl/*`, cached in `lib/cache/swr.ts` (single-flight SWR → Upstash Redis REST, MemoryStore fallback).
- Engines are pure functions in `lib/engines/*`; composition happens server-side (`lib/server/buildMatchday.ts`).
- Durable state in Postgres via drizzle (`lib/db/schema.ts`): cohort EO snapshots, price history, GW archives, score distributions. **Every read goes through `dbRead` (`lib/db/read.ts`)** — stored data is always an enhancement, so a missing schema or a failing query returns empty rather than throwing. `hasDb` is not a sufficient guard on its own: it says a database is configured, not migrated.
- Never stream a raw error message to the client. The cause goes to the server log; the user gets a sentence.
- Cron endpoints under `/api/cron/*` guarded by `CRON_SECRET` (Vercel sends it automatically). Frequent schedule runs from GitHub Actions `.github/workflows/prod-cron.yml` using repo secrets `PROD_URL` + `CRON_SECRET` (Hobby plan allows only daily Vercel crons).
- Team id persists via cookie `gaffer_team`; theme via localStorage + `data-theme`.
- **One transfer desk.** `/planner` is the only place transfers are staged: rules in `lib/engines/planner.ts` (pure, tested), composition in `lib/server/buildPlanner.ts`, UI in `components/gaffer/planner/*`. Plans persist per team under `gaffer_board_v2_{teamId}` via `lib/engines/boardPlans.ts`. The Board and the Field link to it; neither stages moves itself.
- Fonts are self-hosted through `next/font` (`config/fonts.ts`) — never add a `<link>` to fonts.googleapis.com.
- Shell chrome must not await upstream: FPL-backed header fragments live in `components/gaffer/HeaderStatus.tsx` behind Suspense, and every heavy route carries a `loading.tsx`.
- `FPL_API_BASE` overrides the upstream base URL for local development against a mirror; production leaves it unset.
