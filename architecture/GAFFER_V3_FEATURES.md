# GAFFER v3 — "THE QUANT LAYER"

21 new features. None exist in FPL today. Companion to `GAFFER_V2_FEATURES.md` (first 30 — no
duplication). Feature 21 (The Committee) is independent of the quant stack. Visual system:
`GAFFER_STYLE_GUIDE.md`.

## Thesis

Every FPL tool maximises E[your score]. Wrong objective: you must beat 13M people — total return
vs active return. Correct objective: `maximise P(your score > field's score)`, unlocking forty
years of portfolio mathematics never applied to FPL (active share, tracking error, information
ratio, frontier, beta, VaR). Rest from adjacent fields: state-space filtering, Bayesian changepoint,
survival analysis, cooperative game theory, optimal stopping, causal matching, manifold learning,
information theory. Clarke test per feature: user should not immediately understand how it's possible.

---

## Tier A — Portfolio theory: the correct objective

### 1. THE POSITION — active share, tracking error, information ratio (3h)
```
w_p = m_p / Σm        m_p ∈ {0,1,2,3}   your weights (0 bench, 2 captain, 3 TC)
f_p = EO_p / ΣEO                        field weights from top-10k cohort snapshot
a_p = w_p − f_p                         active weight
ACTIVE SHARE   AS  = ½ Σ|a_p|                          ∈ [0,1]
ACTIVE RETURN  R_t = Σ_p (m_p − EO_p/100) · pts_t      ← Swing Engine numerator
TRACKING ERROR TE  = sd(R_t) played GWs (×√38 season)
INFORMATION RATIO IR  = mean(R_t)/TE
P(finish ahead over n GWs) ≈ Φ(IR·√n)   → maximising rank IS maximising IR.
Bands: AS<0.25 template · .25–.45 balanced · >.45 maverick · IR>0.35 elite.
Visual "style map": scatter x=TE y=mean(R); iso-IR rays --line-hi through origin;
top-10k cohort --ultra cloud @10%; you = --volt dot w/ end-marker. Quadrants:
low-risk/+alpha top-left good · high-risk/−alpha bottom-right dead.
Runs client-side. Data: cohort snapshot + history.
```

### 2. THE FRONTIER — rank-optimal squad construction (6h, after 4)
```
maximise a′μ − (λ/2)a′Σa  s.t. £100m, 2/5/5/3, ≤3/club, valid XI, budget
μ from projection engine; Σ from Correlation Web (4); λ FROM YOUR POSITION:
chasing far below → λ<0 variance desirable; protecting → λ>0.
Sweep λ → efficient frontier in (TE, active return). Vertical gap below frontier
= inefficiency in pts/GW. Solver: JS branch-and-bound over top~120 by xP or greedy+SA 3s;
nightly precompute, recompute on staged transfer.
Visual: frontier --volt curve, feasible cloud --ultra@10%, you as dot + dashed drop-line labelled.
Server on request.
```

### 3. SQUAD BETA — riding the crowd (2h)
```
S_you,t = α + β·S_field,t + ε_t ;  β=Cov/Var(field); α = Jensen's alpha (only part that compounds);
sd(ε) idiosyncratic. Visual: scatter w/ fitted line, dashed 45° ref, residuals as drop-lines.
Client-side.
```

### 4. THE CORRELATION WEB — players are not independent (6h, FOUNDATION)
Real ρ: same-team attackers +.25–.45 · GK-own-def +.55–.70 · def vs opp attacker −.30–.45.
Independent sims understate stacked-squad variance 20–40%.
```
Copula by construction: draw (G_h,G_a) ~ DixonColes(λ_h,λ_a,ρ) [from 5];
allocate goals/assists multinomially by player share of team xG/xA given simulated minutes;
CS/DEFCON/bonus deterministic from same draw; M=20k → empirical Σ.
EFFECTIVE BETS = (Σλᵢ)²/Σλᵢ²  (participation ratio of squad correlation eigenvalues).
Visual: chord diagram grouped by club; arcs surge+/flare− opacity |ρ|; Effective Bets gauge "6.2/11".
Server 20k draws. Consumed by 2,12,13(?),14,19.
```

---

## Tier B — better estimates of the world

### 5. THE STRENGTH MODEL — fixture difficulty with error bars (8h, FOUNDATION, highest leverage)
```
G ~ Poisson(λ); λ_h = exp(μ + att_h − def_a + γ), λ_a sym.
Dixon–Coles τ(x,y;ρ) low-score correction; time decay exp(−ξ·Δd) ξ≈0.0045;
partial pooling att_i~N(0,σ_att²), def_i~N(0,σ_def²); last season posterior = widened prior.
Nightly MAP + Laplace (~200 lines TS) or NUTS via Python cron escape hatch.
Feeds: CS prob, Board colour, xGC, copula. Gives credible intervals — August honesty.
Visual: att×def plane, club-coloured points w/ 90% credible ellipses, 8-GW drift trails.
Nightly cron.
```

### 6. TRUE FORM — Kalman-filtered ability (3h)
Local-level state space; obs r_t ∝ 90/minutes (cameos discounted); missing match = process noise only
→ uncertainty grows during injury. y_t = xGI/90 (+ DEFCON/90, pts/90 separately).
```
K_t=(P+q)/(P+q+r); θ̂+=K(y−θ̂); P=(1−K)(P+q).
Visual: ±1.96√P ribbon + dots sized by minutes; narrows on starts, flares on absence.
Nightly cron.
```

### 7. ROLE RADAR — Bayesian online changepoint detection (5h, tell-your-friends feature)
Adams–MacKay BOCPD on stream [min share, xG share, xA share, set-piece involvement,
touches-in-box proxy, DEFCON rate]; hazard H=1/12 matches; alert P(r<2)>0.6.
Detects role changes within 2 matches — before points, long before price.
Visual: run-length posterior heatmap (--heat ramp, diagonal breaks at changepoint) +
plain English "Set-piece share 4%→61%. Detected GW6." Nightly cron (Python candidate).

### 8. ENGINE TEMPERATURE — fatigue/congestion hazard (4h)
Cox PH for rotation + injury events; x=[EW minutes load 21d, matches 10d, days since,
euro flag, age, pos, min-per-start trend, rotation rate]; fit current+2 seasons.
Outputs P(start), P(60+), P(injury≤3GW).
Visual: load map rows=15 players cols=calendar days 3GWs, heat-ramp load cells + engine gauge/row.
Nightly cron.

---

## Tier C — understanding what you did

### 9. THE LEDGER — Shapley attribution (5h)
φ_i via Monte Carlo permutation sampling (Castro–Gómez–Tejada, 2000 orderings, SE reported).
D = transfers/captains/chips/bench order; v(S) with neutral defaults (roll transfer,
most-captained skip, hold chip, keep bench). Efficiency ⇒ bars sum exactly to rank.
Visual: waterfall start→current rank, surge/flare bars, expandable categories. Server on request.

### 10. THE TWIN STUDY — the experiment 13M already ran (6h)
cohort(you,gw): ≥13/15 squad overlap ∧ |FT diff|≤1 ∧ bank ±£0.5m. Partition by decision arm;
outcome mean/median/sd/rank-delta per arm + arms' avg pre-GW rank shown (observational! say so).
Sampling: raise cohort to ~30k entries weighted top-250k post-deadline, cached forever.
GREY OUT below n=100, show n prominently.
Visual: split-violin per arm, your outcome --volt needle, chosen arm outlined --ice.
Needs big cohort sample extension.

### 11. PROCESS vs OUTCOME — skill vs luck (4h)
Process score Σ E[pts|XI, deadline info] vs Outcome; two ranks + luck in pts AND ranks.
Four channels: bonus luck Σ(bonus−E[bonus|BPS]); minutes luck Σ(min pts − E|P(start),P(60)|);
finishing luck Σ(goals−xG)·val; field luck (field over/under projection).
Finishing reverts (hold); minutes doesn't (model wrong → squad problem).
Visual: slope chart ladders + volt ribbon; diverging stacked bar channels. Needs history.

---

## Tier D — deciding under uncertainty

### 12. RANK AT RISK — VaR/CVaR (3h)
From paired copula sim: VaR₅=95th pct of end-GW rank; CVaR₅=E[rank|>VaR₅] — coherent tail measure.
Move improving E[rank] while worsening CVaR = leveraged bet, say so in those words.
Visual: rank density, worst-5% shaded flare, solid VaR rule, dashed CVaR; ghosted decision overlays.

### 13. THE CONE — what the target requires (4h)
Forward sim remaining season: R_t~N(α,TE²) w/ autocorrelation, 10k paths → final-rank fan.
Invert targets: required mean active return as percentile of field process distribution.
"Top10k needs +4.1/GW = 78th-percentile process ×19 weeks" — or honest "now a 2% outcome".
Visual: log-inverted fan p5–p95 ultra bands, median volt line, target contours w/ required rates,
actual path solid left. Poster image.

### 14. THE CROSSOVER — Nash captaincy (4h)
maximise_c (Δμ+B)/σ_Δ; σ_Δ shrinks with shared players (needs Σ). Behind ⇒ variance worth more;
explicit computable crossover where differential beats safe pick.
Visual: 2D map x=points behind y=GWs left, cell=equilibrium captain choice, you=volt dot.

### 15. OPTION VALUE — chips are American options (5h)
Snell envelope backward induction: V_T=max(0,payoff_T); V_t=max(payoff_t, E[V_{t+1}]).
payoffs: BB=E[bench pts]; TC=E[capt xP]; FH=optimiser gain locked squad; WC=discounted horizon gain.
Expiry GW19 set1 / GW38 set2 priced in; exercise boundary falls toward expiry.
Visual: payoff columns + descending volt boundary + optimal GW highlight + option value number.

### 16. THE THRESHOLD — when to press the transfer (4h)
W(k,t)=E[max(best_move+W(k−1,t+1), W(k,t+1))]; threshold=W(k,t)−W(k−1,t+1).
Falls through week (info arrives) and with k banked.
Visual: threshold curve Mon→deadline; best move as moving volt dot; price pressure shifts curve.

---

## Tier E — seeing the whole game

### 17. THE MANIFOLD — shape of the top 10k (6h, Python cron)
Jaccard → UMAP(25,0.08) 2-D → HDBSCAN → label clusters by lift players; ship coords+labels ~200KB.
Ownership tables can't show which COMBINATIONS are popular — five strategies, not one template.
Visual: density-contour scatter, clusters tinted dominant club, you pulsing volt; hover = template XI,
share, trailing-4 perf. Meta drift over season is the beauty shot.

### 18. CROWDING — where alpha lives (2h)
Per position: s_p=EO/ΣEO; HHI=Σs²; EFFECTIVE PICKS=1/HHI; entropy −Σs ln s.
Collapse ⇒ convergence ⇒ differential value max (cost shared); expansion ⇒ template cheap.
Visual: four small multiples effective-picks-over-GWs, endpoint callout, min/max band.

### 19. WIN PROBABILITY ADDED — broadcast graph for your league (4h)
WPA(event)=P(win|after)−P(win|before) from PAIRED sim (needs 4 — why nobody has it: independent sims lie).
Top-3 moments named. Season: cumulative per GW.
Visual: step-area 0–100%, surge above 50%/flare below, event markers, top-3 annotated, replay scrubber.

### 20. THE LADDER — Glicko-2 manager rating (4h)
r/RD/volatility; each GW round-robin vs N=500 sample; outcomes 1/.5/0 by GW pts; standard Glicko-2 step.
RD grows when inactive. Smooth-40k rates above TC-haul-40k; portable across seasons.
Visual: volt rating line inside narrowing RD ribbon + ladder w/ background density.

---

## Tier F — your league, your rules

### 21. THE COMMITTEE — custom competitions & prize tracking (7h; INDEPENDENT, ship anytime)
Typed rule compiled from language; deterministic evaluator computes every number (v2 trust model).

```ts
type Window = {kind:'phase';id:number} | {kind:'gw';from:number;to:number}
            | {kind:'rolling';last:number} | {kind:'season'}
type Metric = 'points'|'net_points'|'bench_points'|'captain_points'|'differential_points'
            |'defcon_points'|'overall_rank'|'rank_delta'|'transfers'|'hits_cost'|'chips_used'
            |'team_value'|'gw_wins'|'consistency'
type Agg = 'sum'|'mean'|'max'|'min'|'count'|'delta'|'stdev'
type Filter = {field:'chip';op:'used'|'not_used';value?:Chip}
            | {field:'hits_cost';op:'eq'|'lte'|'gte';value:number}
            | {field:'captain_team';op:'is'|'in';value:number[]}
            | {field:'joined_by';op:'lte';value:number}
interface Competition { id;name;window;metric;agg;filters?;order;topN;
  tieBreak:('gw_wins'|'season_total'|'fewest_transfers'|'overall_rank'|'share')[];
  prize?:{label;share?}; excludeEntries?:number[] }
```

Months EXACT via `bootstrap-static.phases` ({id,name,start_event,stop_event}) — no more arguments.

Two front doors: (1) type it → model compiles Competition → plain-English confirm before live;
ambiguity returns `clarify{question,options:[Competition,Competition]}` rendered as one-tap chips.
(2) visual builder (window·metric·agg·order·topN + filter chips) — typed path writes into builder.
NEVER ship language path without builder.

Evaluator pure/deterministic/unit-tested off cached entry-history+picks. Late joiners score member
GWs only (joined_by filter available; show treatment in header). Ties via tieBreak chain ending 'share'.
Cache per (competitionId,lastFinalGw); invalidate only on finalisation.

Visuals: Prize Board (card/competition: plain-English rule, leader, podium, GWs left, progress meter,
volt rail if you lead); The Race (cumulative lines, top-8 slots + "Other" band, you volt 3px end-label,
log-inverted axis for rank_delta); The Table (delta arrows + expandable per-GW audit trail — settles
arguments); Settlement share card 1200×630 OG on window close.

Money: ledger ONLY ("Dave won £40, paid £20, owed £20"). GAFFER moves no money, holds no funds —
say so plainly on screen. Sharing: competition → URL fragment + 6-char code; organiser drops one link.

---

## Implementation notes

Where things run — nightly cron (TS or Python): 5 fit · 6 Kalman · 7 BOCPD · 8 Cox · 17 UMAP/HDBSCAN ·
20 Glicko. On-request server: 2 solve · 4 sim(20k) · 9 Shapley(2k) · 10 twin query · 12 VaR · 13 Cone ·
15 options · 16 threshold. Client: 1 Position · 3 Beta · 18 Crowding · all rendering.
Python escape hatch (FastAPI, cron-only, writes Postgres) justified by 5 sampler / 7 BOCPD / 17 UMAP.

Build order: **[4 Correlation Web + 5 Strength Model] → [1 Position → 3 Beta → 13 Cone] →
[6 True Form · 7 Role Radar · 8 Engine Temp] → [9 Ledger · 11 Process-vs-Outcome] →
[10 Twin Study · 17 Manifold] → [15 Option · 16 Threshold · 18 Crowding · 20 Ladder]**.
Anytime: **21 Committee**. Also: 2 Frontier after 4; 12 VaR & 19 WPA need 4; 14 Crossover needs 4.

The five that justify everything: **4, 7, 10, 13, 17** — plus 21 recruits whole leagues by itself.

## Honesty rules — non-negotiable

1. Every modelled number ships WITH its uncertainty (intervals, SE, RD, cohort n).
2. Grey out below evidence thresholds (Twin <100; Beta/IR <6 GWs; Crowding pre-snapshot) — show reason.
3. Twin Study labelled observational; print arms' pre-GW rank (selection visible).
4. Backtest predictive features; publish calibration curves in-app.
5. Model never narrates a number an engine didn't produce.
