# GAFFER — Implementation Plan: features-first to public launch

> Owner directives: **features first**, **Manifold now** (Python escape hatch approved),
> **public-launch bar** (not hobby). One commit per phase, push to `main` immediately.
> Gates every phase: `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` · `pnpm e2e`.
> Design non-negotiables (`AGENTS.md` + `GAFFER_STYLE_GUIDE.md` rev-02): zero raw hex
> outside `globals.css` (except `config/brand.ts` themeColor), no grey tokens, chrome-only
> skew/gloss/bevel, Saira-italic figures / Barlow-upright names, blue→green heat, 8-slot
> chart palette, one hero figure/screen, `prefers-reduced-motion` kills everything,
> `<Est>` on every estimate.

## Where we are

- v2 A–G, E½, v3 Q0–Q3 + Q5-core + Q6 + Q7, v4 A–F (minus Manifold), v5, v6, v7,
  v8 A–N, v9 A–C all landed. ~313 vitest, ~74 e2e.
- v3 engines are **pure-TS and tested** but mostly **ask-card-only** — full UI surfaces
  are still v4 scope (`GAFFER_V4_SCREEN_SPECS.md`).
- Sole deferred v3 engine: **17 Manifold** (needs Python UMAP/HDBSCAN cron).
- Known migrations on disk: `0000,0001,0002,0003,0004,0005,0007` — **`0006` is missing**
  (journal jumps 0005→0007). Prod still needs `db:migrate` for 0005 (`entry_directory`)
  and 0007 (twin `match_id` composite PK).

---

## Phase F0 — unblock features (0.5 day, do first even though "features first")

Features can't ship on a broken migration chain. Smallest possible unblocker.

1. Fix drizzle journal gap: inspect `drizzle/meta/_journal.json` + `drizzle/meta/*snapshot.json`;
   either regenerate the missing `0006_*.sql` via `pnpm db:generate` from current
   `lib/db/schema.ts`, or squash/rename 0007→0006 if 0006 was never applied to prod.
   Decide by checking prod `__drizzle_migrations` table first — never guess.
2. Run `pnpm db:migrate` against staging, then prod (0005 + 0006/0007). Verify twin card
   and gate name-search return rows instead of honest-null.
3. Rotate the leaked Ollama key (`GAFFER_V2_PLAN.md` locked-decisions warning) and
   unify env naming: code uses `OLLAMA_*` (`lib/ai/client.ts`), spec says `LLM_*`.
   Pick one set, support the other as deprecated alias with a startup warning, update
   `.env.example`, Vercel, and GitHub secrets.
4. Gates: migrate clean on fresh pg16 + prod; `pnpm build` ok.

## Phase F1 — V2 weekday gaps (highest acquisition value, ~2 days)

Ship in this order; each is a small vertical slice (engine → resolver/card → route section → e2e):

1. **Deadline EO predictor (V2-17):** velocity from `price_snapshot` + news-tag spikes +
   time-decay to deadline, with confidence band. Reuse `lib/engines/price.ts` patterns.
   Surface: Board second section + watchlist sort. Grey out with reason when coverage thin.
2. **Transfer sim variance readout (V2-15):** combine `solverLite` xP/EO deltas with
   `simulate`/`multiverse` σ into one `xP / EO exposure / σ` card on the desk.
3. **Blank/double auto-suggest (V2-14):** `computeGwProfiles` already feeds badges/footer —
   add chip-window suggestion engine (FH/BB/TC windows) + Ask intent.
4. **Minutes/rotation (V2-18):** surface Cox `P(start)/P(60+)` from `lib/quant/estimators.ts`
   on PeekSheet + Board OUT rows as probabilities, not flags.
5. **Set-piece hierarchy (V2-20) + card/suspension watch (V2-21):** columns on player
   explorer + PeekSheet rows; ban-threshold GW labels from fixture list.
6. Tests: colocated `*.test.ts` per engine helper; e2e per surface. `<Est>` wrap + audit prompt.

## Phase F2 — V2 depth/retention ( ~2 days)

1. **Value scatter (V2-22)** with efficient frontier; **5-way radar compare (V2-23)**
   (attack/minutes/fixture/value/bonus + fixture strip + xPts line).
2. **Template drift/DVS (V2-24):** 5-GW overlap direction + for/against bets table.
3. **Captain matrix heat grid (V2-26):** managers×GWs captain club-colour cells + chip lane
   (ChipTimeline exists — extend, don't duplicate).
4. **Watchlist + deadline digest (V2-30):** `localStorage` keyed by team id; drives
   Tonight list, Board section, deadline triage. This is the future push-subscription key —
   schema it that way now.
5. **Ownership momentum (V2-16) + fixture swing finder (V2-25):** stacked area + slope
   chart, reusing validated 8-slot palette (never UI accents).

## Phase F3 — v3 Quant UI surfaces (the differentiator, ~3 days)

Engines done; build the screens the spec already describes (`GAFFER_V3_FEATURES.md`).
Each surface: route or Field/Board section + Ask card reuse + calibration/uncertainty UI
per Honesty rules (intervals, SE/RD/n, grey-outs, observational labels).

1. **Portfolio:** Position style-map (TE × mean active return, iso-IR rays, top-10k cloud),
   Beta scatter (45° ref + residuals), Cone fan (p5–p95, target contours + required rate).
2. **Understanding:** Ledger waterfall (Shapley, efficiency-guaranteed), Process-vs-Outcome
   slope + four luck channels with hold/act advice.
3. **Estimators:** True-Form ribbon (±1.96√P, minutes-sized dots), Role Radar heatmap
   ("4%→61% GW6" callout), Engine-Temp load map + per-row gauge.
4. **Decision:** VaR/CVaR density (worst-5% flare shade), Crossover map (behind×GWs-left),
   Option Snell boundary + optimal GW, Threshold Mon→deadline curve.
5. **Seeing the game:** Strength att×def plane (ellipses + trails), Correlation chord +
   Effective Bets gauge (already partial — promote from card), Crowding small-multiples,
   WPA step-area + scrubber + top-3 moments, Ladder line + RD ribbon.
6. **Committee (V3-21):** visual builder + typed path (never language-only), Prize Board /
   Race / Table / Settlement OG 1200×630, share code + URL fragment, ledger-only money copy.

## Phase M — Manifold, the Python escape hatch (now, ~2 days)

v3-17 spec: Jaccard → UMAP(25, 0.08) → HDBSCAN → lift-player cluster labels; ship ~200KB
coords+labels. Steps:

1. New `python/` service (FastAPI or plain cron script, pinned `requirements.txt`):
   reads cohort squads from Postgres, writes `manifold_coords` table (entry, x, y,
   cluster, template_xi, share, trailing-4). Runs nightly via GitHub Actions
   (`prod-cron.yml`) — NOT Vercel (Hobby daily-only; needs numpy/umap/hdbscan).
2. `drizzle/` migration for the table + `lib/server/manifoldStore.ts` reader
   (degrades honest-empty without rows, like price/twin paths).
3. UI: density-contour scatter, clusters tinted dominant club, you = pulsing volt,
   hover = template XI + share + form; season drift slider. Reduced-motion safe.
4. Tests: TS contract tests on reader/labels (deterministic fixtures); Python
   smoke test on synthetic squads. e2e pins the honest-empty + populated states.
5. Docs: record Python version + seed policy in `docs/NOTES.md` (reproducibility).

## Phase B — bug-fix sweep (all known bugs, ~1.5 days)

| # | Bug | Fix |
|---|---|---|
| B1 | `exhaustive-deps` disables in `BoardDesk.tsx:104,190`, `FieldClient.tsx:190,270` | Fix deps or extract stable callbacks; remove disables |
| B2 | `no-img-element` disables in `ClubCrest.tsx:70`, `PlayerPhoto.tsx:36` | Migrate to `next/image` with CDN `remotePatterns` + fixed sizes (kills CLS too) |
| B3 | `teamShort:"XXX"` dev placeholder ships in prod bundle (`app/dev/charts/page.tsx:171`) | Gate `/dev` behind `NODE_ENV!=="production"` or strip route; replace fixture |
| B4 | Live-rank probe INCONCLUSIVE (`docs/NOTES.md`); replay gate PENDING (`pnpm replay` after GW1 `data_checked`) | Re-run Saturday 11:30 UTC two-poll probe; document verdict; arm replay suite in CI |
| B5 | `teams[].strength` nullable + standings `id` removal drift (fixed in schemas, but recurs) | Add `record-fixtures` schema-drift assertion to CI so next drift fails loudly |
| B6 | Pasted Ollama key rotation | Covered in F0 — verify no key in git history (`git log -S`) |
| B7 | Cron fragility: Vercel daily-only + GitHub 60-day-disable note in `prod-cron.yml` | Add uptime-monitor hit on `/api/cron/warm` + alert; document re-arm runbook |
| B8 | No global error surface (`app/not-found.tsx` exists, no `error.tsx`/`global-error`) | Add route `error.tsx` + `global-error.tsx` with retry + honest fallback copy |
| B9 | Console noise in scripts (`record-fixtures`, `extract-avatars`) | Keep CLI logs, remove/gate any client-side `console.*` |

## Phase P — public-launch hardening (~2 days, parallelisable after F1)

1. **Legal/assets:** trophy/ball photos + avatar crops + PL CDN faces/crests ship "as-is
   (hobby)" per `GAFFER_V4_PLAN.md`. For public: add `docs/LICENSE-ASSETS.md`, replace or
   license hero imagery, add hotlink fallback + attribution where required.
2. **Security:** `cronGuard` must fail closed when `CRON_SECRET` unset (today degrades);
   env validation via zod at boot; rate-limit Ask (60/hr/IP already — verify Redis-backed,
   not MemoryStore-bypassable); `robots.txt` + `sitemap` + per-route metadata/OG
   (field + film cards exist — add DNA/Board/League).
3. **Reliability/observability:** Sentry (or minimal `/api/health` + cron failure log +
   Vercel alerts); single-flight + Upstash fallback already — add cold-start honest badge
   when on MemoryStore; keep payload budget (`/api/gaffer/live` ≤60KB, warm p95 ≤250ms).
4. **A11y/perf pass:** run the audit prompt literally (raw-hex grep, grey-token grep,
   dual-axis check, `<Est>` coverage, aria/table toggles, 44px targets); `next/image`
   sizes + AVIF/WebP for 4K trophy hero; `next/font` for Saira/Barlow; dynamic-import
   heavy Field modes; prune `Screenshot *.png` + stray TopoJSON-style cruft from repo.

## Phase Q — quality gates so this never regresses (0.5 day)

1. CI (`.github/workflows/ci.yml`): add `pnpm replay` (armed only when `replay-ready`
   marker present, else explicit skip log), e2e against preview URL, audit-prompt grep
   checks (raw hex / grey tokens / `<Est>` on touched routes).
2. Coverage: keep colocated `*.test.ts` rule; require tests for every new engine + resolver
   intent (router zero-model contract pattern from Phase F is the template).
3. Docs: update `GAFFER_V2_PLAN.md` + `GAFFER_V8_PLAN.md` outstanding sections per phase;
   append Manifold + migration decisions to `docs/NOTES.md`.

## Suggested build order (respecting "features first")

`F0 (unblock, ½d) → F1 → F2 → F3 → M → B → P → Q`, committing one phase at a time.
F1 can start the moment F0's migration decision is recorded — don't wait for prod migrate
to land to build UI against honest-empty states (the codebase already degrades cleanly).
