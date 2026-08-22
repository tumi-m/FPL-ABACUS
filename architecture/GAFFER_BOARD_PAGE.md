# GAFFER — The Board (/board) · screen spec digest

Supersedes v2 UI doc §10 entirely. Style: stadium blue rev-02. Depends on projection engine,
price.ts, and for solver-rank-objective + option value: v3 features 2/4/15/16.
**One Plan object, two views (GRID analyst ⇄ RUN manager). Toggle top-right; view+gw in URL
(`/board?view=run&gw=12`). No state loss on toggle.**

## Plan model (`lib/board/plan.ts`)
```ts
Plan { id /*codename "plan-drifting-arteta"*/; name; entry; baseGw /*last locked*/;
       horizon /*6|8|10|38*/; gameweeks: PlanGw[]; createdAt; expiresAt /*30d, extended on edit*/ }
PlanGw { gw; transfers:{out,in}[]; chip:Chip|null; captain; viceCaptain;
         xi:number[] /*11 pos order*/; bench:number[] /*4, pos12=reserve GK*/ }
```
Derived (freeTransfersBefore, hitCost, bank, teamValue, xP, xPCumulative) — **recomputed, NEVER stored**.
URL fragment = base64 compact array; fallback stored id for long plans.

## Budget engine (§6) — test-first, matches real game to the penny
```ts
sellingPrice(purchase,current){ if(current<=purchase)return current;
  return purchase+Math.floor((current-purchase)/2); }          // half profit rounded DOWN; losses full
rollFreeTransfers(ft,chip,cap){ return Math.min(ft+1,cap); }   // WC/FH same roll; cap from game_settings
hitCost(transfers,ft,chip){ if(chip==='wildcard'||chip==='freehit')return 0;
  return Math.max(0,transfers-ft)*4; }
```
Rules from API not hardcoded: bank cap 5 (`max_extra_free_transfers`), −4/hit, transfers_cap 20,
2/5/5/3 ≤3/club £100m, chip set-1 expiry GW19 (`chips[].stop_event`).
**Free Hit = branch**: temporary squad, following GW resumes pre-FH squad — visible in grid.
Verify FT×chip interaction against current rules text before shipping.
**Price projection (§6.1)**: project costs forward via price.ts pressure/velocity across horizon;
bank/value evolve; projected prices shown `~` + tooltip.

## View A GRID: rows=15+watchlist; cols=GWs. Cell: opponent code UPPER=home/lower=away +
secondary metric (xPts/xGC90/xG90/CS%/xMins), colour position-aware (attackers→opp xGC/90,
def/GK→opp xG/90 — same fixture different colour per row). Controls: horizon 6/8/10/EOS ·
colour model xG(default)/FDR/Odds · metric picker · row grouping pos/club/staged. Column footer:
proj XI score, #15-with-fixture, bank, FT, hits. Blank=sunk hole; double=volt ring stacked.

## View B RUN (default mobile): Field pitch REUSED (drag-sub, tap-captain — never a second pitch).
GW stepper + strip showing per-GW proj score; per-player actions Captain/Vice/Substitute/Sell/
Restore; ADVANCE locks week, rolls FT (cap5), applies projected prices, reversible (re-derive).
Moves list w/ price delta + xP delta; chip dropdown.

## Player tray (docked right 360px / bottom sheet mobile; open in BOTH views)
Cols: player·club·pos·price·SELLING price(if owned)·xP next·xP horizon·form·mins·ownership·
EO top10k·DEFCON/90·next-5 heat cells. Filters row: team/pos/max price/**"Only players I can
afford" (=bank+sellingPrice(outgoing), live)**/status/mins floor/not-in-squad. Sort any col,
default xP-horizon. Drag row→token OR tap→replace-pick.

## Chips lane: drag onto GW shows gain (BB=bench pts, TC=capt xP, FH/WC=optimiser gain).
Constraints ENFORCED not warned: set1 wall at GW19; FH not consecutive; one chip/GW.
Show v3-15 option value alongside (held vs capture now).

## Drafts (§8): autosave localStorage keyed by entry; codename gen; rename inline; duplicate fork;
expiry 30d shown plainly; share=URL (read-only others); max 8 drafts listed w/ horizon xP.
Compare: outcome DISTRIBUTIONS not totals — table xP/p5/p50/p95/TE/hits + two overlaid density
curves medians marked + move-diff table; verdict tied to stated target (v3-13).

## Solver LAST (3s server budget, top-3 paths, assumptions listed, NEVER auto-applies — stages moves):
objective A ΣxP−hits; objective B maximise rank probability (v3-2/4) shown side-by-side.

## Edge cases (real copy each): no teamID→gate ?next=/board · GW1 pre-season builder · injured
player flagged flare + 1-tap replacement · fixture change banner w/ diff · constraint violation marks
GW invalid w/ reason (£0.3m short), no silent repair · FH revert visible · clamp >38 · watchlist
sold greys row. Mobile: Run default; swipe GW nav; tray bottom sheet pinned filters; chip lane single row.
Perf: derived recompute in worker; memoise (element,gw); virtualise rows>25; edit<100ms, reproj<600ms.
Acceptance §13 incl.: selling price penny-exact; affordability uses SELLING price; tier EO column;
~ prices; drafts save/rename/dup/share/expiry; compare distributions; solver staged-only;
def≠fwd cell colours; 375/768/1440 both themes.

## BUILD ORDER (§14): 1 model+budget engine (**replay test FIRST**: replay real manager season,
assert bank/value == entry_history every GW) 3h → 2 Run stepper/pitch/moves/ADVANCE 3h →
3 tray+affordability 2.5h → 4 Grid position-aware 3h → 5 chip lane 1.5h → 6 drafts 2h →
7 price projection 1.5h → 8 compare distributions 2h → 9 solver-points 3h → 10 solver-rank (post-v3-2/4) 2h.
STOP after step 4 for review.
