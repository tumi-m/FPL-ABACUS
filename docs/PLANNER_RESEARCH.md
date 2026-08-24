# FPL planner landscape — research notes

Grounding for GAFFER's BoardDesk/planner UX. Sources surveyed Aug 2026: OneFPL, fpl.team, PlanFPL, FPL Copilot, FPL Review, LiveFPL, FPL Gameweek, FPL Focal, Fantasy Football Scout.

## What competitors do

| Tool | Core idea | Notable |
|---|---|---|
| OneFPL | Multi-GW transfer sequencing from Team ID | FT banking to 5, −4 hit accounting, chip pencilling (used chips greyed), multiple saved plans |
| fpl.team | Feature-rich 6+ GW squad mapping | Predicted lineups for all 20 clubs, transfer solver; UI considered complex |
| PlanFPL | Simple multi-GW planning | The "clean" alternative; no account needed |
| FPL Copilot | **Solver** — maximises xPts over horizon up to 10 GW | Recommends "roll" often; staggered moves beat bulk; anti-bad-hit not anti-hit |
| FPL Review | MILP optimiser + chip EV analyser | Most trusted xP model; premium solver balances template vs differential via EO |
| LiveFPL | Live rank/EO/top-10k data | The default live companion |
| FPL Focal | Matchday dashboard | DEFCON tracker is its killer feature (GAFFER already matches this) |

## Community wisdom worth encoding

- **Rolling FT is a decision**: banking to 2 free transfers is frequently optimal ("the best transfer is often no transfer"). Planners that surface banked FT prominently change behaviour.
- **Payback framing**: every −4 must earn ≥4 back; showing "pays back in ~N GW" beats raw hit counts.
- **Fixture runs beat single fixtures**: cumulative xPts over a 3-GW window decides transfers, not one week.
- **Staggered moves** rarely lose to bulk moves in solver output.
- Chip timing against blanks/doubles is where planners earn their keep (two-chip era makes this harder).

## GAFFER's differentiators (keep leaning in)

1. **Ranks, not points**: competitors price everything in xPts; GAFFER prices decisions in *rank equity* (leverage/swing). Nobody else does this natively.
2. **Twin studies**: observational evidence from near-identical squads — unique.
3. **The gaffers**: persona-voiced interpretation on top of engine facts.

## Shipped in BoardDesk after this research

- Real rolling FT replayed from entry history (cap 5, WC/FH reset rule) replacing the hardcoded
  `1` — parity with OneFPL/fpl.team basics.
- Next-three fixture run labels on every OUT/IN row and option — fixture-run context without leaving the desk.
- Roll nudge when ≥2 FT banked ("rolling is often the best move") — Copilot's top insight.
- **Multi-plan slots** — up to four device-local plan tabs (`lib/engines/boardPlans.ts`, legacy v1
  desks migrate into Plan A); each slot carries its own staged ledger + chip lane; tab badges show
  move counts for side-by-side patient-vs-aggressive comparison.
- **Blank/double markers inside chip lane cells** — `×2` / `bye` badges (tooltip carries club
  counts) fed by `computeGwProfiles` in `buildBoardDesk`; the same profile now also renders the
  Board footer honestly ("full slate" vs doubles + blanks).

## Shipped since (solver-lite, V8-F)

- **Rank-priced horizon payback** — staged moves priced by 6-GW fixture-model
  projection (position-aware, doubles stacked, blanks zero), payback = first GW
  where cumulative gain covers the hit, every row and the plan footer carry an
  Est rank swing via ranks-per-point at the hero's season total. `lib/engines/solverLite.ts`.

## Shipped since (the planner rebuild, V9-E)

The desk became a screen. `/planner` now matches the shape the research kept
pointing at — Fantasy Football Hub's pitch-plus-market layout — with GAFFER's
own grounding underneath:

- **Pitch and market side by side.** Tap who leaves, tap who arrives; the
  market narrows to legal replacements and greys the rest with the reason
  (`£1.5m short`, `Already 3 from ARS`) rather than hiding them.
- **Per-gameweek projection cells** on every market row, so a run reads as a
  shape rather than a total. Sort by projection over 1/3/5/6 GW, season points,
  form, points per £m, ownership or price.
- **Real selling prices** from the picks endpoint, so the budget is the one FPL
  would actually give you — not today's list price.
- **Chain collapse**: re-selling a player you only bought in this plan rewrites
  that transfer instead of charging a second hit.
- **Chip lane** with FPL's real per-chip availability window (both halves of
  the season are separate chips and the lane says so).
- **Fixture ticker** — twenty clubs against the window, ranked by run.
- **Price watch** — net-transfer pressure, labelled as the estimate it is.

## Next candidates (not built)
