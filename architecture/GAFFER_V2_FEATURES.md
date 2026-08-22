read# GAFFER v2 — the 30 features

Ordered by build priority, not category. **Ship 1–10 first**; they are the ones that make someone close the official app.
Every feature below is buildable from the FPL API you already consume, plus what you already compute. Effort is rough agent-hours.

Legend: **⚡ = no equivalent in the official Premier League app** · **◆ = no equivalent in any FPL tool I could find**

---

## Tier 1 — the reason people open GAFFER instead (ship first)

### 1. The Field ⚡
**What** The pitch view, with four switchable modes on one control: **Points · Ownership · Swing · Leverage**.
**Why it wins** Everyone has a pitch that shows points. Nobody has a pitch that can *change what it encodes*. Ownership mode fades your template players toward the ground and burns your differentials bright — one glance tells you how brave your team is. Leverage mode shows the rank swing still available per player, which is the only thing that matters at 4:30pm.
**Data** `picks` + `event/{gw}/live` + cohort EO + `leverage.ts`.
**UI** Night-lit pitch (radial floodlight gradient + 3% mowing stripes + 1px pitch markings at 40%). Club-coloured shirt tokens. DEFCON arc around each token, amber dots for provisional bonus, lumen armband arc for the captain, ultra `⇅` for projected auto-subs. See §7 of the UI doc.
**Effort** 5h

### 2. Swing feed — live rank attribution ◆
**What** Every scoring event converted into *your* rank delta: `73' Saka assist · +3 · EO 41.2% · you gained ~86,400`.
**Why it wins** The official app tells you your rank. It will never tell you *which goal in the 73rd minute moved it and by how much*. This is the single most emotionally compelling object in FPL and it does not exist anywhere.
**Data** Diff successive `fixtures?event=N` payloads; `swing.ts`; cohort EO; the rank curve derivative.
**UI** Reverse-chronological feed, 3px mint/flare left rail per row, grouped by minute, `aria-live` debounced to one announcement per 10s. Deltas reconciled so they sum to the observed rank change.
**Effort** 4h

### 3. Leverage board — "if he scores" ◆
**What** For every player still on the pitch or yet to play, the marginal rank swing of a goal / assist / clean sheet / DEFCON — split into **Your bets** and **The threat**.
**Why it wins** The threat half — players the field owns and you don't, where every return *costs* you rank — turns the second half of a gameweek into an options chain. Nothing else in the market shows the downside side of the ledger.
**Data** `leverage.ts` + outcome probabilities from the projection engine.
**UI** Two-section table, inline diverging bar per row, sorted by |expected|. Tapping a row opens the player peek.
**Effort** 3h

### 4. Live DEFCON tracker with threshold probability ⚡
**What** Live defensive-contribution count per player, distance to the threshold (10 for DEF, 12 for MID/FWD), **and the probability they get there** given minutes remaining and their per-90 rate.
**Why it wins** The official app shows the count. It does not tell you Gabriel needs 2 more with 25 minutes left and historically converts that 71% of the time. That's the difference between data and a decision.
**Data** `live.stats.defensive_contribution` (already position-adjusted by FPL — do not re-derive), plus historical rate from `element-summary`.
**UI** `Meter` with cyan→mint gradient fill, threshold notch, probability chip. On the Field, a cyan arc around the token.
**Effort** 2h

### 5. DEFCON per 90, hit rate and threshold distribution ⚡
**What** The season view: DEFCON points per 90, share of ≥60-minute matches where they hit the threshold, and a distribution of their per-match counts so you can see *how close* they usually get.
**Why it wins** Per-90 alone is misleading — DEFCON is a threshold reward, not a rate reward. A player averaging 11 who hits 12 in 40% of games is worth far less than one averaging 12.5 who hits it in 75%. Nobody surfaces the distribution, so nobody can see this.
**Data** `element-summary.history[].defensive_contribution` + `starts` + `minutes`.
**UI** `DefconRate` column chart with a dashed lumen threshold rule (bars above filled cyan, below in `--line-hi`), plus a `Defcon90` bullet against the positional median. Sortable column in the player explorer, with role-stability flag.
**Effort** 3h

### 6. Live bonus race with margin ⚡
**What** Per fixture, the BPS ladder showing who currently holds 3/2/1 — **and the margin to the next place**, so you know whether your player's bonus is safe or one tackle from gone.
**Why it wins** The official app now shows projected bonus. It does not show that your man leads by 1 BPS and is about to be overtaken. The margin is the actionable part.
**Data** `fixtures[].stats` identifier `bps`, `bonus.ts` tie-aware grouping.
**UI** Ladder per fixture, your players lumen-railed, a "bonus at risk" chip when the margin is ≤3.
**Effort** 2h

### 7. Effective ownership by rank tier ⚡
**What** EO for every player across **top 1k / 10k / 100k / overall / your mini-league**, live, with the sampling margin shown.
**Why it wins** Raw ownership % (which the official app now shows) is the wrong number — it ignores captaincy and it ignores *who* owns him. A player at 12% overall and 61% in the top 10k is a completely different decision.
**Data** The post-deadline cohort snapshot job (picks are immutable after the deadline, so this is one job per gameweek).
**UI** Tier selector that persists app-wide; EO chips on every player surface; `EOScatter` with the four labelled quadrants (*Template / Active bet / Ignored / Trap*).
**Effort** 4h (mostly the sampling job, already specced)

### 8. Price change predictor with pressure gauge ⚡
**What** For every player: cumulative net-transfer pressure against the ~220k threshold, today's velocity against the ~40k daily gate, days since last change, and a probability plus ETA.
**Why it wins** The official predictor gives you a direction once a day at midnight. This gives you a *gauge* you can watch, with the two conditions shown separately so you understand *why* it's about to move — and a wildcard correction, since the algorithm counts unique managers rather than raw transfers.
**Data** Hourly `price_snapshot` job on `transfers_in/out` + `now_cost`; `price.ts`.
**UI** `PriceGauge` meter (amber→flare) with a 24h velocity sparkline beneath. A pinned "**Tonight**" list: your squad and watchlist sorted by |probability|, with rise/fall direction.
**Effort** 3h

### 9. Rival radar with live win probability ⚡
**What** Per mini-league rival: `P(you finish this gameweek above them)`, updating per event, **and the single player driving the change**.
**Why it wins** `Dave 41% ▼ from 63% — his Haaland captaincy, 34 minutes left` is a sentence the official app cannot produce. Paired Monte Carlo (shared player draws) is what makes it correct; simulating independently gives badly wrong numbers.
**Data** `simulate.ts` with paired runs over remaining minutes.
**UI** League table with a win-probability meter track beside each row, sorted by "most at risk". Tap → Field compare mode.
**Effort** 4h

### 10. The Ask bar — generative interface ◆
**What** Ask anything in plain language; the app **assembles an interface** from real components rather than replying with text.
**Why it wins** First in the category. And architecturally honest: the model picks components and parameters, your engines supply every number, so a bad model call produces a suboptimal *chart choice*, never a wrong statistic.
**Data** Intent router (free, handles ~80%) → component registry → resolver. See §9 of the UI doc.
**UI** Header-pinned, `⌘K`. Components stream in staggered 60ms — the interface visibly assembling itself is the whole effect.
**Effort** 6h

---

## Tier 2 — the weekday product

### 11. The Board — position-aware fixture planner ⚡◆
Colour every fixture cell by the metric that matters *for that player's position*: opponent xGC/90 for attackers, opponent xG/90 for defenders and keepers. The same fixture is a different colour on Gabriel's row than on Watkins's. No single-difficulty-number ticker can express that. Horizon 6/8/10/end-of-season, UPPERCASE=home / lowercase=away, blanks drop to the sunk surface so bad runs read as holes. **Effort 6h**

### 12. Transfer staging with payback point ⚡
Drag a move onto a gameweek; it draws as a band across the weeks it applies to, with the gameweek where cumulative xP gain overtakes the hit cost marked. The ledger shows free transfers (banking to 5), bank, hits planned, horizon xPts, and **delta vs doing nothing** — the number that actually decides. **Effort 4h**

### 13. Chip planner with a hard expiry wall ⚡
Drag chips onto gameweeks. Set 1 expires at GW19 — drawn as a wall you cannot drop past, not a warning you can ignore. Free Hit blocked in consecutive weeks. Bench Boost gain = projected bench points; Triple Captain gain = projected captain xP. **Effort 3h**

### 14. Blank & double gameweek radar ⚡
Count fixtures per club per gameweek across the whole remaining season; surface emerging blanks and doubles as soon as the fixture list changes, and auto-suggest chip windows. Most managers find out about a double from Twitter. **Effort 2h**

### 15. Transfer simulator with a variance readout ◆
Pick out, pick in. Three deltas: **xP**, **EO exposure**, and **variance** — the standard deviation of your simulated gameweek score. A move that adds 0.4 xP but doubles your rank variance is a completely different decision, and nobody shows the third number. **Effort 3h**

### 16. Ownership momentum board ⚡
Net transfers per day across the top 20 movers, club-coloured stacked area, with price-change markers. Answers "what is the crowd doing" before the crowd finishes doing it. **Effort 2h**

### 17. Deadline ownership predictor ⚡
Project EO *at the deadline* from transfer velocity, news events, price feedback and time decay — with a confidence band. Buying at 8% ownership on Thursday when it lands at 34% by Saturday is a materially different bet. **Effort 3h**

### 18. Minutes model / rotation risk ⚡
Start probability and expected minutes per player from recent starts, `chance_of_playing`, status flags and fixture congestion. Displayed as a probability, not a flag. The official app's flag system is binary and useless for rotation. **Effort 3h**

### 19. "Due or finished" — xG vs actual ⚡
Cumulative xGI plotted against cumulative returns on **one axis** (same unit, so it's legal). Gap above the line = underperforming, likely to regress up. Gap below = riding variance. The single best transfer-timing signal available for free. **Effort 2h**

### 20. Set-piece hierarchy and penalty share ⚡
Who takes penalties, corners, direct free kicks, and their share of each — from `team/set-piece-notes` plus observed data. Displayed on the player peek and as a filterable column. **Effort 2h**

---

## Tier 3 — depth, retention and the share loop

### 21. Card and suspension watch ⚡
Yellow-card counts against the 5/10/15 ban thresholds, with the gameweek a suspension would land in given the fixture list. Nobody wants to find out on Saturday morning.  **Effort 1h**

### 22. Value scatter — points per £m ⚡
xP per £m against xP, with your squad highlighted and the efficient frontier drawn. Instantly shows which of your players you are overpaying for. **Effort 2h**

### 23. Player comparison, up to five ⚡
Radar over normalised dimensions (attacking return, defensive contribution, minutes security, fixture run, value, bonus potential) plus an overlaid fixture strip and a season xPts line. **Effort 3h**

### 24. Template drift and Differential Value Score ⚡
Your overlap with the top-10k template XI, its direction of travel over five gameweeks, and your active bets listed *for* and *against* with `DVS = (yourMultiplier − EO/100) × xP`. Tells you whether you're diverging on purpose. **Effort 2h**

### 25. Fixture swing finder ⚡
"Whose fixtures turn in three gameweeks?" — a slope chart of every club's difficulty over the next 8, sorted by the size of the turn. The classic transfer-planning question, answered in one screen. **Effort 2h**

### 26. Mini-league captain matrix and chip timeline ⚡
Managers × gameweeks heat grid where each cell is the captain's club colour with the points as the label, plus a lane chart of every chip every member has played. Mini-league bragging material, which is the real retention engine. **Effort 3h**

### 27. Manager DNA ⚡◆
Risk appetite, captaincy alpha (vs what the field's captain returned), transfer P&L over a 5-GW window, sell regret, timing score, bench cost, chip efficiency, consistency. A permanent, shareable identity page. **Effort 5h**

### 28. Season Fingerprint — generative art ◆
A radial composition where each gameweek is a spoke: length = points, hue = rank direction, thickness = transfers, lumen rings on chips. Seeded deterministically from the entry id, so it reproduces exactly. Every manager's season is a genuinely different image. This is the best share asset you will ever have and no FPL product ships anything like it. **Effort 3h**

### 29. Gameweek Film with share cards ⚡
A five-act scroll-driven recap generated after finalisation: the score, the curve, the call that worked, the one that didn't, the league. Exports a 1200×630 OG card built from the Gameweek Sigil (a glyph generated from that week's swing sequence). This is the acquisition loop. **Effort 4h**

### 30. Watchlist with a deadline digest ⚡
Star any player from anywhere; the watchlist drives the price-tonight list, the Board's second section and the deadline triage. Since there are no accounts, it lives in `localStorage` keyed by team id — and can later back a web-push subscription without ever needing a login. **Effort 2h**

---

## What this adds up to against the official app

The Premier League app, after the 2026/27 update, gives you: live points, live rank, live mini-leagues, projected bonus, a daily price predictor, FDR, ownership %, and career percentiles. It is genuinely good now — which is exactly why the differentiator cannot be any of those things.

Of the 30 above, **28 have no equivalent in the official app**, and the four marked ◆ have no equivalent anywhere: live rank attribution, the threat side of the leverage board, a generative interface, and generative per-manager artwork.

The one-line pitch that follows from the list: **the official app tells you what happened; GAFFER tells you what it cost you and what to do next — and it's the only one that looks like someone cared.**

---

## Suggested cut line

If you can only build ten tonight: **1, 2, 3, 4, 7, 8, 10, 11, 12, 28.**
That is the Field, the Swing feed, the Leverage board, live DEFCON, tiered EO, the price gauge, the Ask bar, the Board with staging, and the Fingerprint. Live product, weekday product, one genuine first, and the share asset.
