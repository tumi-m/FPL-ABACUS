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

### V4-C — Entry Gate + homescreen ⬜
- [ ] Landing rebuild per locked decisions (trophy hero, gate centred, ball photo band).
- [ ] Gate upgrades: paste hint chip ("Looks like a team link"), validation CONFIRMATION chip
      (team · manager · rank — "is this you?") written before storage/nav, ID-explainer sheet
      (3 annotated routes), league-URL paste → standings pick-list, multi-team switcher.
- [ ] Name search stays deferred (coverage copy only) until traffic fills the index.

### V4-D — LiveBar relocation ⬜
- [ ] Top sticky strip removed; moment-aware pill bottom-right (desktop) / bottom-centre
      above thumb bar (mobile); MomentToast stacks above it; content from v5-G weekMoment.

### V4-E — League rival compare ⬜
- [ ] League detail rows deep-link `/field?mode=points&compare={entryId}`.
- [ ] `lib/server/buildRivalSquad.ts`: rival picks → `buildLiveSquad` + `projectAutoSubs` +
      `effectiveMultipliers` (engines already exist).
- [ ] Side-by-side You|Them panel: Field view (two half-pitches) OR Table view (player ·
      fixture · live pts · bonus · subs ⇅ · captain C) with gap header.

### V4-F — v3 debt carried into the queue ⬜
- [ ] Feature 18 Crowding index + 19 WPA engines (pure TS, tested, ask-card wired).
- [ ] Twin Study (10): cohort 30k sample extension in Postgres + cron.
- [ ] Manifold (17) stays deferred (Python escape hatch).

## Cross-cutting rules (every phase)
Zero raw hex outside globals.css · skew/gloss/bevel chrome only · one hero figure per screen ·
heat blue→green · `<Est>` on estimates · reduced-motion stops everything · charts hand-built SVG
with table toggles · buttons ≥44px centred on mobile · audit lenses (data · design · a11y ·
states) before each commit.
