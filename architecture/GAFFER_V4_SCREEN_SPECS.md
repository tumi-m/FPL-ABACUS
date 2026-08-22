# GAFFER v4 screen specs — Field + Entry (engineering digests)

Full prose lives with the author; these digests carry every build rule. Board spec:
`GAFFER_BOARD_PAGE.md`. Style: stadium blue rev-02.

## THE FIELD (/field) — expands shipped phase C
Pitch: lit surface (floodlight radial + % mowing stripes + linear 178deg #08213D→#030F22 base),
inset base shadow, REAL markings SVG @40% (boxes/six-yard/centre/halfway), FLAT no perspective.
Token: inline SVG shirt club rail + 12% darker sleeves via color-mix, NEVER remote crest; 64px/52px;
captain=volt armband ARC (TC=double); DEFCON=surge arc to threshold (locks 10/12); bonus=≤3 amber dots;
auto-sub=ultra ⇅ BETWEEN tokens drawn once; flagged=flare triangle. States: yet-to-play volt ring,
live=pulse only while phase live, done=55%.
SIX modes on one control, mode in URL (?mode=), cross-fade encoding 240ms NEVER re-layout:
1 Points · 2 Ownership (EO wash fade template / magenta halo differentials + app-wide cohort selector)
· 3 Swing (surge↔flare halos by magnitude, pill shows ±86.4k) · 4 Leverage (EV of minutes remaining,
finished→25%) · 5 Correlation (arcs surge+/flare− thickness|ρ| over pitch + "6.2 effective bets/11";
needs v3-4) · 6 Risk (token SIZE=marginal variance contribution wᵢ(Σw)ᵢ/w'Σw; neutral colour).
Compare: shared players ON halfway line dimmed 40%; differentials pulled to owner's half (yours volt,
theirs ultra); header gap+win-prob+top driver; deep-link ?compare=id; entry points league row/rivals tab.
Peek: ONE shared sheet component everywhere (tokens, league table, swing feed, chart tooltips);
long-press/right-click quick actions. Keys 1–6 modes, c compare; swipe cycles mobile.
Live: poll 20s live-phase only, pause hidden, DIFF model → animate ONLY changed tokens (count-up+wash,
finish fade 600ms, ⇅ draws once). States w/ real copy: gate ?next=/field passthrough, pre-deadline
provisional XI countdown (modes 3–4 disabled WITH reason), picks-404→deadline link, BB all-15,
blank dims "—", 5–6 greyed pre-Σ, reduced-motion static. Own generateMetadata + OG /api/og/field/[entry].
Perf: pitch+markings one static SVG, tokens DOM nodes; memoise formation coords; arcs second layer;
mode<100ms. Build order: surface/markings/coords → token states → modes1–2+URL → peek(reuse) →
modes3–4 → live diff-polling → compare → metadata/OG → modes5–6 post-v3-4.

## ENTRY GATE (/) — "login" without accounts
ONE input ONE button (never two fields): parseInput(raw) order: entry URL /entry/{id} → league URL
/leagues/{id} → bare #?digits → name search. Paste hint chip before submit ("Looks like a team link").
Validation = real request /api/fpl/entry/{id} + CONFIRMATION chip (team · manager · rank — is this you?)
before storage. localStorage['gaffer.teams'] AND gaffer_team cookie (SameSite=Lax, 400d) both written;
all reads try/catch, never during render; NEVER auto-navigate on load; recent chips ≤5 w/ × forget;
multi-team switcher in header; "forget this device" clears both.
ID-explainer sheet: annotated address bar in HTML (volt highlight digits + leader label) Route1 web /
Route2 app share-link / Route3 league link (FIRST on mobile). League route: standings page1 50 rows →
pick-list w/ filter focused >50, paginate; >500k members refuses politely. Old-domain/mobile deep links
caught by path regex. API down → accept optimistically + stale bar. Viewing others' team = by design
("Viewing" header + make-mine tap).
Name search: NO FPL endpoint exists — build manager_index from tuples ALREADY fetched (cohort ~30k/GW,
league snapshots, rank-curve sample; zero extra upstream) + weekly top-500k crawl (~20min off-peak).
Table w/ pg_trgm gin indexes (entry_name, player_name) + rank idx; query exact-match-first then
GREATEST(similarity) score then last_rank ASC LIMIT 25, threshold .3. Rows DISAMBIGUATE: manager ·
region · fav club crest tile · rank (+club flag rail). Empty ⇒ "We haven't seen that team yet"
(coverage honesty, never "no results"). Privacy: index ONLY what standings show; no profiles/browse
endpoint; one-click remove-me suppression list persisted.
Visual §8 — the sanctioned exception: WARM amber ground (.gate gradients #C07100→#FFC035 washes),
navy reserved for input/button/type (h1 navy-on-amber 8.9:1); skew/bevel/Saira-oblique ranks still apply.
Player cutout bleeds off left, duotone; mobile behind content @25%. LIKENESS WARNING: don't build hero
on named FPL player photo — silhouette/kit/crowd instead (licence risk).
Build order §11: 1 parser+validation-confirm → 2 layout/palette/cutout → 3 recents+switcher →
4 explainer sheet → 5 league pick-list → STOP for review. Steps 6–8 (index/crawl/search) LATER once
traffic fills; free-text shows coverage copy until then.
