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

### V8-H — 2026/27 faces: current-season asset set + cascade ✅ (`this commit`)
Owner report: Wirtz (and every other new signing) had no face — the CDN path
was the retired generic set. Probed live: the PL site itself now serves
`premierleague25/photos/players/110x140/{code}.png` (no p prefix) and new
signings exist ONLY there; the old `premierleague/photos/players/250x250/
p{code}.png` still covers pre-2025 players. So:
- `playerImgSources()` returns the cascade [2025/26 set → legacy set];
  `PlayerPhoto` (client) walks it onError and falls back to the club crest.
- ShirtToken, PeekSheet and the player profile render through the cascade.
- Clubs/crests verified already current (config/clubs.ts crest codes match
  the live bootstrap 1:1; Coventry/Hull/Sunderland promoted ids present) —
  transfers like Isak → Liverpool flow from live bootstrap (team 14) and now
  get his correct face + Liverpool rail. Kits: the app renders CDN crests
  (season-stable) and club-rail frames, both current.
Gates: typecheck/lint/vitest 308✓/build/e2e 68✓ (the faces e2e loads the
new URLs in a real browser).

### V8-I — mirrored compare pitch + per-face xG/xGC ✅ (`this commit`)
- **Faces, follow-up:** probed Rogers with a real browser — the PL's own
  site renders `placeholder.png` for him; his 2026/27 headshot is simply not
  published yet (current set sampled 35/40 players; Rogers is in the stale
  legacy-only tail). The cascade already prefers the current set on every
  load, so these self-heal the moment PL publishes. No code change needed.
- **Compare pitch** is now a real mirrored football layout: rival XI with
  their GK at the top edge, your XI with your GK at the bottom edge, the two
  strike forces facing each other across the halfway line, team names on
  each end (rival in ultra, You in volt). Shared-player dimming kept.
- **Per-face expectation line**: every pitch token now shows
  `xG .31 · xGC 1.2` under the name — season shrunk xG/90 plus the team's
  expected goals conceded for this fixture from the Board's fixture model.
  `loadGwContext` now carries the season fixture list so the model is built
  from the full window (same for the rival builder); SquadRow gains
  `xg90`/`xgc90`, populated in both composition paths.
Gates: typecheck/lint/vitest 308✓/build/e2e 68✓.

### V8-G — 4K trophy hero + gate buttons with real boundaries ✅ (`302c2b7`)
Owner notes: landing looked bare, the trophy shot was missing, and the
controls under the gate were barely tappable on mobile.
- The owner's 4K trophy render (`docs/error renders/R9zgMiC8QT2J5P8tS7QFf6.jpg`,
  5455×3068) is the hero backdrop now — full-bleed under the wordmark and
  gate, legibility washes fading into the floodlight ramp at both ends
  (`public/images/trophy-4k.jpg`, next/image priority). e2e pins the img.
- Everything under the gate becomes a real button in the top-chrome recipe
  (`skewed h-11 bg-raised card-ring`): "Where do I find my ID?" (was a bare
  underlined text link), the recent-team chips (h-8 → h-11, forget target
  with after-expanded hit area), and the club carousel — arrows h-9 → h-11,
  the crest select gets a permanent card-ring boundary (was boundary-less
  until selected) at min-h-44px.
Gates: typecheck/lint/vitest 308✓/build/e2e 68✓.

### V8-J — owner polish pass: landing, map, thumb bar, leagues ✅ (`this commit`)
- Landing closes on the match ball alone (Kofi action shot retired); trophy
  hero unchanged.
- Club map gains the arena glow — ultra/surge/volt radial washes over the
  turf, FIFA-menu style; a selected club now glows in its own rail colour
  (ring + halo + lit underline, scale 125) on the map, and the gate carousel
  pick gets the same halo.
- Field value pills (EO%, swing ▲▼, leverage) bumped to text-xs and centred —
  same visual weight as points.
- Leagues: manager rows show the team name only (player name stays on your
  row and in compare tooltips), "showing N" dropped from the header meta, and
  the filter rail collapses to a `Filters` button until asked.
- Mobile thumb bar rebuilt in the top-chrome recipe — skewed raised pills
  with card-ring, active tab fills volt (More included); the status pill
  floats clear of the new padding; the mobile Ask trigger becomes a skewed
  "Ask ?" pill matching the desktop control. e2e updated for the new
  computed colours.
Gates: typecheck/lint/vitest 308✓/build/e2e 68✓.
