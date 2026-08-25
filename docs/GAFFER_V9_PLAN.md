# GAFFER v9 — the transfer planner, and a faster first paint

> Resume file. Preceded by `GAFFER_V8_PLAN.md` (complete). Gates every phase:
> lint · typecheck · vitest · build · e2e.

## Phases

### V9-A — the 30k twin cohort extension ✅
Shipped under the v8 file; see `GAFFER_V8_PLAN.md`.

### V9-B — FIFA-menu gradient atmosphere on the landing ✅
Shipped upstream.

### V9-C — bonus shows the actual 1·2·3 ✅
Shipped upstream.

### V9-D — first paint ✅
The app was slow before a single pixel of content: a render-blocking
stylesheet on fonts.googleapis.com, four serial FPL round trips in the shell
and on every page, and five megabytes of source imagery.

- **Fonts self-hosted** (`config/fonts.ts`, `next/font/google`). Saira keeps
  its `wdth` axis so `.fig-num` and `.hero-figure` are unchanged; Barlow is
  pinned to the four weights the app uses instead of the old 300..900 pull.
  Two preconnects and one blocking request leave the critical path.
- **The shell stops awaiting upstream.** `LiveBarSlot` and `TeamPill`
  (`components/gaffer/HeaderStatus.tsx`) render inside Suspense boundaries, so
  the header, nav and page skeleton flush immediately and a slow FPL costs a
  missing pill rather than a blank screen. `React.cache` dedupes the shared
  load. Every heavy route gained a `loading.tsx`.
- **Serial fetches became waves.** `loadGwContext`, the Board and the Planner
  each issue one `Promise.allSettled` where they used to await in sequence;
  a single dead endpoint no longer takes the page with it.
- **Imagery re-encoded**: `public/` 5.0 MB → 1.2 MB (trophy 2.58 MB → 237 KB
  at 2560px, badge 402 → 85 KB, twelve avatars 1.72 MB → 500 KB). No visible
  change at any rendered size. `next.config.ts` adds AVIF, a face-sized image
  ladder, a 30-day minimum cache and `optimizePackageImports`.

### V9-E — the transfer planner ✅
The Board's staging desk and the Field's Planner mode were two half-copies of
the same idea, and neither answered "who should I bring in?". Both are retired
and `/planner` is the one desk:

- `lib/engines/planner.ts` — the rule engine, pure and tested (35 cases):
  like-for-like positions, real selling prices, three-per-club, the chain
  collapse that stops a re-sold arrival being charged as a second transfer,
  window arithmetic, market filtering/sorting, the ticker grid, and the
  bootstrap-only price outlook.
- `lib/server/buildPlanner.ts` — one bootstrap pass turns every selectable
  player into a market row carrying a six-gameweek projection from
  `solverLite`; one fixture pass builds the club × gameweek ticker both the
  pitch and the table read.
- The UI (`components/gaffer/planner/*`): a formation pitch with the mode's
  figure on every tile (next GW · next 3 · price move), the full market with
  position/club/price/search/affordability filters and per-gameweek cells, a
  ledger that prices each staged move and the hit, the chip lane with FPL's
  real per-chip availability window enforced, the fixture ticker, and the
  price watch. Up to four plan slots persist per team; desks saved by the old
  Board migrate in untouched.
- The Board keeps the fixture heat grid and links across; the Field drops its
  Planner mode and keeps seven.

### V9-F — the landing says what the app is ✅
The gate sat on a trophy shot with no explanation. The hero now carries the
tagline and the description over a scrim that guarantees contrast against a
bright photograph, plus a four-card band naming what the app actually does.

### V9-G — stored data degrades, it does not throw ✅
Owner report: asking "Will anyone rise tonight?" answered
`Something went wrong: relation "price_change" does not exist`.

Root cause: `DATABASE_URL` is set on production but the schema was never
applied, so `hasDb` was true and the price reader queried tables that do not
exist. `hasDb` alone was never a sufficient guard — it says a database is
configured, not that it is usable.

- `lib/db/read.ts` — `dbRead(label, fallback, run)`. Every stored-data read is
  an enhancement over something that already works without it, so a read that
  cannot be served returns the caller's empty value instead of throwing.
  `classifyDbError` separates an unmigrated schema (SQLSTATE 42P01/42703) from
  a failing one, and the operator gets one warning per call site naming the
  fix: **run `pnpm db:migrate`**. 12 unit tests.
- `priceStore` (snapshots, ledger, coverage), `entryDirectory.searchEntries`
  and `news/store.recentItems` now read through it. The price resolver's
  existing honest fallback — "stored hourly snapshots have not covered this
  player yet" — is what the user sees.
- `/api/ask` no longer streams raw error text to the browser. The cause goes
  to the server log; the console says the desk could not answer that one.
  Postgres messages, connection strings and upstream URLs stop leaking.

Verified against a real Postgres with an empty schema: the question that
produced the error now returns a Price watch card with its estimate note, the
gate's name search returns an empty result set rather than a 500, and the
newsdesk renders.

### V9-H — the Field reads like a broadcast ✅
Owner batch on what the pitch and its boards actually show.

**Five new charts, and the maths that was already written.** `lib/quant` held a
Nash captaincy objective, a Shapley permutation sampler and a rank-at-risk
measure that nothing ever rendered. They are on screen now, in
`components/gaffer/field/DecisionCharts.tsx`:
- **Rank at risk** — the Dixon–Coles Monte Carlo's XI totals converted to rank
  through the curve's local slope; median, the 5% tail and the mean rank given
  you land in it. Says so when the good half of the band runs into first place.
- **The Crossover** — the Nash objective (Δμ + B)/σ_Δ over your captaincy
  candidates, with the points-behind level at which each challenger overtakes.
- **The Ledger** — Shapley attribution over the multiverse counterfactuals,
  400 permutations, so the bars sum to the rank move they explain.
- **Process vs outcome** — finishing against xG, creation against xA, the
  official-minus-projected bonus bounce, and your score against the field.
- **Delivery** — every player's live points against the expectation FPL
  published for the week, both counting the multiplier.
The simulation feed is fetched once per Field view after hydration and shared;
`buildCorrelationWeb` now returns per-player sd and the XI total draws.

**Two accuracy bugs in the existing charts.** `livePoints` is the raw player
score; the multiplier lives beside it. "Points by position" summed raw points,
so the captain's second helping vanished and the bars did not add up to the
score they claimed to explain. "Captain share" was worse — it divided a
doubled captain by an undoubled squad total and overstated every share. Both
now go through one `contribution()` helper.

**Faces or kits.** `PlayerAvatar` + `AvatarToggle` (Focal's switch): a
device-wide preference in localStorage, live across every board on the page,
with `ShirtKit` drawing twenty club shirts from the rail tokens — pattern as
well as colour, because three clubs wear red.

**The green rings are gone.** The DEFCON meter was `--surge` on green turf,
which read as decoration. New `--defcon` / `--defcon-hit` tokens: steel while
the work is being done, gold the moment the two points are banked.

**Match events on the token.** Goals, assists, the shutout (keepers and
defenders only, dimmed until the whistle), keeper saves once they are worth a
point, bookings, own goals and missed penalties — each a shape *and* a hue, so
no two marks a player can hold at once look alike. The captain is a real
armband now: a volt disc overhanging the frame plus a volt ring on the face,
and "3C" under a Triple Captain.

**2026/27 faces.** `PHOTO_SEASONS` puts `premierleague26` first and falls back
to `premierleague25`, then the retired generic set, then the crest.

### V9-I — the stat boards ✅
`lib/engines/performance.ts` (+39 tests) is the one definition of a player's
season: per-90s, actual against expected, and the shrinkage that stops a hot
cameo topping a board (half weight at 900 minutes). Expected clean sheets are
the Poisson shutout probability e^(−xGC/90) across starts. Minutes floors
scale to how much football has been played, never below half a match.

- **Top performers**, rebuilt: three boards over one dataset — *Actual*
  (goals, assists, clean sheets, saves, DEFCON, conceded, cards, G+A/90,
  points per £m), *Expected* (xG, xA, xGI, xGC, rates), and *Over/under*, the
  gap, judged per position — keepers and defenders on shutouts, midfielders on
  involvement, forwards on finishing. The gap view carries a scatter against
  the parity line and diverging bars.
- **`/bonus`** — season totals plus the real 3·2·1 split read from each
  gameweek's own feed, bonus per 90, and BPS-per-bonus conversion with the
  plot of who cashes their BPS and who collects it behind somebody else.
- **`/defcon`** — contributions and per-90 rates against the line each
  position must clear (ten for defenders, twelve otherwise), the tackles /
  CBI / recoveries mix, measured threshold crossings from the weeks
  themselves, and bookings.

### V9-J — the preference actually applies ✅
Follow-up on V9-H: the faces/kits switch was wired into the Field and nowhere
else, so flipping to kits still showed photographs on the Planner, in the peek
sheet and on a player profile. That is not a preference, it is a Field
setting.

- Every mark in the app now goes through `PlayerAvatar`: the planner pitch,
  the market table, the price watch, the peek sheet and the player profile
  (via `SelfAvatar`, a client wrapper so a server component can read the
  device preference too). `grep PlayerPhoto` outside those two files returns
  nothing.
- The switch itself appears on the Planner as well, so it can be changed
  where it is being read rather than only back on the Field.
- **Mobile reachability**: `/bonus` and `/defcon` were desktop-nav only,
  leaving them reachable on a phone only through the Field's Top mode. They
  get a subordinate strip above the thumb bar — eight items in the bar itself
  would have put every destination under a 44px target. The live status pill
  moved up to clear it; e2e now pins the stacking order and the tap sizes.

## Outstanding

- Manifold (17) Python escape hatch — deferred until scale.
- Price watch runs on the public net-transfer proxy for everyone; wiring it to
  `lib/server/priceStore.ts` when a database is configured would sharpen it.
- **Production has not been migrated.** The app degrades honestly now, but the
  price gauge, cohort EO, the entry directory and the newsdesk stay empty until
  `pnpm db:migrate` runs against the production `DATABASE_URL`.
