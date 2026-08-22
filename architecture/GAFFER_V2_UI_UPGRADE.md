# GAFFER v2 — "FLOODLIGHT"
## UI / UX overhaul, generative interface layer, and the future-gameweek planner

**Companion artifact (rendered, copy the CSS from it):** the Floodlight style guide + mockups.
**Read order for the agent:** §1 → §2 → §3 → §5 before touching any component. §9 and §10 are new features. §11 is the feature backlog.

---

## 0. What I inspected, and the honest diagnosis

I could reach the deployed markup but not render it (no browser bridge in this session, and the sandbox can't route to `*.vercel.app`). What came back confirms you built the v1 spec faithfully — GAFFER wordmark, "Your gameweek, explained.", Swing Engine / Leverage Board / Multiverse preview cards, team-ID gate.

**So the grey is my fault, not your build's.** The v1 design system said, in as many words: *"Data is the only saturated thing on screen. Chrome is greyscale; colour means something."* That is the correct principle for a Bloomberg terminal and the wrong one for something people should *want* to open at 5pm on a Saturday. It produces exactly what you're describing: correct, legible, and lifeless.

Three specific failures, and what replaces them:

| Failure | Why it reads cheap | The fix |
|---|---|---|
| Neutrals on a pure grey axis (`#14171C`, `#A8B0BC`) | Pure grey is the colour of an unstyled default. The eye reads "nobody chose this" | Every neutral carries chroma. The ground is a spruce so dark it reads black — but it is *green* |
| Flat planes, hairline rings, no light | Nothing suggests depth, place, or occasion | A fixed floodlight bloom behind the app, mowing stripes at 2%, and shadows tinted with the accent rather than black |
| No football in the interface | A player row looked like a spreadsheet row | Club colour becomes structural: a rail on every row, a crest tile, a wash on every fixture cell. Twenty palettes you never have to invent |

And one addition that changes the category the product competes in: **§9, the generative interface.** No FPL analytics product ships an interface that assembles itself around your question. That is available to you today and it is a genuine first.

---

## 1. The palette — zero greys, contrast-verified

Derived in OKLCH so the ramps stay perceptually even, then checked against the surface each colour actually renders on.

```css
/* app/globals.css — replace the v1 token block entirely */
:root{
  color-scheme: dark;

  /* Ground: a night pitch. Every value carries green chroma. */
  --bg-base:#01100A;      /* the plane                          */
  --bg-sunk:#000905;      /* wells, tracks, inputs              */
  --bg-raised:#061E18;    /* cards, rows                        */
  --bg-overlay:#1A253A;   /* sheets, popovers — indigo-shifted  */
  --line:#1B3D32;
  --line-hi:#2E5A4B;

  /* Ink: sage-tinted, never neutral */
  --ink-hi:#EBFAED;       /* 17.99:1 on base */
  --ink-mid:#AFCDBB;      /* 11.37:1 */
  --ink-lo:#80A594;       /*  7.16:1 — still AA for body, unlike the v1 muted grey */

  /* Accents: each owns exactly one meaning */
  --lumen:#ACF744;        /* 14.95:1 — YOU, live, primary action */
  --mint:#00E7A0;         /* 11.98:1 — gain, rank improved       */
  --flare:#FF5171;        /*  6.17:1 — loss, threat, risk        */
  --ultra:#907CFF;        /*  6.03:1 — the field, rivals, model  */
  --amber:#FFB825;        /* 11.24:1 — bonus, price movement     */
  --cyan:#28D7F3;         /* 11.21:1 — defensive work, DEFCON    */
  --rose:#FB75BB;         /*  7.75:1 — differential, ownership   */
  --on-accent:#04140C;    /* 14.54:1 on lumen                    */

  /* Fixture heat: indigo → teal → lime. NOT red→green. */
  --heat-1:#4D379B; --heat-2:#2863AB; --heat-3:#29889C;
  --heat-4:#2BAEA1; --heat-5:#59D38C; --heat-6:#B1EF4A;
}

@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]){
    color-scheme: light;
    --bg-base:#F0FAF1; --bg-sunk:#E5F3E8; --bg-raised:#FAFFFB; --bg-overlay:#FFFFFF;
    --line:#CFE2D4; --line-hi:#A9C6B4;
    --ink-hi:#072319; --ink-mid:#3B574C; --ink-lo:#5A7A6D;
    --lumen:#4C8700; --mint:#008D5A; --flare:#D00B37; --ultra:#5F3ADD;
    --amber:#C07100; --cyan:#0083A5; --rose:#C33887; --on-accent:#FFFFFF;
    --heat-1:#705BCD; --heat-2:#4687D8; --heat-3:#54B4CA;
    --heat-4:#5CD5C7; --heat-5:#7DF0AA; --heat-6:#C4FF6D;
  }
}
:root[data-theme="light"]{ /* repeat the light block verbatim so the toggle wins both ways */ }
```

**Rules that keep a colourful UI from becoming noise:**

1. **An accent may only appear where it carries its meaning.** Amber is bonus and price. Always. Cyan is defensive work. Always. If you want colour somewhere and no accent fits, use the club colour — it is already meaningful.
2. **Saturation is a budget.** Ground and ink are tinted but quiet. The loud colour lives in data marks, club rails, and *one* accent per component. A screen where everything glows fails the same way an all-grey screen does: nothing is emphasised.
3. **In light mode, accents are for fills, marks and icons — not body text.** `--lumen` at 4.12:1 and `--amber` at 3.51:1 clear the 3:1 non-text bar but not 4.5:1 for small copy. Text uses ink tokens. (This is the dataviz rule anyway: text never wears the data colour.)

### Fixture heat, and why it isn't red-and-green
Fixture difficulty is the most-looked-at colour in any FPL tool, and almost all of them run red→green — the single worst pair for the ~8% of users with deuteranopia. Indigo → teal → lime gives the identical intuition (dark/cold = hard, bright/warm = easy), is fully separable under every CVD simulation, and looks considerably better.

**Ink rule:** white on steps 1–2, `--on-accent` on steps 3–6. Switch on the step index, never by guessing.

---

## 2. The twelve visual devices

These are what turn tokens into a look. Implement all twelve; each is a few lines.

| # | Device | Implementation |
|---|---|---|
| 1 | **Floodlight bloom** | `position: fixed; inset: 0; z-index: 0` layer with three radial gradients (lumen top-centre 10%, ultra top-right 13%, mint bottom-left 7%). Never scrolls. Costs nothing |
| 2 | **Mowing stripes** | `repeating-linear-gradient(90deg, rgba(172,247,68,.022) 0 64px, transparent 64px 128px)` on the same layer. Invisible until you look for it, and then the whole plane reads as turf |
| 3 | **Club rails** | A 4px full-height bar in the club colour on the left edge of every player row, fixture card and league avatar. This single device does more for "looks like football" than anything else |
| 4 | **Crest tiles** | 34px rounded square filled with the club colour, 3-letter code in `--on-accent`. Use instead of remote crest images on lists — faster, always legible, never a broken image |
| 5 | **Gradient numerals** | Hero figures get `background: linear-gradient(176deg, var(--ink-hi), var(--lumen) 132%)` + `background-clip: text`. Only on the one hero figure per screen |
| 6 | **Accent-tinted shadows** | Never `rgba(0,0,0,…)` alone. `0 18px 40px -18px rgba(0,0,0,.85), 0 0 0 1px var(--line)` for lift; `0 0 0 1px rgba(172,247,68,.35), 0 12px 44px -14px rgba(172,247,68,.30)` for the primary button |
| 7 | **Lit row, not tinted row** | Your row in any table: `background: linear-gradient(90deg, rgba(172,247,68,.16), var(--bg-raised) 46%)` + `inset 3px 0 0 var(--lumen)`. It glows from the left instead of being shaded |
| 8 | **Glass overlays** | Sheets and popovers: `background: rgba(6,30,24,.72); backdrop-filter: blur(20px) saturate(140%)` over the bloom |
| 9 | **Live pulse** | The only continuously animating element in the app, and only while a fixture is actually in play: a 7px lumen dot with an expanding box-shadow ring, 2s |
| 10 | **Meters, not bare percentages** | Any percentage in a table gets a 56px track beside it. A league table with win-probability tracks reads as a race; the same numbers as text read as a spreadsheet |
| 11 | **Position-aware colour** | The same fixture is a different colour on a defender's row than on a forward's row. See §10 |
| 12 | **Reactive aurora** | The bloom's hue shifts with your live state: mint-weighted when your rank is improving, flare-weighted when it's falling, interpolated over 1.2s. Subliminal, and the single most-commented-on thing you will ship |

```css
/* device 12 — drive from a data attribute set by the live poller */
.bloom{ transition: background 1200ms cubic-bezier(.22,1,.36,1); }
[data-trend="up"]   .bloom{ --bloom-a: rgba(0,231,160,.14); }
[data-trend="down"] .bloom{ --bloom-a: rgba(255,81,113,.12); }
```

---

## 3. Club identity system

Twenty colours you never have to invent, tuned for legibility on the dark ground. **The club colour is a decorative identity accent and is always paired with the 3-letter code — never the sole encoder** (three clubs are red, two are white; that's football).

```ts
// config/clubs.ts — keyed by FPL team id (2026/27)
export const CLUB = {
  1:  { code:'ARS', name:'Arsenal',        rail:'#FF3B41' },
  2:  { code:'AVL', name:'Aston Villa',    rail:'#9CC7EF' },
  3:  { code:'BOU', name:'Bournemouth',    rail:'#F0463A' },
  4:  { code:'BRE', name:'Brentford',      rail:'#FF8A5C' },
  5:  { code:'BHA', name:'Brighton',       rail:'#4FA3F7' },
  6:  { code:'CHE', name:'Chelsea',        rail:'#3E7BE8' },
  7:  { code:'COV', name:'Coventry City',  rail:'#7FD8F0' },
  8:  { code:'CRY', name:'Crystal Palace', rail:'#5B8DEF' },
  9:  { code:'EVE', name:'Everton',        rail:'#5C7BFF' },
  10: { code:'FUL', name:'Fulham',         rail:'#F5FBF7' },
  11: { code:'HUL', name:'Hull City',      rail:'#F5A12D' },
  12: { code:'IPS', name:'Ipswich Town',   rail:'#6E9BE8' },
  13: { code:'LEE', name:'Leeds',          rail:'#FFD84D' },
  14: { code:'LIV', name:'Liverpool',      rail:'#FF4D63' },
  15: { code:'MCI', name:'Man City',       rail:'#7CC6F0' },
  16: { code:'MUN', name:'Man Utd',        rail:'#FF6A4D' },
  17: { code:'NEW', name:'Newcastle',      rail:'#DCE9F0' },
  18: { code:'NFO', name:"Nott'm Forest",  rail:'#FF5C6E' },
  19: { code:'TOT', name:'Spurs',          rail:'#8FB4FF' },
  20: { code:'SUN', name:'Sunderland',     rail:'#FF4D5E' },
} as const;
```

Derive three more values per club at runtime and cache them:
```ts
railWash  = `color-mix(in oklab, ${rail} 14%, transparent)`  // row hover, fixture cell tint
railInk   = contrast(rail) > 7 ? 'var(--on-accent)' : '#fff' // text on a crest tile
railGlow  = `0 0 24px -6px ${rail}`                          // selected state
```

---

## 4. Motion

Motion earns its place by confirming that something changed. Nothing decorative.

| Event | Spec |
|---|---|
| Value changes | Count-up over 420ms `cubic-bezier(.22,1,.36,1)`, plus a one-frame lumen wash behind the number |
| Rank improves | Row reorders with Motion `layout`, spring; a mint 2px left edge fades over 900ms |
| Rank worsens | Same, flare edge |
| New swing event | Enters from `translateY(-8px)` + opacity, 240ms. The feed never scroll-jumps — new rows push down, scroll position is anchored |
| Fixture goes live | The club rail on affected rows animates from `--line` to the club colour over 600ms |
| Bloom trend shift | 1200ms colour interpolation (device 12) |
| Sheet open | `translateY(100%)→0`, 240ms, with the backdrop blurring in over 160ms |
| Card hover | `translateY(-2px)` + shadow lift, 90ms. Desktop pointer only (`@media (hover:hover)`) |
| Generative UI stream | Each component fades and rises in as it arrives, staggered 60ms — the interface visibly assembling itself is the whole point (§9) |

`@media (prefers-reduced-motion: reduce)`: count-ups show final values instantly, layout animation off, pulse static, bloom static, stream components appear without stagger. **Test this — it is the most commonly broken accessibility feature in animated dashboards.**

---

## 5. Component recipes

Copy the rendered versions out of the artifact. The contracts:

### `<PlayerRow>`
```
grid-template-columns: 4px 34px minmax(0,1fr) auto auto;
[club rail] [crest tile] [name + meta] [badges] [points]
```
- Badges: `C`/`VC` on lumen, bonus `+3` on amber, `DEF 12` on cyan, `⇅` for a projected auto-sub on ultra.
- Fixture finished → `opacity: .55`. Still to play → a 1px lumen ring.
- Long press / right click → the player peek sheet (§7).

### `<StatTile>`
`label` (uppercase 11px, `.14em`, `--ink-lo`) · `value` (Archivo 800, `wdth 112`, 44px) · `delta` (signed, with arrow glyph **and** word) · optional 12-point sparkline. A radial bloom in the top-right corner via `::after`.

### `<HeatCell>`
```
grid; gap:2px; text-align:center
b: opponent code — UPPERCASE = home, lowercase = away
u: the metric (xPts, or opponent xGC/90)
```
Double gameweek → `inset 0 0 0 2px var(--lumen)` and both opponents stacked. Blank → `--bg-sunk`, no colour at all, so a bad run reads as a hole in the grid.

### `<Meter>`
8px track on `--bg-sunk` with an inset hairline; fill is a gradient between two *meaningful* accents (cyan→mint for DEFCON progress, amber→flare for price pressure).

### `<Est>`
Wraps any modelled number: prepends `~`, adds a dotted underline in `--ink-lo`, and a tooltip naming the method and sample size. **Non-negotiable** — trust is the product.

---

## 6. The chart system — fourteen charts that each answer one question

Hand-built SVG, `d3-scale` + `d3-shape` only. Every chart: one y-axis, a legend when ≥2 series, selective direct labels, a table-view toggle, `role="img"` with a full sentence label, and 2px surface-coloured gaps between touching marks.

| Chart | Form | The question it answers | Encoding notes |
|---|---|---|---|
| `RankCurve` | line | "How has my season gone?" | Log-inverted y. You = lumen 3px + end dot; cohorts = ultra/cyan 2px; deadline gridlines |
| `SwingBars` | diverging horizontal | "What moved my rank today?" | mint right / flare left, sorted by magnitude, zero rule in `--line-hi` |
| `LiveRankRibbon` | area band | "Where could I finish?" | p5–p95 Monte Carlo fan in ultra at 10%, median line solid, your current point marked |
| `FieldDistribution` | area + marker | "Is 62 good?" | The field's GW-score density, your score marked with a labelled needle |
| `EOScatter` | dot | "Where am I exposed?" | x = EO in top-10k, y = your multiplier − EO. Quadrants labelled: *Template*, *Active bet*, *Ignored*, *Trap* |
| `DefconRate` | column + threshold rule | "Does he actually hit 10?" | Per-match DEFCON count with the threshold as a dashed lumen rule; bars above it filled cyan, below in `--line-hi` |
| `Defcon90` | bullet | "Per 90, who is best?" | Value bar + cohort median tick + position-percentile band |
| `PriceGauge` | meter + velocity spark | "Will he rise tonight?" | Cumulative pressure to ~220k, with today's velocity as a 24h sparkline underneath |
| `OwnershipFlow` | stacked area | "Who is the crowd buying?" | Net transfers per day across the top 20 movers, club-coloured |
| `FixtureSwing` | slope | "When do his fixtures turn?" | Opponent xGC/90 across the next 8, slope-coloured by direction |
| `xGvsActual` | dual-line, one axis | "Is he due, or is he finished?" | Cumulative xGI vs cumulative returns — same unit, so one axis is legal |
| `CaptainMatrix` | heat grid | "What did my league captain?" | Managers × gameweeks, cell = captain's club colour, points as the label |
| `ChipTimeline` | lane chart | "When is everyone playing chips?" | One lane per manager, chips as club-coloured pills on a GW axis |
| `SeasonFingerprint` | generative radial | "What kind of manager am I?" | See §8 — canvas, deterministic per entry |

**One rule that fixes most bad FPL charts:** never plot two different units on two y-axes. Points and xPts share a unit — legal. Price and ownership do not — two charts, or index both to 100.

---

## 7. The Field View (you asked for this specifically)

FPL Gameweek's and FPL Live's pitch views are the best thing either product has. Here is a better one.

**Base pitch:** not a green rectangle. A `radial-gradient` lit from the top (floodlight), with mowing stripes at 3% and penalty-area/centre-circle lines drawn as 1px `--line-hi` SVG at 40% opacity. It should look like a pitch photographed at night, not a diagram.

**Player token:** club-coloured shirt shape (SVG, filled with the club rail and a 12% darker sleeve), squad number, name below, live points in a pill on the shoulder.

**State encoding, all simultaneous and all readable:**
- **Yet to play** → a soft lumen ring + 100% opacity
- **On the pitch now** → the club rail pulses at 2s
- **Finished** → 55% opacity, ring removed
- **Captain** → a lumen armband arc on the shirt, not a letter in a corner
- **Auto-sub projected** → an ultra `⇅` chevron between the two shirts, animated once when it first appears
- **DEFCON progress** → a cyan arc around the token, filling toward the threshold
- **Bonus** → an amber dot for each provisional bonus point, top-right of the token

**Four modes on one segmented control — this is where it beats everything else:**

| Mode | What the pitch shows |
|---|---|
| **Points** | Live points per player (the default, what everyone else does) |
| **Ownership** | Each token tinted by EO in the selected cohort — your template players fade toward the ground, your differentials burn bright. One glance tells you how brave your team is |
| **Swing** | Each token sized and coloured by ranks gained/lost so far. Your gameweek as a heat map of consequence |
| **Leverage** | Each token shows the rank swing *still available* — expected value of the minutes remaining. The second-half decision screen |

**Compare mode:** two XIs on the same pitch, yours on the near half, a rival's on the far half, shared players drawn on the halfway line and dimmed, differentials pulled forward and lit. Tap either half to swap the rival. This is the mini-league screen people will screenshot.

---

## 8. Generative visuals — procedural, data-driven, unique per user

These are canvas/WebGL, seeded deterministically so the same input always draws the same image (screenshots reproduce, and you can render them server-side for share cards).

### 8.1 Season Fingerprint
A radial composition where each of the 38 gameweeks is a spoke. Spoke length = points, hue = your rank direction that week (mint→flare), thickness = transfers made, and a lumen ring marks each chip. Bench points draw as a faint inner shadow ring.

Every manager's season produces a genuinely different image. Nobody in FPL ships this. It is the DNA page's hero and the best share asset you will ever have.

```ts
// deterministic seed so screenshots reproduce and OG rendering matches the app
const seed = mulberry32(entryId);
```

### 8.2 Gameweek Sigil
A smaller mark generated from one gameweek's swing sequence: each event becomes a stroke whose angle is the minute, length the rank delta, colour the direction. A 90-minute match becomes a glyph. Used as the Gameweek Film's cover and the `/film` OG image.

### 8.3 Kit Weave
The page background behind `/squad` and `/dna` is a woven pattern generated from your fifteen players' club colours, weighted by minutes played. Your team literally colours the app. Regenerates on every transfer.

### 8.4 Reactive aurora
Device 12 above, but driven by the simulation: hue from your live rank trend, intensity from `|expected swing still available|`. When you have a captain on the pitch in the 88th minute with everything to play for, the whole app is quietly glowing.

**Guardrails:** all four run on `<canvas>` at `devicePixelRatio` capped at 2, are static images once drawn (no rAF loop except the aurora, which runs at 12fps), and are skipped entirely under `prefers-reduced-motion` and on `save-data`.

---

## 9. The generative interface — the actual first

No FPL analytics product has an interface that assembles itself around the user's question. This is the differentiator that makes the app impossible to categorise as "another tracker".

**The critical architectural decision: the model chooses components and parameters. It never produces numbers.** Every figure rendered comes from your existing engines. This keeps the product trustworthy, keeps token cost near zero, and means a hallucinating model produces a *wrong choice of chart*, never a wrong statistic.

### 9.1 Architecture

```
User asks:  "should I captain Saka or Haaland this week?"
                    │
        ┌───────────▼────────────┐
        │  Intent router (free)  │  regex + embedding match against ~40 known
        │  lib/genui/router.ts   │  question shapes. Hits ~80% of real questions.
        └───────────┬────────────┘
             miss   │   hit ──────────────► recipe: [CaptainCompare, LeverageBoard]
                    ▼
        ┌────────────────────────┐
        │  Model (tool calling)  │  tools = the component registry.
        │  Cheap model, 1 call   │  Output: an ordered list of component calls
        └───────────┬────────────┘  with typed params. No prose, no numbers.
                    ▼
        ┌────────────────────────┐
        │  Resolver              │  For each call: Zod-validate params → run the
        │  lib/genui/resolve.ts  │  engine → attach real data → stream the RSC
        └───────────┬────────────┘
                    ▼
            Components stream in, staggered 60ms
```

### 9.2 The component registry

```ts
// lib/genui/registry.ts
export const REGISTRY = {
  captain_compare: {
    describe: 'Side-by-side captaincy comparison for 2-4 players: xP, ceiling, floor, EO, and the rank swing of each outcome.',
    params: z.object({ elements: z.array(z.number()).min(2).max(4), gw: z.number().optional() }),
    resolve: async (p, ctx) => ({ rows: await captainCompare(p.elements, p.gw ?? ctx.gw, ctx.entry) }),
    Component: CaptainCompare,
  },
  leverage_board:   { /* … */ },
  fixture_board:    { describe: 'Position-aware fixture heat grid for a set of players or clubs over N gameweeks.', /* … */ },
  price_watch:      { describe: 'Price-change pressure and ETA for specific players.', /* … */ },
  defcon_profile:   { describe: 'Defensive-contribution hit rate, per-90 rate and threshold distribution.', /* … */ },
  ownership_shift:  { describe: 'Ownership and net-transfer momentum over a date range.', /* … */ },
  transfer_sim:     { describe: 'Simulate one or more transfers: xP delta, EO exposure delta, variance delta, hit payback.', /* … */ },
  rival_radar:      { /* … */ },
  squad_field:      { describe: 'The pitch view in one of four modes: points, ownership, swing, leverage.', /* … */ },
  multiverse:       { /* … */ },
  rank_curve:       { /* … */ },
  differentials:    { /* … */ },
  chip_advice:      { /* … */ },
  blank_double:     { describe: 'Blank and double gameweek detection over a horizon.', /* … */ },
  answer_note:      { describe: 'One short sentence of framing. Max 200 chars. Use at most once, first.', /* … */ },
} as const;
```

### 9.3 The system prompt (keep it this short)

> You select interface components to answer a Fantasy Premier League question. You do not answer in prose and you never state statistics — the components carry all data.
> Call between 1 and 4 components, ordered most-relevant first. Prefer one precise component over three vague ones.
> If the question names players, pass their element ids. If it names a horizon, pass it. If you cannot map the question to any component, call `answer_note` alone explaining what you'd need.
> Never invent an element id. Ids are supplied in context.

Context injected: current GW, phase, the user's 15 element ids with names, and a compact name→id index for the top ~300 players by ownership. That's ~2k tokens; everything else stays server-side.

### 9.4 Where generative UI appears in the product

1. **The Ask bar** — pinned in the header, `⌘K` or tap. This is the primary surface.
2. **Empty states** — instead of "no data", offer three generated starting questions relevant to the current phase ("Who should I captain?" pre-deadline; "What's still to play for?" mid-match).
3. **Post-gameweek** — the Film's last act is generated: the three components that best explain *your* particular gameweek, which differ per manager.
4. **Deadline Desk triage** — the `ACT NOW` lane's contents are a generated composition, so a user with three injured players sees a different desk than a user with a price problem.

### 9.5 Cost, caching and guardrails

- **Router first.** ~80% of questions never reach a model.
- **Cache by shape,** not by string: `hash(intent, params, entry, gw)` → 10-minute TTL. Two users asking "captain Saka or Haaland" hit the same cache entry.
- **Rate limit** 20 model-backed questions per IP per hour via Upstash. The router path is unlimited.
- **Timeout** the model call at 4s; on failure fall back to the router's best guess and render that.
- **Never** let the model write to anything. It selects and parameterises. Read-only, always.
- Cheapest capable model. This is a classification task, not a reasoning task.

---

## 10. The Board — future gameweek planning (new feature)

The planner is where FPL managers spend their weekday evenings, and it is where the official app is weakest — it offers literally nothing. Everything below is buildable from data you already have.

### 10.1 The core idea: position-aware fixture colour

Every ticker in the market colours a fixture with a single difficulty number. That number is wrong twice over: it is set before the season and rarely updated, and it pretends a fixture is equally hard for a defender and a striker.

**Colour each cell by the metric that matters for that player's position:**

```ts
// lib/engines/fixtureModel.ts
// Rolling 38-match window, shrunk toward the league mean early in the season.
const attackerDifficulty = (opp: Team) => oppXGCper90(opp, venue);   // how much they concede
const defenderDifficulty = (opp: Team) => oppXGper90(opp, venue);    // how much they create
const keeperDifficulty   = (opp: Team) => oppXGper90(opp, venue);    // same as defenders

difficulty = shrink(rolling, leagueMean, k = 6 matches) * venueAdj;  // home 0.92, away 1.10
heatStep   = quantile(difficulty, LEAGUE_DISTRIBUTION);              // 1..6 → --heat-N
```

The same fixture is therefore a different colour on Gabriel's row than on Watkins's row. That is the truth, and no single-number ticker can express it.

**Three switchable colour models** (segmented control, top-left):
- **xG model** (default) — as above.
- **FDR** — the official integer, for people who want the familiar view.
- **Odds** — implied clean-sheet and anytime-scorer probability, if you later add an odds source.

### 10.2 The grid

Rows = your 15 (plus any players on your watchlist, in a second section). Columns = the next N gameweeks (6 / 8 / 10 / to end of season).

Each cell shows:
- Opponent code — **UPPERCASE = home, lowercase = away** (a convention FPL players already read instantly)
- The chosen secondary metric underneath: `xPts` (default), `xGC/90`, `xG/90`, `CS%`, or `xMins`
- Double gameweek → lumen inset ring, both opponents stacked
- Blank → sunk surface, no colour — bad runs appear as holes in the grid

A **column footer** per gameweek: your projected XI score, and how many of your 15 actually have a fixture.

### 10.3 Staging transfers on the grid

- Drag a player row out, drop a replacement in from the search tray. The move is **staged at a gameweek**, not applied.
- A staged transfer draws as a band across the gameweeks it applies to, with the **payback point marked** — the GW at which cumulative xP gain overtakes the hit cost. You see the hit and the horizon in one glance rather than doing arithmetic.
- The ledger updates live: free transfers remaining (banking to 5), bank, hits planned, horizon xPts, and **delta vs doing nothing** — that last number is the one that actually decides.

### 10.4 Chip lane

A horizontal lane above the grid. Drag a chip onto a gameweek to see projected gain. Rules encoded as constraints, not warnings:
- Set 1 (WC/FH/TC/BB) expires at GW19 → drawn as a **hard wall** in the lane; you cannot drop a set-1 chip past it.
- Free Hit cannot sit in consecutive gameweeks.
- Bench Boost gain = projected bench points that GW; Triple Captain gain = projected captain xP.
- Blank/double detection auto-suggests candidate gameweeks and marks them in the lane.

### 10.5 The solver (ship last, time-box it)

Greedy + local search over the horizon, maximising `Σ xP − hitCosts` subject to budget, 3-per-club, formation validity and the free-transfer schedule. Run it server-side with a 3-second budget, return the top 3 paths, and label it **suggestion** with its assumptions listed. Never auto-apply. A wrong suggestion presented as an answer costs more trust than no suggestion at all.

### 10.6 Sharing
Every board state encodes to the URL (squad + staged moves + horizon), so a plan is a link. This is how planners spread.

---

## 11. Information architecture — making it feel integrated

Right now the app is a set of pages. Three changes make it one product:

1. **The player peek.** Any player name anywhere — swing feed, league table, board cell, chart tooltip — opens the same sheet: live stats, DEFCON progress, ownership, price pressure, next 8 fixtures, xP breakdown, and one-tap "add to board". Build it once; wire it everywhere. This is the single highest-leverage integration change.
2. **Cross-screen context.** The team ID, gameweek and selected cohort live in one Zustand store and persist across navigation. Selecting "top 1k" on Matchday means the league table, the board and the player explorer are all showing top-1k EO when you get there.
3. **The Ask bar in the header on every screen** (§9), pre-seeded with context from the current screen — so on the Board it suggests fixture questions, on Matchday it suggests live ones.

**Navigation:** five items, not eight. `Matchday · Field · Board · Leagues · Ask`. Squad folds into Field, Deadline folds into Board, Players folds into the peek + Ask, DNA lives behind your avatar.

---

## 12. Build order

| # | Task | Gate |
|---|---|---|
| 1 | Replace the token block; delete every grey hex in the codebase (`grep -rn "#[0-9A-Fa-f]\{6\}" app components`) | Zero raw hex outside `globals.css` |
| 2 | Bloom layer + mowing stripes + accent shadows | The plane has depth in both themes |
| 3 | `config/clubs.ts`; add rails + crest tiles to every row component | Every list reads as football |
| 4 | Typography: Archivo (`wdth,wght`) + Manrope, tabular numerals in tables only | Hero figures use the width axis |
| 5 | Rebuild `StatTile`, `PlayerRow`, `HeatCell`, `Meter`, buttons, tabs against the new tokens | Matches the artifact |
| 6 | Motion pass incl. reduced-motion | Verified with the OS setting on |
| 7 | Field View with 4 modes + compare | §7 complete |
| 8 | Chart system — the 14 charts in §6 | Table view on each |
| 9 | The Board §10 (grid → staging → chip lane → ledger; solver last) | Shareable URL state |
| 10 | Generative interface §9 (router → registry → resolver → Ask bar) | Router handles 80% without a model call |
| 11 | Generative visuals §8 (Fingerprint first — it's the share asset) | Deterministic across renders |

---

## 13. Acceptance — how you know it worked

- [ ] `grep` finds no raw hex outside `globals.css`, and no token whose name contains "grey"
- [ ] Screenshot any screen, desaturate it: the layout still reads. (Colour is enhancing structure, not carrying it alone)
- [ ] Every accent on screen can be explained in one word by pointing at it
- [ ] The Field View's four modes each answer a different question
- [ ] A fixture cell is a different colour for a defender than for a forward
- [ ] The Ask bar answers "who should I captain" without a model call
- [ ] Reduced motion genuinely stops everything
- [ ] Both themes verified at 375 / 768 / 1440
- [ ] Someone who doesn't play FPL says "what is that"
