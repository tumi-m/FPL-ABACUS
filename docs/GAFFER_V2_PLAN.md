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

---

## Locked decisions

- **Spec:** `architecture/GAFFER_STYLE_GUIDE.md` (rev-02 stadium blue) supersedes §1–§5 of
  `GAFFER_V2_UI_UPGRADE.md`; everything else in that doc stands.
- **Commits:** one per phase, conventional messages, push to main immediately (Vercel deploys).
- **Nav:** switch to 5 items (`Matchday · Field · Board · Leagues · Ask`) during Phase C;
  Board → redirect to `/planner` until Phase E replaces it; Ask hidden until F ships.
- **AI stack:** hosted Ollama gateway via env vars `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`.
  Router-first genUI; model selects components only, never emits numbers.
  ⚠ The pasted API key was shared in chat — rotate before real traffic.
- **News source:** BBC/Guardian/FFScout RSS + r/FantasyPL JSON. No Twitter API (paid).

## Secrets / env

| Where | Key | Status |
|---|---|---|
| Vercel | `DATABASE_URL` `UPSTASH_REDIS_REST_URL/TOKEN` `CRON_SECRET` | ✅ set (user) |
| GitHub repo | `PROD_URL` `CRON_SECRET` | ✅ set (user) |
| Vercel + GitHub | `LLM_BASE_URL` `LLM_API_KEY` (rotate!) `LLM_MODEL` | ⬜ add before Phase F |

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

### 🔄 Phase D — charts (IN PROGRESS — `aab35ad`)
Done: ChartFrame FLOODLIGHT chrome (bevel/gloss/skewed toggle/upper-label); **EOScatter** built
+ wired into /field. Remaining: restyle RankCurve/SwingBars/Sparkline/DistributionCurve/
ProbabilityBand/HeatGrid/Meter numerals (.fig-num) + volt single-mark emphasis; build DefconRate,
PriceGauge, OwnershipFlow, FixtureSwing, xGvsActual, ChipTimeline (LiveRankRibbon ≈ ProbabilityBand
exists; CaptainMatrix ≈ HeatGrid base); add all to /dev/charts gallery.

### ⬜ Phase E — The Board
NEW engine `lib/engines/fixtureModel.ts`: rolling 38-match opponent xGC/xG per-90 windows, shrunk
toward league mean (k=6), venue adj, quantile→heat 1..6. Grid (6/8/10/EoS, UPPERCASE home /
lowercase away, position-aware colour — Gabriel ≠ Watkins acceptance test), colour models
(xG/FDR/odds-stub), transfer staging + payback marker + ledger, chip lane w/ GW19 hard wall, URL
state encoding, solver last (3s budget, labelled suggestion). Replaces /planner; drop redirect.

### ⬜ Phase E½ — news subsystem
Drizzle migration `news_item` (url-hash unique, element_ids[], team_ids[], relevance);
`lib/news/sources.ts` (RSS×3 + Reddit JSON); `lib/news/tagger.ts` regex name-matching vs bootstrap
web_name; `/api/cron/news` hourly gate in prod-cron.yml; `/news` page ranked by squad relevance
with filter chips; FPL elements[].news surfaced inline.

### ⬜ Phase F — generative interface + grounded assistant
`lib/ai/client.ts` (OpenAI-compatible → LLM_* env vars; 4s timeout selection mode; streaming
prose mode); `lib/genui/registry.ts` (15 components, Zod params, resolve→existing engines);
`lib/genui/router.ts` (40+ shapes; vitest asserts captaincy/price/hit questions resolve with zero
model calls); resolver + RSC stream staggered 60ms; model fallback → router best guess.
Grounded chat mode: prose ONLY from tool outputs (news_search, injury_list, captain_compare,
transfer_sim…); numbers quoted verbatim. Ask bar header-pinned ⌘K, screen-aware prompts.
Upstash rate limit 20/hr/IP; cache hash(intent,params,entry,gw) TTL 10min.

### ⬜ Phase G — generative visuals
Season Fingerprint first (mulberry32 exists in simulate.ts; seed entryId; canvas dPR≤2;
deterministic); Gameweek Sigil (/film cover + OG); Kit Weave bg for /squad+/dna; reactive aurora
12fps off under reduced-motion/save-data.

## Cross-cutting rules (every phase)

Audit prompt after each session: raw hex outside globals.css (except brand.ts meta) · no grey
tokens · accent meaning discipline · one hero figure/screen · never pure-black shadow · no dual
y-axis charts · heat blue→green · `<Est>` on estimates · reduced-motion branch · chart aria/table
toggle. Tests colocated; e2e extended per route; CI green before every commit.
