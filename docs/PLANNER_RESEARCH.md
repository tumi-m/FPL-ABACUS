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

- Real rolling FT replayed from entry history (cap 5, WC/FH reset rule) replacing the hardcoded `1` — parity with OneFPL/fpl.team basics.
- Next-three fixture run labels on every OUT/IN row and option — fixture-run context without leaving the desk.
- Roll nudge when ≥2 FT banked ("rolling is often the best move") — Copilot's top insight.

## Next candidates (not built)

- Multi-plan slots (patient vs aggressive side by side) — OneFPL's most-praised feature.
- Solver-lite: rank-priced payback across the full 6-GW horizon rather than ep_next delta.
- Blank/double markers inside the chip lane cells.
