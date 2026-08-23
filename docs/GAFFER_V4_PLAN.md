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

### V4-A — Field modes 5+6 ⬜ (next)
- [ ] Extract the WebPlayer/Dixon-Coles pipeline out of `resolve.ts` effectiveBets into
      `lib/server/buildCorrelationWeb.ts`; resolver consumes the shared path (behaviour pinned).
- [ ] `simulateWeb` exposes per-player variance; pure `marginalRisk()` = wᵢ(Σw)ᵢ/w′Σw with
      recovery tests (independents ~equal share, variance dominates).
- [ ] Mode 5 **Correlation** (`?mode=correlation`): SVG arc layer over the pitch — surge +ρ /
      flare −ρ, thickness |ρ|, header stat "X.X effective bets / 11".
- [ ] Mode 6 **Risk** (`?mode=risk`): token SIZE encodes marginal variance contribution;
      neutral colour (size is the encoding, never hue).
- [ ] Keys 1–6 select modes (reduced-motion safe); e2e asserts six controls + URL state.

### V4-B — Peek sheet + live diff-polling + OG ⬜
- [ ] One shared Sheet for token taps: player mini-card (state, stats, swing, quick actions);
      chart tooltips route to the same component.
- [ ] Diff-polling: animate ONLY changed tokens on poll (count-up + wash, finish fade 600ms,
      auto-sub ⇅ drawn once); paused when hidden; reduced-motion static.
- [ ] `/api/og/field/[entry]` — per-entry OG image via ImageResponse (static /field OG stays).

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
