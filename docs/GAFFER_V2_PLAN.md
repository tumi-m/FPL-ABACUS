# GAFFER v2 + v3 — implementation plan & progress

> **Resume file.** If the codespace dies, read this + `AGENTS.md` + `architecture/` and continue
> from the first unchecked phase. Commit one commit per phase, push each to `main`.

## v3 QUANT LAYER (persisted at `architecture/GAFFER_V3_FEATURES.md`)

Merged roadmap after v2 Block C/D: **Q0** foundations (4 Correlation Web copula sim + 5 Strength
Model Dixon–Coles nightly fit) → **Q1** portfolio (1 Position, 3 Beta, 13 Cone) → v2 E/E½/F/G →
**Q2** understanding (9 Ledger Shapley, 11 Process-vs-Outcome) → **Q3** estimates (6 Kalman, 7
BOCPD Role Radar, 8 Engine Temperature Cox) → **Q4** cohort-heavy (10 Twin Study w/ 30k sample,
17 Manifold via Python cron) → **Q5** decision/market (12 VaR/CVaR, 14 Crossover, 15 Option Value,
16 Threshold, 18 Crowding, 19 WPA) → **Q6** (20 Glicko-2 Ladder). **Q7 anytime: 21 The Committee**
(typed rule compiler + deterministic evaluator + Prize Board; ledger only, never payments).
Honesty rules from v3 §Honesty apply to every phase: uncertainty shipped with every number,
grey-out below evidence thresholds, observational labelling, calibration published.

### ✅ v3 Q0+Q1 — foundations + portfolio engines (`this commit`)
`lib/quant/strength.ts` — feature 5 Dixon–Coles: coordinate-ascent MAP on weighted penalised
Poisson likelihood (exp(−ξ·Δd) recency, Gaussian pooling priors), correct DC τ(x,y;ρ,λh,λa),
Laplace SEs per team; `lib/quant/correlationWeb.ts` — feature 4 copula-by-construction:
τ-rejection scoreline draws → multinomial goal/assist allocation by xG/xA share given simulated
minutes → CS/DEFCON from same draw → empirical Σ + effective bets (participation ratio).
`lib/quant/portfolio.ts` — features 1/3/13 pure engines: active share & weights, active-return
series, TE(weekly×√38)/IR, Φ(IR√n) prob-ahead, squad β=Cov/Var + Jensen α + residual sd, Cone
AR(1)-aware 10k-path fan p5/p50/p95 + target probability & required weekly rate. 23 tests pin
recovery of injected strength, correlation sign structure (teammates +, independents ~0,
stack < spread effective bets), β/α recovery, cone honesty. Wired user-visible via genUI
"effective-bets" card (Ask bar, Meter). Gates: vitest 153✓ / build / e2e 40✓.
**Next up:** Q2 (9 Ledger Shapley, 11 Process-vs-Outcome) per GAFFER_V3_FEATURES.md.

### ✅ v3 Q2+Q3 — understanding + estimators (`this commit`)
`lib/quant/understanding.ts` — feature 9 Shapley ledger (Monte Carlo permutation sampling,
efficiency Σφ = total move, per-φ SE reported, deterministic per seed); feature 11
process-vs-outcome four luck channels with hold-vs-act advice rules. `lib/quant/estimators.ts`
— feature 6 true-form Kalman local-level filter (cameo discount via minutes-weighted obs noise,
uncertainty widens through absences); feature 7 role radar BOCPD (Adams–MacKay with robust
median-abs-diff observation scale, wide fresh-run predictive, short-run-mass alarm); feature 8
engine temperature Cox PH (Breslow partial likelihood Newton steps → hazard → P(event≤horizon)).
14 tests pin efficiency/recovery/detection-latency properties. Wired: "true-form" genUI card
(Kalman ribbon via ProbabilityBand). Gates: vitest 167✓ / build / e2e 40✓.
**Next up:** Q4 (10 Twin Study needs cohort sample extension; 17 Manifold Python cron),
Q5 decision/market engines (12/14/15/16/18/19), Q6 Glicko-2 ladder, Q7 Committee.

### ✅ v3 Q5 (core) — decision engines (`this commit`)
`lib/quant/decision.ts` — feature 12 rank-at-risk (VaR₅ = 95th pct, coherent CVaR₅ tail mean,
median); feature 14 crossover/Nash captaincy ((Δμ+B)/σ_Δ objective with shared-player hedge,
per-challenger B* crossover pricing); feature 15 chip option value (Snell envelope via
Tsitsiklis–Van Roy backward induction on simulated payoff paths, expiry wall for set-1);
feature 16 transfer threshold (press-vs-wait DP over sampled gain distributions, ≥0 guarantee).
9 tests pin coherence, chasing-side switching, wall expiry, FT-bank sensitivity. All
deterministic per seed. Gates: vitest 176✓ / build.
**Remaining v3:** Q4 Twin Study + Manifold (needs cohort 30k sample extension / Python cron),
Q5 extras 18 Crowding + 19 WPA, Q6 Glicko-2 Ladder, Q7 Committee rule compiler. Then v4.

### ✅ v3 Q6+Q7 — the Ladder + the Committee (`this commit`)
`lib/quant/ladder.ts` — feature 20 standard Glicko-2 (Glickman 2012): r/RD/σ per manager,
round-robin vs cohort sample with W/D/L from GW points, Illinois-algorithm volatility update,
RD widening through inactivity (capped at 350); `scoresFromPoints` maps pairwise point compares
onto outcomes. `lib/quant/committee.ts` — feature 21 typed competition rules (window/metric/
agg/filter/order/topN/tieBreak/prizeShare) with a deterministic evaluator: NaN entries drop,
lower-is-better metrics honoured, tie-break ladder season-total→transfers→best-rank, prize
shares split across topN as fractions of a pot the app never holds (ledger only). 11 tests.
Gates: vitest 187✓ / build / typecheck / lint clean.

## v3 STATUS: engines shipped for Q0, Q1, Q2, Q3, Q5-core, Q6, Q7 — all pure TS, tested.
**Outstanding v3:** v3-17 the Manifold only (needs the Python escape hatch, deferred until
scale). v3-10's 30k twin cohort extension landed in **V9-A** — see `docs/GAFFER_V8_PLAN.md`:
`twin-pages`/`twin-fetch` resumable phases top up match-scoped `cohort_entry` rows past the
2k EO sample, migration 0006; the UI surfaces for quant cards beyond ask-bar wiring remain
v4 scope (`GAFFER_V4_SCREEN_SPECS.md`).

---

## Locked decisions

- **Spec:** `architecture/GAFFER_STYLE_GUIDE.md` (rev-02 stadium blue) supersedes §1–§5 of
  `GAFFER_V2_UI_UPGRADE.md`; everything else in that doc stands.
- **Commits:** one per phase, conventional messages, push to main immediately (Vercel deploys).
- **Nav:** switch to 5 items (`Matchday · Field · Board · Leagues · Ask`) during Phase C;
  Board → redirect to `/planner` until Phase E replaces it; Ask hidden until F ships.
- **AI stack:** hosted Ollama gateway via env vars `OLLAMA_BASE_URL` / `OLLAMA_API_KEY` / `OLLAMA_MODEL`.
  Router-first genUI; model selects components only, never emits numbers.
  ⚠ The pasted API key was shared in chat — rotate before real traffic.
- **News source:** BBC/Guardian/FFScout RSS + r/FantasyPL JSON. No Twitter API (paid).

## Secrets / env

| Where | Key | Status |
|---|---|---|
| Vercel | `DATABASE_URL` `UPSTASH_REDIS_REST_URL/TOKEN` `CRON_SECRET` | ✅ set (user) |
| GitHub repo | `PROD_URL` `CRON_SECRET` | ✅ set (user) |
| Vercel + GitHub | `OLLAMA_BASE_URL` `OLLAMA_API_KEY` (rotate!) `OLLAMA_MODEL` | ✅ set (user) |

## Phases

### ✅ Step 0 — persist spec (`68d5f06`)
GAFFER_STYLE_GUIDE.md written from chat paste; PROMPTS paths fixed; styleguide HTML regenerated
stadium blue; AGENTS.md pointer.

### ✅ Phase A — repaint (`c7cd711`)
Stadium-blue tokens verbatim in `globals.css` (+ legacy aliases so all components render navy),
Saira/Barlow fonts via Google Fonts link, `.atmos` fixed layer in AppShell (content wrapped
`relative z-10`), bevel/gloss/lift/glow utilities, skew system (`--skew`/`--unskew`, −6° <640px),
`.fig-num`/`.hero-figure`/`.upper-label` classes, `config/clubs.ts` + ClubFlag/CrestTile wired into
FixturesRail + SquadTable, validated 8-slot series palette, navy seq ramp, surge↔flare diverging,
`--ink-on-dark`, HeatGrid ink tokenised, themeColor via brand.ts. Gates: typecheck/lint/vitest
95✓/build/e2e 28✓.

### ✅ Phase C — the Field (`bd159e1`)
Night-lit pitch, SVG shirt tokens (4 states, captain armband, DEFCON arc, bonus dots), 4 modes
(Points/Ownership/Swing/Leverage — SquadRow gained `teamId` + `eo`), compare mode via
`/api/fpl/entry/{id}/event/{gw}/picks`, nav → Matchday·Field·Board·Leagues (+`/board`→`/planner`
redirect), Zustand store `lib/store/app.ts`. e2e 32✓.

### Phase F groundwork done early (`OLLAMA_API_KEY` naming per user's Vercel/GitHub config)
`lib/ai/client.ts` — OpenAI-compatible client for the hosted Ollama gateway
(`OLLAMA_API_KEY` · `OLLAMA_BASE_URL` default https://api.ollama.com · `OLLAMA_MODEL`),
4–8s timeouts, JSON mode, tolerant parser. **Model selects components only — never numbers.**
Remaining F: genui registry/router/resolver/streaming + Ask bar UI.
### ✅ Phase B — motion (`a18d75d`)
Live dot (skewed volt square + expanding ring — the only continuous animation), count-up volt
wash, `[data-trend]` atmosphere tint from live rank polls, sheet slide+blur timings, hover-lift.
Brand renamed to **FPL Gaffer**.

### ✅ Phase D — charts (`aab35ad` + this commit)
ChartFrame FLOODLIGHT chrome; **EOScatter** + **PointsWaterfall** (/field/points sub-page,
header live GW+season score, `?next=` safe redirects, /field OG card). All ten existing charts
restyled: `.fig-num` numerals, volt single-mark emphasis (you-line/median/sparkline/bullet),
HeatGrid on `--heat-1..6` tokens (raw ramp hexes gone). New: **DefconRate** (threshold rule),
**PriceGauge** (amber gauge + 24h velocity), **OwnershipFlow** (club-rail stacked area),
**FixtureSwing** (direction-coloured slope), **XgVsActual** (cumulative xGI vs returns, one axis),
**ChipTimeline** (lane pills). Full set in /dev/charts gallery. Gates: typecheck/lint/vitest
99✓/build/e2e 32✓.

### ✅ Phase E — The Board (`this commit`)
`lib/engines/fixtureModel.ts` (+14 tests): rolling 38-match opponent GF/GA per-90 windows,
shrunk to league mean k=6, venue factors derived from the same window; `projectFixture` ratio
model; position-aware easiness (GK/DEF ← −xgAgainst, MID/FWD → +xgFor — Gabriel ≠ Watkins
acceptance test); quantile→heat 1..6; cell encoding UPPERCASE home / lowercase away.
`/board` server-rendered with URL state (`?h=6|8|10|eos&c=xg|fdr|odds`), quantile-bucketed
HeatGrid, blanks as sunk holes, doubles joined codes, blanks/doubles footer. **BoardDesk**
client island: transfer staging ledger (1 FT assumption labelled Est, real selling_price +
bank affordability), payback markers, chip lane with per-chip stop_event hard wall enforced
(one chip/GW, taken chips disabled). `/planner` now redirects to `/board`. e2e updated:
board grid + URL persistence + planner redirect. Gates: vitest 113✓ / build / e2e 34✓.
Deferred by design (Board digest §BUILD ORDER): RUN view, drafts, compare distributions,
solver-points/rank (needs v3-2/4) — v4 scope.

### ✅ Phase E½ — news subsystem (`this commit`)
Drizzle `news_item` (migration `0001`: url-hash unique, integer[] element/team ids, ingest
relevance) · `lib/news/sources.ts` — BBC/Guardian/FFScout RSS + r/FantasyPL JSON, pure parsers,
6s timeouts, sha256 url hashing · `lib/news/tagger.ts` — escaped word-boundary regex vs bootstrap
web_name ("Salad" ≠ Salah), recency×source-weight relevance, multi-player spread bump ·
`lib/news/store.ts` chunked onConflictDoNothing upsert + 14-day prune · `/api/cron/news`
(cronGuard, per-source degradation, hourly gate added to prod-cron.yml at :30) · `/news` page:
squad-relevance ranking (+3 squad / +1 club), URL-state filter chips (All/My squad/My clubs/
General), FPL elements[].news + chance-of-playing surfaced inline via `<Est>`; News added to
nav. Gates: vitest 123✓ / build / e2e 36✓.

### ✅ Phase F — generative interface + grounded assistant (`this commit`)
`lib/genui/registry.ts` — 12 components, Zod param coercion, engine data-path documented per
card · `lib/genui/router.ts` (+10 tests) — 12 intents / 40+ regex shapes, player-name extractor
with stop-word trimming; **vitest pins the zero-model contract** (captaincy/price/hit resolve
with no calls) · `lib/genui/resolve.ts` — every card grounded from cached upstream + engines
(bootstrapLite ep_next×EO captaincy board, fixtureModel runs, element-summary xGI-vs-returns,
entry-history chip lanes, news_item search, price pressure via new transfers_in/out_event on
ElementLite); template prose only — the model never writes numbers · `/api/ask` POST: 20/hr/IP
rate limit (cacheStore incrWithTtl), sha1(intent,params,entry,gw) cache TTL 600s, router →
model-select (JSON mode 4s, component keys only) → bestGuess fallback, NDJSON stream staggered
60ms · AskBar header-pinned ⌘K sheet with screen-aware prompts + streaming card renderer.
Gates: vitest 123✓ / build / e2e 37✓ (ask pipeline asserted).

### ✅ Phase G — generative visuals (`this commit`)
`lib/generative/specs.ts` (+7 tests) — deterministic layout math on mulberry32: fingerprint
spokes (rank-swing tone, points length, chip→surge override), sigil petals/rings, kit-weave
bands keyed to `--club-*` tokens · **SeasonFingerprint** canvas (dPR≤2, drawn once, no loop) →
/dna · **GwSigil** pure SVG (server-rendered, zero hydration) + **/film** season-archive page
with hero-figure cover and deterministic OG image · **KitWeave** diagonal club-band chrome →
/squad header · **Aurora** reactive wash at hard-capped 12fps, fully stopped under
prefers-reduced-motion / Save-Data / hidden tab. Same seed ⇒ identical art, server and client.
Gates: vitest 130✓ / build / e2e 40✓.

## v2 COMPLETE — remaining v2 features live in GAFFER_V2_FEATURES.md backlog; v3 quant layer below.

## Cross-cutting rules (every phase)

Audit prompt after each session: raw hex outside globals.css (except brand.ts meta) · no grey
tokens · accent meaning discipline · one hero figure/screen · never pure-black shadow · no dual
y-axis charts · heat blue→green · `<Est>` on estimates · reduced-motion branch · chart aria/table
toggle. Tests colocated; e2e extended per route; CI green before every commit.
