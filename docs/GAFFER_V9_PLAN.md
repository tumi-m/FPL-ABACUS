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
- **Bonus** — season totals plus the real 3·2·1 split read from each
  gameweek's own feed, bonus per 90, and BPS-per-bonus conversion with the
  plot of who cashes their BPS and who collects it behind somebody else.
- **DEFCON** — contributions and per-90 rates against the line each
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
  got a subordinate strip above the thumb bar — eight items in the bar itself
  would have put every destination under a 44px target. The live status pill
  moved up to clear it. (Superseded by V9-K, which moved the boards onto the
  Field and retired the strip.)

### V9-K — the Field pays for what it shows ✅
The app was slow to first paint and a phone lost a strip of every screen to
floating chrome. Three separate causes, three fixes.

**The rank curve stopped being serial.** `getRankCurveBundle` sampled 27
log-spaced standings pages one at a time with a 120 ms sleep between each —
about four seconds of deliberate waiting on the critical path of every
Matchday and Field render. It now runs four at a time with no sleeps, and the
warm cron primes it (plus the season fixture list) so a page usually finds it
cached.

**Nothing that merely improves a page can hold it up.** `lib/server/deadline.ts`
gives enhancements a 1.5 s budget: the rank curve, the cohort EO sample and the
swing event log resolve to an honest empty rather than blocking the render, and
because the cache underneath is stale-while-revalidate the slow call still
finishes and warms the next one. `buildMatchday` also stopped awaiting five
things in sequence — entry, transfers, curve, events, EO and the last snapshot
now go out in one wave.

**The boards are fetched, not shipped.** Top performers sent the whole
selectable market — roughly seven hundred players with their season lines — in
the RSC payload of every single Field view, whether or not anybody opened the
board. `GET /api/gaffer/boards?board=top|bonus|defcon` serves them on demand
behind a two-minute browser cache; the Field renders the pitch first and the
board arrives when it is asked for.

**Bonus and DEFCON came home.** They are Field modes now, next to Risk, on the
same segmented control (keys 1–9) with their own headings and skeletons. The
old routes `permanentRedirect` to `/field?mode=bonus|defcon`, so nothing that
was linked or bookmarked breaks. The desktop nav entries and the mobile
stat-board strip are gone with them, and in a board mode the pitch's own
controls — the compare box, the duplicate artwork switch and the squad charts
below — step out of the way.

**The status pill stopped sitting on the page.** It was `position: fixed` above
the thumb bar on every screen, permanently covering a band of content on a
phone for a number the header already carried. It is a header chip now
(`StatusChip`), with the fuller read on the landing page (`StatusPanel`, loaded
client-side through `/api/gaffer/status` so the team-ID gate never waits on the
FPL API). e2e pins that nothing but the header and the thumb bar is fixed
furniture.

### V9-L — the header does less, the bundle carries less ✅

**The Field stopped saying "The Field".** The lower third announced the page
you were already looking at. The heading stays in the document for screen
readers and the outline; on screen the bar keeps only its job — pick a
gameweek, read the phase.

**The gameweek is a picker, not a pair of arrows.** Reaching GW12 from the
current week took eleven taps through a stepper. It is one control listing
every gameweek to date, and on a phone it opens the platform's own wheel.
Choosing the current gameweek drops `?gw=` rather than pinning a historical
view of the present. `MatchdayModel.event` gained `latest` so a historical
view knows what it can navigate back to.

**Ask wears the badge.** The button read "Ask ?", which looked like help
rather than like the gaffer. `GafferBadge` puts the same mark the wordmark
carries where the question mark was, sized as a glyph so nothing re-lays out
around it.

**Three splits, one revert.** Measured on a mobile viewport against a local
mirror, JavaScript actually downloaded per page:

| | before | after |
|---|---|---|
| `/field` | 229 kB | 205 kB |
| `/live` | 204 kB | 184 kB |
| `/planner` | 210 kB | 190 kB |

- The Ask bar lives in the shell, so its ten chart components and all of d3
  were on the critical path of *every* screen before anybody had asked
  anything. `AskCards.tsx` holds the renderer now and loads when an answer
  actually carries a card — that is most of the saving, and it applies
  app-wide.
- The three market boards and the peek sheet load with the thing that needs
  them: a board's chunk arrives with its data, the sheet's on the first token
  tap (it brings the dialog primitive with it).
- Splitting the below-fold charts the same way was tried and **reverted**: it
  duplicated shared chart code across nine chunks and cost `/field` about
  30 kB rather than saving any.

**Six dependencies removed** — `motion`, `geist`, three unused Radix packages
and `d3-interpolate` were in `package.json` and imported nowhere.

### V9-M — the week's last moment, and where the Arcade lives ✅

**"Autopsy" is now "Digest".** The moment after a gameweek settles was named
for a post-mortem; the app is not there to tell you your week died. Same
phase, same trigger, a word that reads as reviewing rather than mourning.

**The Arcade came off the thumb bar and hangs off the badge.** Six
destinations crowded the bar; five give every tap target room. The Arcade —
where you pick which gaffer talks to you — is now reached from the brand in
the header, which is a picture of the four gaffers. That left `/` unreachable
from inside the app, so the gate stays available two ways: the team pill in
the desktop header (it names your team, which is the obvious thing to tap to
change it) and a "Change team" action on the Arcade itself, which is the
route on a phone where that pill is hidden.

**The header stopped overflowing at 390px.** Measured, not guessed: the right
cluster ended at x=409 in a 390-wide viewport, clipping the theme control. The
three-way theme radio group is one cycling button below `sm` — same three
modes, ninety pixels back — and the cluster now ends at 374 with the gutter
intact.

### V9-N — say what a number is an average of ✅

**The league summary names its denominator.** "Avg 60.6" over a league table
invites you to read it as the league average when it is the average of
whatever is loaded — after one page, the top fifty. The figures were always
computed over the rows shown; now they say so. The strip carries "over top 50
managers", "over all 137 managers" once every page is in, or "over 10 matching
managers" under a filter, and the scope grows with each Load more so the
number and its denominator never drift apart.

FPL leaves `max_entries` null on public leagues, but once the last page is
loaded the loaded set *is* the league — so the header's manager count fills in
at that point rather than staying blank.

**Bonus stopped being yellow.** `--amber` carried four meanings: bonus, the
yellow card, the doubtful flag and price movement. At token size a brace of
bonus next to a booking was two gold marks the eye had to read twice. Bonus
gets `--bonus` (the previously unused magenta) everywhere it is meant — the
pitch pips, the projected-bonus asterisk, the bonus leaders chart and the
whole Bonus board. Nothing else on a pitch is pink, and the card stays the
colour a card has to be.

**The event badges got bigger.** Nine pixels was too small to tell a ball from
a boot at arm's length. Thirteen with tighter padding keeps the same footprint
— three badges still fit under a token — with a glyph half again as large. The
strip sizes as one: a goal drawn larger than the shield beside it would read as
a broken row rather than a louder mark.

### V9-O — the Board became a fixture ticker ✅

The Board gridded your own fifteen players. That answers "how do my fixtures
look", which is the smaller half of the question a fixture ticker exists for:
you cannot see a club you do not already own, so it was useless for the thing
tickers are actually opened to do — find who to buy. Rebuilt around the twenty
clubs, with your squad marked on it rather than being the whole grid.

**Attack and defence are scored apart.** A club can be a fine attacking
fixture and a poor defensive one, and one number for both is the compromise
that makes most tickers useless for picking defenders. `lib/engines/fixtureTicker.ts`
(+15 tests) scores an attacking run as the goals the model expects that club to
score across it, and a defensive run as the clean sheets it expects to keep —
the Poisson shutout probability e^(−xGA) summed over the matches. Both are
quantities you can read on their own terms, which "3.4 FDR" is not.

**Ranked by the run, over a range you set.** Best runs float to the top, with a
bar so the gaps between them are visible. The range is two ends you pick rather
than a fixed horizon, and doubles sum while blanks score nothing and get their
own tone — a blank is a hole, not a middling fixture, and it is kept out of the
quantile cuts so it cannot drag ordinary weeks green.

**It answers on the tap.** The whole rest of the season, all twenty clubs and
both halves of every projection ship in one payload — small — so switching
side, moving the range and re-sorting are local state. A ticker is scanned by
fiddling with it; one that costs a request per toggle is one you give up on.

**Your fifteen survived, position-aware.** Keepers and defenders read on clean
sheets, everyone else on goals, hardest run first — the one thing a club-level
grid structurally cannot tell you.

Club rows link through to `/players?club=<id>`, which the explorer now honours
(and its search matches club codes, so "ars" finds Arsenal's players).

## Outstanding

- Manifold (17) Python escape hatch — deferred until scale.
- Price watch runs on the public net-transfer proxy for everyone; wiring it to
  `lib/server/priceStore.ts` when a database is configured would sharpen it.
- **Production has not been migrated.** The app degrades honestly now, but the
  price gauge, cohort EO, the entry directory and the newsdesk stay empty until
  `pnpm db:migrate` runs against the production `DATABASE_URL`.
