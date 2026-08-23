# GAFFER v4 — completion plan & progress

> Resume file. Source spec: `architecture/GAFFER_V4_SCREEN_SPECS.md` (Field expansion +
> Entry Gate). This file sequences what the spec left unphased, plus the user asks folded in
> after v5 shipped. Gates every phase: lint · typecheck · vitest · build · e2e, one commit each.

## Locked decisions

- **Photos:** the PL trophy (`docs/photos/images.jpeg`) and match ball
  (`docs/photos/FotoJet-2025-06-02T152659.040.webp`) ship **as-is** into `public/` — owner
  accepts the licensing trade-off for a hobby project (not public domain; noted deliberately).
- **Landing copy:** tagline + description paragraphs go; Wordmark → trophy hero → gate.
  "Sample output · illustrative numbers" caption goes; ball photo fills that whitespace band.
- **LiveBar leaves the top:** bottom-right pill on desktop, bottom-centre above the thumb bar
  on mobile, stacked under MomentToast.
- **Rival compare:** strict-numbers discipline applies — every figure rendered from engine
  data, never hand-written prose numbers.

## Phases

### V4-A — Field modes 5+6 ✅ (this commit)
- [x] WebPlayer/Dixon–Coles pipeline extracted from `resolve.ts` into
      `lib/server/buildCorrelationWeb.ts`; the effective-bets card consumes the shared path.
- [x] `simulateWeb` exposes per-player variance; pure `marginalRisk()` = wᵢ(Σw)ᵢ/w′Σw with
      synthetic Σ tests (equal split, variance weighting, correlated pairs, perfect-hedge
      clamp, zero-variance guard) plus a simulateWeb integration bounds test — 13 file tests.
- [x] Mode 5 **Correlation** (`?mode=correlation`): DOM-measured arc layer (ResizeObserver,
      never re-layout) — surge +ρ / flare −ρ, thickness |ρ|, top-24 pairs ≥ 0.15,
      "X.X effective bets / N" stat with Est wrap; `/api/gaffer/web` feeds it lazily via SWR.
- [x] Mode 6 **Risk** (`?mode=risk`): shirt scale 0.78–1.43 by variance share, neutral colour,
      share % pill, portfolio-sd stat with Est wrap.
- [x] Keys 1–6 select the six pitch modes (planner stays click-only; typing-safe); e2e pins
      seven controls + URL persistence for both modes. Gates: vitest 219✓ · e2e 44✓.

### V4-B — Peek sheet + live diff-polling + OG ✅ (this commit)
- [x] `components/gaffer/field/PeekSheet.tsx` — ONE shared bottom sheet for token taps:
      crest tile, live-points hero with count-up/wash, fixture state, EO (Est-wrapped when
      estimated), minutes/BPS/swing/leverage/bonus grid, DEFCON meter, 44px close + Player
      page action. Pitch and bench tokens are buttons opening it; EOScatter dots route to
      the same sheet (table toggle stays the a11y path).
- [x] Diff-polling: points pill count-ups via AnimatedNumber (keyed remount replays the
      volt wash, reduced-motion safe); finish fade is a 600ms opacity transition on done
      tokens; ⇅ stays drawn-once; polling already pauses when hidden.
- [x] `/api/og/field/[entry]` per-entry share card (ImageResponse) degrading to name-only
      when picks/upstream are unavailable; never errors the share. e2e pins the peek flow
      and the OG content-type. Gates: vitest 219✓ · e2e 48✓.

### V4-C — Entry Gate + homescreen ✅ (this commit)
- [x] Landing rebuilt per locked decisions: tagline + description gone; trophy photo hero
      (`public/images/trophy.jpeg`, owner-supplied); gate centred; "Sample output" caption
      gone; the match ball fills the closing whitespace as a broadcast band
      (`public/images/ball.webp`).
- [x] Gate upgrades: live paste-hint chip ("Looks like a team link" / league / ID);
      `parseGateInput` (entry URL → league URL → bare digits, 6 unit tests); validation now
      ends in a CONFIRMATION chip (crest via favourite club · team · manager · region · rank
      — "Is this you?") written to cookie+recents only on confirm; league paste → standings
      page-one pick-list with filter (>500k politely refused, empty standings honest);
      ID-explainer sheet with the three annotated routes (web / app share / league link).
- [x] Cookie max-age 400d per spec. Name search stays deferred (coverage copy only).
- [x] e2e: hint chip, confirmation flow, explainer sheet, trophy+ball imagery (52✓).
      Deferred: header multi-team switcher (recents cover switching via landing).

### V4-D — LiveBar relocation ⬜
- [ ] Top sticky strip removed; moment-aware pill bottom-right (desktop) / bottom-centre
      above thumb bar (mobile); MomentToast stacks above it; content from v5-G weekMoment.

### V4-E — League rival compare ✅ (this commit)
- [x] League rows deep-link `/field?mode=points&compare={entryId}` (you-row exempt) with a
      header hint "tap a manager to compare"; FieldClient auto-loads `?compare=` once.
- [x] `lib/server/buildRivalSquad.ts` + `/api/gaffer/rival`: the rival's picks through the
      same `buildLiveSquad` pipeline (projected auto-subs, effective multipliers, provisional
      bonus, transfer costs) returning SquadRow-shaped rows — the Field renders them with the
      same token. Ownership is your exposure and stays yours-only (rival rows carry eo: 0 and
      always render in points mode).
- [x] Head-to-head header: You total · signed gap (surge/flare) · rival total from their real
      entry name, plus a Field/Table toggle. Field view = two XIs on one pitch with live rival
      tokens (captain arcs, bonus dots, sub glyphs, shared dimmed on halfway); Table view =
      You|Them columns with fixture state, live points, provisional-bonus asterisk, ⇅ and C.
- [x] e2e pins the deep-link and the honest no-picks fallback (54✓).

### V4-F — v3 debt carried into the queue ✅ (this commit, except Manifold)
- [x] Feature 18 **Crowding** (`lib/quant/crowding.ts`): per-position s_p=EO/ΣEO → HHI,
      effective picks 1/HHI, entropy/evenness, top-pick callout; 5 tests pin split/collapse/
      monopoly/empty markets. Wired as the "crowding" ask card.
- [x] Feature 19 **WPA** (`lib/quant/wpa.ts`): paired copula sim — both XIs share scoreline
      draws, leave-one-out WPA per player on the same matrix (independent sims lie; these
      don't). `simulateWeb` gains keepDraws for the raw matrix. 6 tests pin determinism,
      symmetry, dominance, sign of swings, shared-fixture pairing, empty-side nulls.
- [x] Wired user-visible: "crowding" + "wpa" registry cards, router intents (rival-entry
      extraction), resolver cards (auto-rival = neighbour above you in your first classic
      league), AskBar renderers. `buildWebContext` extracted as the shared DC-web builder
      (multipliers included). Router tests pin both intents. Gates: vitest 237✓ · e2e 54✓.
- [x] Feature 10 **Twin Study** (`lib/engines/twinStudy.ts` + cohort extension): new
      `cohort_entry` table (migrations 0002-0004: per-entry elements/counts/cost/bank/FT +
      settled outcome gw_points/arm); the cohort builder now persists per-entry rows
      alongside EO aggregates; `settleCohortOutcomes` runs resumably inside the finalise
      cron (09:10-09:19 ticks) deriving the decision arm (transfer/hit/chip/captain/hold)
      per entry; pure pairing engine pins ≥13/15 overlap ∧ ±£0.5m bank ∧ ±1 FT with
      mean/median/sd per arm, n<100 greys out, observational labelling (9 tests). Wired as
      the "twin-study" ask card (registry/router/resolver/renderer).
      ⚠ migrations 0002-0004 need `pnpm db:migrate` on the production DB before the card
      returns data — until then the resolver honestly returns null (no rows).
- [ ] Manifold (17) stays deferred (Python escape hatch).

## Cross-cutting rules (every phase)
Zero raw hex outside globals.css · skew/gloss/bevel chrome only · one hero figure per screen ·
heat blue→green · `<Est>` on estimates · reduced-motion stops everything · charts hand-built SVG
with table toggles · buttons ≥44px centred on mobile · audit lenses (data · design · a11y ·
states) before each commit.
