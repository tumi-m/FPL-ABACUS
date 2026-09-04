hi plan and implement this GAFFER v10 — the "best FPL analytics app in the world" plan



Target harness: opencode · Target model: Meta MuseSpark 1.3
Repo: tumi-m/FPL-ABACUS · Branch discipline: work on main, one commit per task, push when green.
Baseline commit this plan was written against: 8513ff8 (CI #123 green).
Do not commit this file to the repo. It is a working brief for the harness.



0. How to use this document

Each task below is written to be handed to the agent one at a time. A task has a
goal (why it matters to a human using the app), files (where the work lands),
approach (the design decision already made, so the agent doesn't re-litigate it),
and acceptance (what must be true before it commits).

Run the gates after every task, without exception:

pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e

If a task cannot pass its acceptance criteria, stop and report rather than
weakening the criteria. A plan that ships broken work is worse than a plan that
stops.

A note on the model

I have no reliable knowledge of Meta MuseSpark 1.3's capabilities, so nothing in
this plan depends on a specific model feature. Before starting Workstream B,
verify these four things about it and record the answers in docs/NOTES.md,
because B's design branches on them:





Context window — how many tokens, and does it degrade before the limit?



Structured output — does it support a JSON/grammar-constrained mode, or

must modelSelect keep parsing prose with parseJson?



Tool / function calling — native, or does it need the prompt-and-parse

approach the router uses today?



Streaming shape — the current client speaks Ollama-native NDJSON

({message:{content}} per token) at lib/ai/client.ts. If MuseSpark is served
 over an OpenAI-compatible endpoint it emits SSE data: frames instead, and
 chatStream needs a second parser, not a rewrite.

If it turns out MuseSpark supports native tool calling, B3 gets much cheaper —
say so and take the shortcut. If it does not, B3 as written still works.





1. Ground rules (from AGENTS.md — these are not negotiable)

Any task that breaks one of these is wrong even if it looks better:





Zero raw hex outside globals.css (sole exception config/brand.ts themeColor).



No grey/neutral tokens. Skew, gloss and bevel on chrome only, never on data.



Figures in italic Saira, names in upright Barlow.



Fixture heat is blue→green, never red→green.



Chart series use the validated 8-slot palette
(#3987e5 #d95926 #199e70 #c98500 #d55181 #008300 #9085e9 #e66767),
never UI accent colours.



One gradient hero figure per screen.



prefers-reduced-motion genuinely stops everything.



Every estimated number wrapped in <Est> with a real method string.



Never invent a number. Availability is FPL's words. Fixture difficulty is two
numbers (attack goals, defence clean sheets), never one index. One definition of a
player's season lives in lib/engines/performance.ts.



Never stream a raw error to the client — cause to the log, sentence to the user.



Every stored-data read goes through dbRead; a missing schema returns empty, not a throw.





2. Where the app actually is (verified, not remembered)

Shipped and working





20 app routes, 78 e2e tests (156 across two projects), 629 unit tests, 103 kB shared JS.



Generative interface: 20-key registry (lib/genui/registry.ts) → router → resolver →
AskCards.tsx. The router handles most questions with zero model calls.



Gaffer voice streams verified sentences only (lib/ai/verifyFigures.ts +
lib/ai/sentenceGate.ts), carries 4 turns of history, and offers routed follow-ups.



16 chart components in components/charts/.



Generative visuals: SeasonFingerprint exists (components/generative/, lib/generative/specs.ts).



Watchlist: lib/store/watchlistCore.ts + components/gaffer/watch/* + deadline board.



Resilience: route + global error boundaries, fail-safe cache/breaker, cronWriteGuard,
mapPool bounded concurrency, loading.tsx on heavy routes.

Surviving quant engines (lib/quant/) — pure, tested, mostly not on screen:







Module



What it computes



On screen?





strength.ts



Dixon–Coles fit, scoreProbability, lambdasFor



partially (fixture model)





decision.ts



crossover, chipOptionValue, transferThreshold



ask-card only





understanding.ts



shapleyLedger, processVsOutcome



ask-card only





estimators.ts



trueForm (Kalman) only



ask-card only





wpa.ts



win-probability-added



ask-card only





crowding.ts



positional crowding



ask-card only





correlationWeb.ts



simulateWeb, marginalRisk



partially

Important correction to any older plan you have been handed: the audit batch
(9a25394) deleted portfolio.ts, ladder.ts, committee.ts, projection/ts.ts,
template.ts and most of estimators.ts as unreferenced dead code. Anything in
docs/IMPLEMENTATION_PLAN.md phase F2/F3 that says "the engine is done, just build
the screen" is stale for those five. In particular there is no Cox
P(start)/P(60+) engine any more — task D2 rebuilds it rather than surfacing it.

Known debt





no-img-element disables in CrestBadge.tsx:33, PlayerPhoto.tsx:97 (CLS cost).



exhaustive-deps disables in FieldClient.tsx:420,507, TransferPlanner.tsx:245,280.



actions/checkout@v4 / setup-node@v4 across four workflows → Node 20 deprecation warnings.



One e2e (league scatter names its leaders) fails on the local mock only — it asserts
>26 scatter dots and the fixture league has exactly 26. Fix the fixture, not the test.





2b. The competition, and where GAFFER can actually win

Researched September 2026. Sources listed at the end of this section. Direct site
fetches are blocked from the build sandbox, so this is assembled from search results
and should be re-verified by opening the products before betting a milestone on it.

What they have







Product



Its real weapon



Does GAFFER have it?





Opta / Stats Perform



The underlying event feed since 2012: big chances, xA, %xGI, sequence involvement, set-piece takers



No, and cannot. FPL's public API does not publish it.





Fantasy Football Hub



Licensed Opta stats, points predictions, fixture analyser, player comparison, match centre, live rank, expert reveals from world-#1 managers, AI team rating from a screenshot upload, AI transfer suggestions with a Conservative/Optimized/Aggressive posture across seven parameters



Partly. No Opta, no screenshot import, no expert content.





FPL Review



Bookmaker-odds-derived projections with editable xMins, planner, and a solver. The "Massive Data" model is the public accuracy benchmark.



No solver of that class. No odds ingestion.





Solio Analytics



A sharp projection model paired with a state-of-the-art solver across the full branching gameweek tree, with relative risk as an explicit parameter



No. solverLite is single-window and was partly gutted in 9a25394.





Fantasy Football Fix



Instant squad optimisation, compare up to five players graphically on Opta+FPL stats, AI assistant manager (transfers, bench order, captaincy)



Compare is planned at 2–4 (D5). No bench-order advice.





Elevenify



An xMins model and a team-strength model, published openly. xMins is his entire differentiation.



Team strength: yes — lib/quant/strength.ts (Dixon–Coles) is genuinely competitive. xMins: no — deleted in 9a25394.





Ben Crellin



The blank/double gameweek calendar. The single most-consulted artifact in FPL.



No — and it is a spreadsheet, which is the opening.





OpenFPL



Open-source forecaster published on arXiv, claimed to rival FPL Review's model



Not used. Should be a calibration benchmark, not a dependency.



The three honest conclusions

1. Do not chase Opta. FFH licenses a feed GAFFER cannot buy. Every attempt to
approximate line-breaking passes or big chances from FPL's public fields produces a
number that looks authoritative and is invented — which is the one thing this codebase
has consistently refused to do. Compete on a different axis.

2. The solver gap is the real functional gap. Solio and FPL Review both optimise
across a branching multi-gameweek tree with risk as a parameter. GAFFER suggests
transfers for one window. This is the biggest capability difference and it is
buildable — lib/engines/planner.ts already enforces legality through checkSwap,
which is the hard part. See D6.

3. Everyone's AI is unverified. FFH and Fix both ship LLM advice. Neither, as far
as public material shows, verifies that the numbers in that advice came from their
own data. GAFFER already does — verifyFigures + sentenceGate drop any sentence
containing a figure absent from the facts object. This is a genuine moat and it is
already built. It should be stated on the marketing surface, not hidden in a lib.

Where GAFFER wins, ranked by how defensible it is





Verified AI. Nobody else can claim their assistant cannot hallucinate a number.



Provenance on every stat (D8) — the only tool that says whether a figure is

FPL-published, model-estimated, or unavailable. The competition mixes Opta-derived
 and FPL-published numbers with no visible seam.



The generative interface (§9) — an answer that assembles itself as a screen.

No FPL product ships this. It is already half-built.



Calibrated uncertainty — intervals, greyed-out thin coverage, honest "—".

The competition presents point estimates with no error bars.



The Shapley ledger (D1) — "your captaincy was worth +34, your hits −16".

Nobody ships a decision-attribution view.



Generative share assets (E1/E3) — the Season Fingerprint has no equivalent.



A personal blank/double calendar (D7) — Crellin's sheet is universal;

yours knows the fifteen players you own.



Speed and design. Most of these tools are dense, slow and desktop-first.

GAFFER is 103 kB shared JS and phone-first. Do not lose this.

Sources:
Fantasy Football Hub tools ·
FFH 26/27 launch ·
FFH Opta stats guide ·
Ben Crellin BGW/DGW calendar ·
Solio FPL ·
Solio open-fpl-solver ·
FPL Review ·
About FPL Review ·
Fantasy Football Fix ·
elevenify ·
Opta Analyst — PL player stat predictions ·
OpenFPL (arXiv)





Workstream A — UI/UX

The app is competent and honest. It is not yet memorable. A is about the two
things that decide whether somebody comes back: how fast they get to the one
number they opened the app for, and whether the app feels like it was made
for this sport.

A1 — The Deadline Cockpit (highest value in the whole plan)

Goal. A manager opens the app in the ninety minutes before a deadline with one
question: am I done? Today they must visit Planner, Deadline, Board and Field to
answer it. One screen should answer it.

Files. New app/(app)/deadline/page.tsx rework; new
components/gaffer/deadline/Cockpit.tsx; reuse lib/server/buildPlanner.ts,
lib/engines/availability.ts, lib/engines/planner.ts, the new watchlist route.

Approach. A single scrollable column of verdicts, not data. Each block states a
conclusion in one line and expands to the evidence:





Your XI is legal / You are one short at the back — from checkSwap rules.



2 starters are flagged — Timber, Saliba — with the FPL words verbatim.



Captain: Haaland — with the runner-up and the gap, from the captaincy engine.



1 free transfer unused — with the top recommendation and its window gain.



3 of your watchlist are within 4h of a rise — from the price pressure model.



Nothing else to do. — the block that makes the screen worth opening.

Each block is <details>-shaped: verdict always visible, evidence one tap away.
Blocks that have nothing to say collapse to a single tick line, they do not
render an empty card.

Acceptance. A manager with a legal, fully-planned squad sees six green lines and
no scrolling on a 390 px viewport. Every verdict traces to an engine — no verdict is
computed in the component. e2e asserts both the "all clear" and "three problems" states.

A2 — Command palette (⌘K / long-press)

Goal. Twenty routes and no way to jump. Power users navigate by typing.

Files. New components/gaffer/CommandPalette.tsx; mount in AppShell.tsx.

Approach. Fuse-free — a simple ranked substring match over three sources: routes,
the 20 registry keys (so ⌘K → "captain" opens the captain card), and player names
from bootstrapLite. On mobile, long-press the brand. Reuse the existing Sheet
primitive, do not introduce a dialog library.

Acceptance. Opens in <100 ms with no network call. Keyboard-only operable, focus
trapped, Esc closes and restores focus. Works with prefers-reduced-motion.

A3 — Kill the two no-img-element disables

Goal. Every page with faces or crests currently shifts layout as images arrive.
This is the single biggest visual-quality defect in the app and it is measurable.

Files. components/gaffer/PlayerPhoto.tsx, components/gaffer/CrestBadge.tsx,
next.config.ts (images.remotePatterns for the PL CDN).

Approach. next/image with explicit sizes and fixed intrinsic dimensions. Keep
the existing kit fallback path — PlayerAvatar + useAvatarMode stays the public API.

Acceptance. Both eslint disables deleted. CLS measured before/after on /squad
and /players with a scripted Playwright trace; record both numbers in the commit
message. AVIF/WebP served.

A4 — Empty, loading and failure states as a designed set

Goal. The app degrades honestly but inconsistently — some surfaces say
"Nothing here.", some render an empty list, some show a skeleton.

Files. New components/gaffer/states/ (EmptyState, HonestFailure,
ThinCoverage); sweep every page.tsx and board.

Approach. Three shapes only. Empty = "you have not done the thing yet" + the
action. Thin coverage = "the model does not have enough data to be worth showing"





what would fix it. Failure = "upstream did not answer" + retry. Never a spinner
where a skeleton of the real shape can go.

Acceptance. Grep shows no bare "Nothing here." strings left. One e2e per shape.

A5 — Motion pass

Goal. The generative interface's whole point (§9 of the UI doc) is watching the
interface assemble itself. Today cards appear instantly.

Files. components/gaffer/ask/AskCards.tsx, AskBar.tsx, globals.css.

Approach. 60 ms staggered fade-and-rise per arriving component, as specced.
Chrome only — the data inside must not animate, and numbers must never count up
(a counting number is a number you cannot read). Everything behind one
@media (prefers-reduced-motion: reduce) block that sets duration to 0.01ms.

Acceptance. e2e asserts that with reduced-motion emulated, the final DOM is
identical and reached within one frame.





Workstream B — Gaffer, the AI assistant

The honesty layer is built and verified: the gaffer can only quote figures that
appear in the facts object, and the sentence gate means nothing unverified is ever
painted. Do not weaken that. Everything below is built on top of it.

B1 — Give the gaffer tools instead of one shot at one card

Goal. Today the pipeline is: route the question → resolve one card → the voice
comments on it. So "should I take a hit for Haaland and who do I sell" produces one
card and a sentence. A real assistant would price the hit, check the sale, and check
the fixture.

Files. New lib/ai/tools.ts; app/api/ask/route.ts; lib/genui/resolve.ts.

Approach. Wrap the existing resolvers as typed tools — the registry already is
a tool schema, it just isn't exposed as one. Loop: model names a tool + params →
server executes it → result appended to the facts object → model may call again,
max three calls, 6 s budget. The facts object grows with each call, so the
sentence gate's allowed-figure set grows with it and stays correct for free.

If MuseSpark has native tool calling, use it. If not, keep the JSON-reply contract
{"tool":"<key>","params":{}} that modelSelect already uses.

Acceptance. Multi-part questions return multiple cards in one answer. The
zero-model router path is unchanged and still handles single-intent questions
without any model call (existing router tests must pass untouched). A test proves
the loop terminates at three calls and degrades to the current behaviour on timeout.

B2 — Proactive briefings

Goal. An assistant that only answers is a search box. The gaffer should open with
something worth knowing.

Files. New lib/ai/briefing.ts; surface on /live and the A1 cockpit.

Approach. Deterministic trigger detection in TypeScript, not in the model —
the model only writes the sentence, from facts it is handed. Triggers: a starter
flagged since last visit; a watchlist player within 4 h of a price change; your
captain benched; a rival's differential hauling; a chip window opening. Store
last_seen_at per team in localStorage so "since last visit" is real.

Acceptance. With no triggers, the gaffer says nothing at all rather than padding.
Every briefing sentence passes verifyFigures against the trigger's own facts.

B3 — Personas that differ in judgement, not adjectives

Goal. Four personas currently differ in tone. They should differ in what they
advise, which is the only difference a user can feel.

Files. lib/ai/personas.ts, lib/engines/planner.ts (risk parameter).

Approach. Give each persona a numeric risk posture that feeds the engine, not
the prompt: Oleg the tactician weights fixture run, Ana weights EO/differential
exposure, Kofi weights form, Mei weights minutes certainty. Same question, same
facts, genuinely different recommended transfer — and the card shows why.

Acceptance. A test asserts that for one fixed squad and gameweek, at least two
personas return different top recommendations, and that each one's stated reason
matches its weighting.

B4 — Answer quality harness

Goal. There is no way to tell whether a prompt change made the gaffer better.

Files. New lib/ai/evals/ with ~40 fixture questions + expected routed component,
run under vitest with a stubbed model.

Approach. Assert the routing and the figure-verification, never the prose.
Every question must route to the right component and produce zero invented figures.
This is a regression gate, not a taste test.

Acceptance. pnpm test covers it. Any prompt change that drops routing accuracy
below the recorded baseline fails CI.





Workstream C — Performance

Shared JS is 103 kB, which is respectable. The problem is not bundle size, it is
time to the first useful number on a cold, mid-gameweek load.

C1 — Measure before optimising

Files. New scripts/perf.mjs (Playwright trace), docs/NOTES.md.

Approach. Script LCP, CLS, TTFB and total transfer for /live, /field,
/planner, /players on a throttled 4G profile, cold cache, against the local mock.
Record the numbers. No optimisation task in C may be committed without a
before/after pair from this script in its commit message.

C2 — Streaming the Field

Goal. /field composes the full matchday model before it paints anything.

Files. app/(app)/field/page.tsx, components/gaffer/field/FieldClient.tsx.

Approach. Split into Suspense islands so the pitch and the hero figure stream
first, boards after. The below-fold chart chunking is already done — this is about
the above-fold critical path.

Acceptance. LCP on /field improves measurably against C1's baseline.

C3 — Fix the four exhaustive-deps disables

Goal. These are not style violations, they are latent stale-closure bugs in the
two most stateful components in the app.

Files. FieldClient.tsx:420,507, TransferPlanner.tsx:245,280.

Approach. Extract stable callbacks with useCallback/useEvent-shaped helpers.
If a dep genuinely must be excluded, that is a design smell — restructure the state.

Acceptance. All four disables deleted, planner e2e still green.

C4 — Payload budget as a CI gate

Files. .github/workflows/ci.yml, new scripts/budget.mjs.

Approach. Assert shared JS ≤ 115 kB and /api/gaffer/live ≤ 60 kB. Fail the build
on regression. A budget nobody enforces is a comment.

C5 — Workflow hygiene

Bump actions/checkout@v4 → @v5 and actions/setup-node@v4 → @v5 across all four
workflows. Small, and it stops the deprecation noise hiding a real warning later.





Workstream D — Stats and graphs

This is the differentiator. Nobody else in FPL ships calibrated uncertainty.

D1 — Promote three quant engines to real screens

Goal. shapleyLedger, crossover and trueForm are tested, correct, and only
reachable by asking the right question. They deserve routes.

Files. New app/(app)/understanding/page.tsx; new chart components.

Approach. Three surfaces, per the v3 spec:





Ledger waterfall (shapleyLedger) — what each decision was actually worth this
season. Efficiency-guaranteed, so the bars sum to your total. This is the single
most compelling screen in the whole product: "your captaincy has been worth +34,
your hits −16."



Process vs outcome (processVsOutcome) — the four luck channels with explicit
hold/act advice. Tells a manager when a bad week was variance, which is the thing
every FPL manager wants and nobody can get.



True-form ribbon (trueForm) — Kalman mean with a ±1.96√P band, dot size by
minutes. Says "this is form, this is noise" visually.

Acceptance. Every interval labelled with its method via <Est>. Cohorts below
the minimum sample are greyed out with the reason stated, never silently plotted.

D2 — Rebuild the minutes model (Cox), then surface it

Goal. Will he start? is the most-asked question in FPL and the app cannot answer
it. The old Cox engine was deleted as dead code in 9a25394.

Files. New lib/quant/minutes.ts + tests; surface on PeekSheet, planner OUT rows,
and the A1 cockpit.

Approach. Fit from element-summary history: starts, minutes, substitution
patterns, and rotation around congested fixtures. Output P(start) and P(60+) as
probabilities with intervals, never as a binary flag. Grey out honestly when a
player has too few appearances — a new signing has no history and the model must say
so rather than guess.

Acceptance. Colocated tests with deterministic fixtures. Every displayed
probability wrapped in <Est>. A player with <3 appearances renders "not enough
history", not a number.

D3 — Deadline EO predictor

Files. New lib/engines/eoPredict.ts; surface on Board + watchlist sort.

Approach. Velocity from price_snapshot + news-tag spikes + time-decay to the
deadline, with a confidence band. Reuse the lib/engines/price.ts patterns. Grey out
with a stated reason when snapshot coverage is thin — the watchlist board already
does exactly this with "—", follow that precedent.

D4 — Charts as one system

Goal. 16 chart components, built at different times, with inconsistent axis,
tooltip and legend behaviour.

Files. components/charts/*, components/charts/ChartFrame.tsx.

Approach. Every chart goes through ChartFrame: same axis treatment, same tooltip
shape, same empty state, same "table" toggle for accessibility (some already have
one — make it universal). Verify the 8-slot palette is actually used and that no
chart encodes data in green on the pitch or in a UI accent.

Acceptance. An audit script greps for raw hex and non-palette colours in
components/charts/ and fails CI on a hit.

D5 — Player compare, properly

Goal. The percentile panel ranks one player. Managers decide between two.

Files. New app/(app)/compare/page.tsx.

Approach. Up to five players side by side — Fantasy Football Fix ships five, so
four reads as a worse version of a known product. Percentile bars, fixture strips,
xPts lines, minutes certainty from D2, and price trajectory. Shareable via URL so a
mini-league argument can be settled with a link.

D6 — The branching solver (the biggest functional gap)

Goal. Solio and FPL Review both optimise across a branching multi-gameweek tree
with an explicit risk parameter. GAFFER suggests transfers for one window. Until this
exists, a serious manager uses GAFFER and one of them.

Files. New lib/engines/solver/ (tree.ts, beam.ts, chips.ts) + tests;
lib/server/buildPlanner.ts; components/gaffer/planner/*.

Approach. Do not attempt a MILP in the browser or a Python service — the
existing architecture is pure-TS engines and that is a real advantage. Use a
beam search over the gameweek tree:





State = (squad, bank, free transfers, chips remaining, gameweek).



Branch = the legal moves from checkSwap (already written and tested), plus "roll",
plus each unused chip.



Score = Σ projected points over the horizon − hit cost, with an explicit
risk parameter λ trading expected points against variance from
lib/engines/simulate.ts.



Prune to the top-K states per gameweek (K≈50) so a six-week horizon stays inside a
request budget. Record K and the horizon in the UI so the user knows it is a
heuristic, not a proof of optimality — claiming optimality you cannot prove is
the same sin as inventing a number.

Expose λ as the persona posture from B3, not as a slider full of jargon. "Ask Ana"
and "ask Oleg" is a better interface than seven numeric parameters, and it is the same
underlying knob FFH exposes as Conservative/Optimized/Aggressive.

Acceptance. Deterministic tests: a fixed squad + fixed projections returns a stable
plan; every move in every returned plan passes checkSwap; a higher λ demonstrably
returns a lower-variance plan. The UI states the horizon, the beam width, and that the
result is the best found, not the best possible.

D7 — The personal blank/double gameweek calendar

Goal. Ben Crellin's spreadsheet is the most-consulted artifact in FPL and it is
universal — it tells everyone the same thing. A calendar that knows your fifteen
players tells you something.

Files. New lib/engines/gwProfile.ts (or extend the existing profile computation)





tests; new surface on /deadline and the A1 cockpit.

Approach. From the fixture list, derive per-club blank and double likelihood for the
remaining season, then overlay your squad: "GW29 you have 9 starters, GW33 you have
14 and two doubles." Chip windows fall straight out of it — the best Bench Boost week is
simply your fullest week. Show confidence, because unplayed cup rounds mean these are
probabilities, not fixtures; anything below a stated threshold renders as "possible",
never as scheduled.

Acceptance. A test fixture with a known blank produces the right starter count.
Every "likely" label carries its probability. No fixture is asserted as confirmed
unless FPL has published it.

D8 — Provenance on every number (the honesty moat, made visible)

Goal. The competition mixes Opta-derived numbers, model output and FPL-published
figures with no visible seam. GAFFER already refuses to invent — but a user cannot
see that, so it reads as having fewer stats rather than more trustworthy ones.

Files. New components/gaffer/Provenance.tsx; extend <Est>; sweep the stat surfaces.

Approach. Three states, one visual language, shown on every figure:
published (FPL's own field — no decoration), estimated (our model — the existing
<Est> dotted underline plus method), unavailable (Opta-only — an explicit
"not published by FPL" affordance where a competitor would show a number).

That third state is the interesting one. On a player page, listing the metrics we
deliberately do not fake — big chances, pass completion, line-breaking passes — and
saying why, turns an absence into a statement about trustworthiness.

Acceptance. An audit script asserts every numeric leaf on the player, planner and
board surfaces is inside one of the three components. No bare figures.





Workstream E — Generative UI

§8 and §9 of architecture/GAFFER_V2_UI_UPGRADE.md describe this and it is the
thing that makes the app a category leader rather than a good dashboard.
SeasonFingerprint is built; the rest is not.

E1 — Gameweek Sigil (§8.2)

Files. lib/generative/specs.ts, new components/generative/GameweekSigil.tsx,
app/api/og/film/*.

Approach. One gameweek's swing sequence → a glyph: stroke angle = minute, length =
rank delta, colour = direction. Deterministic from mulberry32(entryId + gw) so the
screenshot, the app and the OG image agree. Canvas, DPR capped at 2, static once
drawn, skipped under prefers-reduced-motion and save-data.

Acceptance. Same input renders byte-identical twice. Used as /film's OG image.

E2 — Kit Weave (§8.3)

Files. New components/generative/KitWeave.tsx; background for /squad and /dna.

Approach. A woven pattern from the fifteen players' club colours, weighted by
minutes played. Regenerates on transfer. It must sit behind content at low contrast
and never compete with data — verify text contrast over the busiest possible weave.

E3 — Share cards that are worth sharing

Goal. Growth. A Season Fingerprint on a 1200×630 card with one killer stat is the
best acquisition asset this product will ever have, and it costs almost nothing
because the generator already exists.

Files. app/api/og/*.

Approach. Server-render the fingerprint/sigil into the OG image. One hero figure,
the manager's name, and a single line — "top 4% at captaincy". Cache aggressively.

E4 — The interface that assembles itself

Goal. §9's actual promise: an answer that arrives as a composed screen, not a
card.

Files. AskCards.tsx, app/api/ask/route.ts, lib/genui/.

Approach. With B1 landed, a multi-tool answer already returns several components.
Lay them out as a generated mini-dashboard — hero figure, supporting charts, sources —
with the A5 stagger, so you watch it build. This is the demo that sells the product.

Acceptance. Layout is chosen from a small set of deterministic templates by
component count and type — not free-form generated markup from the model. The
model never emits layout code; it names components, exactly as it does today.





3. Sequencing

Do not build in workstream order. Build in value order.

Milestone 1 — "it answers the deadline question" (highest user value)
C1 (measure) → A1 (cockpit) → D2 (minutes model) → A3 (next/image) → A4 (states)

Milestone 2 — "the assistant is actually an assistant"
B4 (eval harness first, so B1 is measurable) → B1 (tools) → B2 (briefings) → B3 (personas)

Milestone 3 — "close the solver gap" (this is what a serious manager leaves for)
D7 (personal blank/double calendar — cheapest big win) → D6 (branching solver) → D5 (compare five)

Milestone 4 — "nobody else has this"
D8 (provenance) → D1 (ledger + process/outcome + true form) → D3 (EO predictor) → D4 (chart system)

Milestone 5 — "people share it"
E1 (sigil) → E3 (share cards) → E4 (assembling interface) → E2 (kit weave) → A5 (motion) → A2 (palette)

Continuous — C3, C4, C5 fold into whichever milestone touches those files.





4. Anti-goals

Things that would make the app worse and must not be built:





Any number the model produced. The sentence gate exists for a reason. If a
figure is not in the facts object it does not go on screen.



A confident projection where coverage is thin. Grey it out and say why. The
watchlist's "—" is the house style.



Model-generated layout or markup. The model names components; the server
resolves them; TypeScript renders them.



An account system. The watchlist is deliberately localStorage. Do not ask for
a login to enable a feature until the app has earned one.



A single fixture-difficulty index. Two numbers, always.



Animation on data. Chrome moves; numbers do not.



New chart libraries. 16 components already exist and share a palette.



Approximating Opta. Big chances, pass completion, line-breaking passes and
crosses are not in FPL's public API. Deriving a lookalike from what is available
produces an authoritative-looking invention. Say it is unavailable (D8) instead.



Claiming optimality. The D6 solver is a heuristic beam search. It returns the
best plan it found, and it must say so.



A screenshot importer. FFH does this; it is a workaround for not having the
entry id, which GAFFER already asks for once and remembers in a cookie.





5. Definition of done (per task)





pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e all green.



New engine logic has colocated *.test.ts with deterministic fixtures.



New surfaces have at least one e2e covering the populated and the empty state.



Every estimate wrapped in <Est> with a truthful method string.



Screenshot the surface on a 390 px viewport and look at it. Three real bugs this

season were found by screenshotting and none of them by types — the clean-sheet
 percentile that exceeded 100 %, the keeper DEFCON lane that does not exist, and
 the watchlist route returning an empty 200.



Commit message explains why, in prose, including what was considered and

rejected. One commit per task. Author Tumi <Tumeloxmalebo@gmail.com>.



Push to main only when CI is green. 