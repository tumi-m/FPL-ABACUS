# GAFFER v2 — prompts for opencode

The spec lives in `architecture/`. Read order: `GAFFER_STYLE_GUIDE.md` (revision 02, stadium blue — **supersedes §1–§5 of `GAFFER_V2_UI_UPGRADE.md`; where they disagree, the style guide wins**) → `GAFFER_V2_UI_UPGRADE.md` §6–§11 → `GAFFER_V2_FEATURES.md`. The rendered reference is `floodlight-styleguide.html`.

---

## Session A — the repaint (do this alone, in one clean context)

> Read `architecture/GAFFER_V2_UI_UPGRADE.md` sections 1 through 5 in full. Do not read the other sections yet.
>
> Task: replace the design system. Steps, in order:
> 1. Replace the token block in `app/globals.css` with §1 verbatim, including both light blocks.
> 2. Run `grep -rn "#[0-9A-Fa-f]\{3,8\}" app components lib` and list every raw hex you find outside `globals.css`. Replace every one with a token. Report the list before and after.
> 3. Delete any token or class whose name contains `grey`, `gray`, `slate`, `zinc` or `neutral`.
> 4. Add the `.atmos` layer — floodlight banks + stadium vignette + 115° mesh (style guide §7) to the app shell, fixed and behind everything.
> 5. Add `config/clubs.ts` from §3 and wire club rails + crest tiles into every row component.
> 6. Swap the fonts to Saira (italic figures, `wdth` axis) + Barlow, per style guide §5. Tabular numerals in tables and axes only — never on large standalone figures.
>
> When done, screenshot `/leagues` at 1440 dark and 375 dark, and describe honestly what you see. If it still reads like default component-library output, say so and fix it before continuing.

## Session B — devices and motion

> Read style guide §10 (motion) and `architecture/GAFFER_V2_UI_UPGRADE.md` §4. Implement the motion table — including the skewed volt live dot, the tile specular streak and the `[data-trend]` atmosphere tint — plus the `prefers-reduced-motion` branch. Verify reduced motion by setting the OS preference and confirming that count-ups, layout animation, the live pulse and the atmosphere transition are all genuinely off.

## Session C — the Field

> Read §7 of `architecture/GAFFER_V2_UI_UPGRADE.md` and feature 1 of `architecture/GAFFER_V2_FEATURES.md`. Build the Field view with all four modes (Points, Ownership, Swing, Leverage) and compare mode. The pitch must be lit, not a green rectangle: radial floodlight gradient, 3% mowing stripes, 1px markings at 40% opacity. Shirt tokens are SVG filled with the club rail colour — do not use remote crest images in the token.

## Session D — charts

> Read §6 of `architecture/GAFFER_V2_UI_UPGRADE.md`. Build the fourteen charts as hand-written SVG using `d3-scale` and `d3-shape` only — do not add a charting library.
> Every chart: one y-axis, legend when there are two or more series, direct labels only on the endpoint or the extreme, 2px surface-coloured gaps between touching marks, a table-view toggle, and `role="img"` with a full-sentence label. Rank axes are log-scaled and inverted.

## Session E — The Board

> Read §10 of `architecture/GAFFER_V2_UI_UPGRADE.md` and features 11–14 of `architecture/GAFFER_V2_FEATURES.md`.
> Build the planner. Order: (a) the grid with position-aware colour, (b) horizon control and the three colour models, (c) transfer staging with the payback marker, (d) the chip lane with the GW19 wall as a constraint, (e) the ledger, (f) URL state encoding. Build the solver last and time-box it to 3 seconds server-side; label its output "suggestion" and never auto-apply it.
>
> The critical detail: a defender's cell is coloured by the opponent's xG/90, a forward's cell by the opponent's xGC/90. The same fixture must render as two different colours on two different rows. If it doesn't, the feature is not built.

## Session F — the generative interface

> Read §9 of `architecture/GAFFER_V2_UI_UPGRADE.md` in full before writing anything.
>
> Build in this order:
> 1. `lib/genui/registry.ts` — every component with a Zod param schema, a `describe` string, and a `resolve` function that calls existing engines.
> 2. `lib/genui/router.ts` — the free intent router. Cover at least 40 question shapes: captaincy, transfers, price, fixtures, differentials, DEFCON, ownership, chips, blanks/doubles, rivals. Test that "who should I captain", "is Saka going to rise", "who has the best fixtures" and "should I take a hit for Semenyo" all resolve with **no model call**.
> 3. The resolver + RSC streaming, staggered 60ms.
> 4. The model fallback, with a 4s timeout and a router-best-guess fallback on failure.
>
> Absolute rule: **the model selects components and parameters only. It never emits a number, a statistic or a player name that isn't an id from the supplied index.** All data comes from the resolver. If you find yourself putting figures in the model's output schema, stop — the architecture is wrong.

## Session G — generative visuals

> Read §8. Build the Season Fingerprint first — it is the share asset. Canvas, `devicePixelRatio` capped at 2, seeded with `mulberry32(entryId)` so the same manager always produces the same image and server-side OG rendering matches the client exactly. Then the Gameweek Sigil, then the Kit Weave, then the reactive aurora (12fps, off under reduced motion and `save-data`).

---

## The audit prompt — run after every session

> Audit the files you just wrote against `architecture/GAFFER_V2_UI_UPGRADE.md`. List every violation, then fix them. Check specifically for:
> raw hex outside `globals.css` · any grey/neutral token · an accent used for something other than its assigned meaning · more than one hero figure per screen · a drop shadow that is pure black · a chart with two y-axes · a red→green difficulty scale · a number that is estimated but not wrapped in `<Est>` · missing reduced-motion branch · a table without a table-view or a chart without an aria-label.

## The "it still looks generic" prompt

> Stop adding features. Open `floodlight-styleguide.html` and the screen you just built side by side. For each of these, say whether the screen has it, and add the ones it doesn't: the atmosphere layer behind the content, the chrome bevel + gloss pass on raised surfaces, angled club flags on every row, crest tiles instead of images, a gradient-filled hero figure, accent-tinted shadows (`--lift`/`--glow`, never pure black), italic Saira figures with upright Barlow names, meters instead of bare percentages, and exactly one accent per component.
