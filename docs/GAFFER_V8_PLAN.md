# GAFFER v8 — landing polish + remaining engine grounding

> Resume file for the owner-driven V8 batch. Preceded by `GAFFER_V7_PLAN.md`
> (complete). Gates every phase: lint · typecheck · vitest · build · e2e,
> one commit each.

## Phases

### V8-A — 4-faces brand badge + lineup alignment ✅ (`dd9e061`)
Gaffer-badge quadrant in the wordmark everywhere; HeroLineup tiles on uniform
256×320 canvases, volt ring instead of scale jump on the active gaffer.

### V8-B — 4K action band ✅ (`5d38019`)
Owner 4K render pairs with the match-ball photo in a split closing band.

### V8-C+D — club map band + real crests ✅ (`2546a53`)
England coastline silhouette with twenty crests pinned at real stadium
positions; tap tints chrome app-wide (`gaffer_club`). CrestBadge on the FPL
badge CDN with CrestTile fallback.

### V8-E — feature 8 grounded: price predictor wired to its store ✅ (`this commit`)
The last unconsumed engine chain landed end-to-end:
- `lib/server/priceStore.ts` — sole Postgres reader for price history
  (snapshots, change ledger, coverage guard); degrades empty without DB.
- `lib/engines/price.ts` gains two pure helpers (+6 tests):
  `velocitySeries` (per-interval net deltas over trailing 24h → gauge
  sparkline) and `rankTonight` (sort by |p(move)|, uncovered entries kept at
  zero so the UI can grey them honestly).
- `price-gauge` resolver no longer fakes numbers: named player → real
  `pressure()` over stored hourly snapshots (net, pRise, velocity, ETA prose);
  unnamed → **Tonight list**, your squad ranked by |p(rise)| with today's
  rises/falls ledger counts (falls back to the field's most-transferred
  players without a squad, and to the labelled estimate when snapshot
  coverage is absent).
- AskBar renderer branches on `props.tonight`: direction-coloured list with
  `<Est>`-wrapped probabilities, thin-history rows greyed.
Gates: typecheck/lint/vitest 294✓/build/e2e 68✓.

## Outstanding

- Manifold (17) Python escape hatch — deferred until scale.

### V8-F — solver-lite: rank-priced horizon payback ✅ (`this commit`)
The one open item from `docs/PLANNER_RESEARCH.md` lands:
- `lib/engines/solverLite.ts` (+14 tests): per-player 6-GW projection from the
  Board's fixture model keyed to position (attackers scale by opposition
  defence, defenders by bluntness of opposition attack; own-team quality stays
  in the form×ep_next base so nothing double counts), blanks zero, doubles
  stack; `priceMove` finds the first cumulative-gain GW that covers a hit and
  converts net points into **rank swing** via ranks-per-point at the hero's
  season total; `deskVerdict` sums net points + ranks for the whole ledger.
- `buildSolverContext`/`rankPrice` shared server helpers feed both composition
  sites (Board page + `buildBoardDesk` → Field planner). Horizon arrays ride
  on DeskSquadRow/DeskCandidate; pricing runs client-side per staged pair.
- BoardDesk ledger: Payback column becomes **Horizon** — payback marker from
  cumulative gain over real fixtures (not ep_next ÷ 4), each hit row shows its
  Est rank swing, and the footer gains the plan-level "+X pts · ±Y ranks"
  verdict. All estimates wrapped in `<Est>` with method text.
Gates: typecheck/lint/vitest 308✓/build/e2e 68✓.
