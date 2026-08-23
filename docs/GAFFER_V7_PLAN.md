# GAFFER v7 — asset overhaul + Field/ask immersion plan & progress

> Resume file. Owner-driven asset + immersion batch after v6. Sources:
> `docs/gaffers/` + `docs/` (text-baked sheets — unusable as crops) and
> `docs/error renders/` (text-free frame sheet + badge photo). Gates every
> phase: lint · typecheck · vitest · build · e2e, one commit each.

## Locked decisions

- **Avatar pipeline:** `scripts/extract-avatars.mjs` crops idle + 2 talk frames
  per persona from the text-free sheet via green-screen scan, nearest-neighbour
  256px. Registry paths in `lib/ai/personas.ts` are the single source of truth;
  talk frame 0 is the idle pose so frame-flip works for every persona.
- **Trophy photo retired** (owner: distorted). Landing hero is CSS floodlight
  ramp + wordmark + gate; the gaffer lineup band carries the imagery.
- **Historical gameweeks are points-mode only** — no past-GW rank curve exists,
  so swing/leverage/ownership/correlation/risk/planner disable with a title
  hint rather than showing wrong magnitudes.
- **Club theme is chrome-only** — `--brand` family + atmos tints move;
  `--volt` live/you, `--surge`, `--flare`, heat ramp and chart series never
  move. Default (no `data-club`) is exactly the floodlight look.

## Phases

### V7-A/B — avatars + landing lineup + immersive ask console ✅ (`6190221`)
- [x] Recropped all four gaffers (idle + 2 talk frames) from the text-free
      sheet; legacy text-baked stills deleted. `avatarTalk[0]` = idle.
- [x] Landing: trophy photo out; `HeroLineup` animated band in (selecting
      persists `gaffer_gaffer`, double-click opens the console pre-seeded).
- [x] Ask sheet: strip tiles show idle sprite + accent outline (volt ring
      retired); `SelectedGafferHero` expands the chosen gaffer to 2–3× strip
      size (144–256px, accent outline, pitch pad) with the 280ms frame flip;
      tap focuses the question box.

### V7-C — field faces, played/to-play rings, GW stepper ✅ (`4a9069f`)
- [x] `ShirtToken` → player face in a club-rail frame (`SquadRow.photo` was
      already flowing; `CrestTile` fallback). Captain C badge kept.
- [x] Played/to-play: opacity-55 dim gone — done = settled surge ring +
      surge-filled points pill, yet-to-play = hollow volt ring, live = pulse.
      Compare view inherits the same tokens.
- [x] GW stepper (◀ GWn ▶) in the Field header: `?gw=N` →
      `buildMatchday(teamId, gw)`; historical branch skips rank curve, swing
      feed and snapshot store; modes gate to points-only; no polling.

### V7-D — favourite-club chrome theme ✅ (`0249702`)
- [x] `[data-club]` on `<html>` recolours `--brand`/`--brand-wash`/atmos
      right tint from the 20 curated `--club-*` rails; pre-hydration script
      reads `gaffer_club` (no flash). Gate auto-picks from FPL
      `favourite_team` on confirm; start-page crest carousel (◀ ▶) picks or
      clears manually.

### V7-E — mobile More button legibility ✅ (`9fb2ea8`)
- [x] Thumb-bar More trigger at `--ink-hi` (was washed-out `--ink-mid`);
      e2e pins the computed colour.

### V7-F — under-page broadcast band ✅ (`3447f0c`)
- [x] Rain-soaked PL badge photo closes the newsdesk as an aria-hidden
      broadcast band, faded into the base at both edges.

## Outstanding from the owner batch

- "FIFA look and polish" is continuous taste work — folded into each phase
  above (skewed chrome, fig-num heroes, broadcast bands). No dedicated phase.
- Solver-lite (rank-priced payback across the 6-GW horizon) remains the one
  open item in `docs/PLANNER_RESEARCH.md` §Next candidates.
