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

## Outstanding

- Manifold (17) Python escape hatch — deferred until scale.
- Price watch runs on the public net-transfer proxy for everyone; wiring it to
  `lib/server/priceStore.ts` when a database is configured would sharpen it.
