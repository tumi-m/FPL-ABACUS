# GAFFER — Style guide

## "FLOODLIGHT", revision 02 · stadium blue

**Supersedes §1 (palette), §2 (visual devices), §3 (club identity), §4 (motion) and §5 (components) of `GAFFER_V2_UI_UPGRADE.md`.**
Everything else in that document — the chart system, the Field view, the Board, the generative interface — still applies unchanged. Where the two disagree, this file wins.

**Rendered reference:** `floodlight-styleguide.html`. Copy CSS out of it; it is the same code as below.

---

## 1. The direction, in one paragraph

Midnight navy lit from the top corners by two floodlight banks. Electric cyan as the only system accent. Chrome-bevelled panels with a gloss pass. Chips, badges, buttons and fixture cells cut as 9° parallelograms. Every figure set in oblique Saira on its width axis, so numbers lean forward like a scoreboard. It is the FIFA 10 front end — a deep blue field, an EA interface blue, skewed menu tiles, italic numerals — translated for something you have to read data off.

**The discipline that keeps it from becoming a 2009 pastiche, and the rule to check every screen against:**

> **The skew, the gloss and the bevel apply to chrome. Never to data.**
> A chart mark, a table value and a player name are drawn flat and upright. The game-menu language wraps the interface; the numbers stay sober.

Break that and you get a game menu that happens to have numbers in it, instead of an analytics product with a game's confidence.

---

## 2. The nine cues

| # | Cue | Implementation |
|---|---|---|
| 1 | **Navy field** | Ground is `#010C1F`. Every neutral carries blue chroma — there is still not one grey in the system |
| 2 | **Floodlight banks** | Two radial gradients at `16% -8%` and `84% -8%`, ice and volt, 16%/13%. Fixed layer, never scrolls |
| 3 | **Stadium vignette** | A radial darkening from 42% outward, on the same fixed layer via `::after` |
| 4 | **One electric accent** | `--volt #0AD0FF` marks *you*, *live*, and the primary action. Nothing else gets to be that bright |
| 5 | **Chrome bevel** | `inset 0 1px 0 rgba(230,248,255,.16)` on every raised surface. One line; flat panels become moulded |
| 6 | **Gloss pass** | A `linear-gradient` over the top 42–48% of cards, tiles and rows. Once per component, never on text |
| 7 | **The 9° skew** | Chips, badges, buttons, tabs, meters, fixture cells, club flags. Content counter-skews so text stays upright. Cards and tables stay square |
| 8 | **Oblique numerals** | Italic Saira, `wdth 104–118`, on every figure. The single most FIFA thing in the system and it costs nothing |
| 9 | **Broadcast lower-third** | Screen headers are match graphics: an angled club-coloured flag at the leading edge, a gradient body, live state left, controls right |

Plus two atmospherics: a **115° hairline mesh** at 3% across the plane (you never consciously see it; you feel the surface has a material), and a **diagonal specular streak** across each stat tile that animates on hover.

---

## 3. Tokens

Paste this over the previous token block in `app/globals.css`.

```css
:root{
  color-scheme: dark;

  /* ground — midnight navy, every step blue-tinted */
  --bg-base:#010C1F;      /* the plane                          */
  --bg-sunk:#000513;      /* wells, tracks, inputs              */
  --bg-raised:#061A31;    /* cards, rows, chart surface         */
  --bg-overlay:#0E2945;   /* sheets, popovers                   */
  --line:#1E3957;
  --line-hi:#36597D;

  /* ink — steel, never neutral */
  --ink-hi:#EFF8FF;       /* 18.20:1 on base */
  --ink-mid:#B4CBDF;      /* 11.69:1 */
  --ink-lo:#87A2BB;       /*  7.37:1 — AA for body, not just metadata */

  /* accents — one meaning each */
  --volt:#0AD0FF;         /* 10.69:1 — you · live · primary action */
  --ice:#9DF0FF;          /* 15.22:1 — chrome highlight · bevels   */
  --surge:#2CF2B6;        /* 13.49:1 — gain · rank improved        */
  --flare:#FF525B;        /*  6.16:1 — loss · threat · risk        */
  --ultra:#A97AFF;        /*  6.44:1 — the field · rivals · model  */
  --amber:#FFC035;        /* 11.96:1 — bonus · price movement      */
  --magenta:#F86CCA;      /*  7.44:1 — differential · ownership    */
  --on-accent:#04121F;    /* 10.33:1 on volt                       */

  /* fixture heat — blue-forward sequential, hard → easy */
  --heat-1:#4A3191; --heat-2:#3A55B1; --heat-3:#0080CC;
  --heat-4:#00B3D4; --heat-5:#00DCCA; --heat-6:#5EF8B1;

  /* atmosphere */
  --flare-l:rgba(157,240,255,.16);
  --flare-r:rgba(10,208,255,.13);
  --flare-b:rgba(169,122,255,.10);
  --mesh:rgba(10,208,255,.030);
  --vignette:radial-gradient(130% 100% at 50% 42%, transparent 42%, rgba(0,3,10,.55) 100%);

  /* chrome */
  --gloss:linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,0) 42%);
  --bevel:inset 0 1px 0 rgba(230,248,255,.16);
  --lift:var(--bevel), 0 20px 44px -20px rgba(0,0,0,.9), 0 0 0 1px var(--line);
  --glow:var(--bevel), 0 0 0 1px rgba(10,208,255,.45), 0 14px 44px -12px rgba(10,208,255,.42);

  /* geometry & type */
  --skew:-9deg;
  --f-d:"Saira",system-ui,sans-serif;    /* display + every numeral, italic */
  --f-u:"Barlow",system-ui,sans-serif;   /* everything you read, upright    */
  --r-sm:6px; --r-md:10px; --r-lg:16px; --r-xl:24px;
}

@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]){
    color-scheme: light;
    --bg-base:#EFF7FF; --bg-sunk:#E2EDF8; --bg-raised:#FAFEFF; --bg-overlay:#FFFFFF;
    --line:#CCDDEE; --line-hi:#A5BDD7;
    --ink-hi:#0B1D36; --ink-mid:#3D516B; --ink-lo:#5C748E;
    --volt:#0076B7; --ice:#008FB3; --surge:#008D61; --flare:#CE0B23;
    --ultra:#6A35D9; --amber:#BC7400; --magenta:#B82989; --on-accent:#FFFFFF;
    --heat-1:#6A53BD; --heat-2:#5778DF; --heat-3:#3BA6F5;
    --heat-4:#28D3F4; --heat-5:#47F5E3; --heat-6:#82FFC5;
    --flare-l:rgba(0,118,183,.10); --flare-r:rgba(0,143,179,.09); --flare-b:rgba(106,53,217,.07);
    --mesh:rgba(11,29,54,.028);
    --vignette:radial-gradient(130% 100% at 50% 42%, transparent 46%, rgba(11,29,54,.10) 100%);
    --gloss:linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,0) 46%);
    --bevel:inset 0 1px 0 rgba(255,255,255,.95);
    --lift:var(--bevel), 0 18px 36px -22px rgba(11,29,54,.34), 0 0 0 1px var(--line);
    --glow:var(--bevel), 0 0 0 1px rgba(0,118,183,.4), 0 14px 40px -14px rgba(0,118,183,.32);
  }
}
:root[data-theme="light"]{ /* the entire light block again, verbatim */ }
```

**Never define a colour only inside a media query.** Dark lives on bare `:root`; light overrides in both scopes so the toggle wins in either direction.

### Contrast, verified

| Token | vs `--bg-base` | vs `--bg-raised` | Use |
|---|---|---|---|
| `--ink-hi` | 18.20 | 16.29 | headings, values |
| `--ink-mid` | 11.69 | 10.46 | body |
| `--ink-lo` | 7.37 | 6.60 | metadata, axis ticks |
| `--volt` | 10.69 | 9.57 | you, live, CTA |
| `--surge` | 13.49 | 12.07 | gains |
| `--flare` | 6.16 | 5.51 | losses |
| `--ultra` | 6.44 | 5.76 | rivals, model |

**Light-mode caveat:** `--ice` (3.48) and `--amber` (3.45) clear the 3:1 non-text bar but not 4.5:1 for small copy. In light mode they are fills, marks and icons only. **Text always wears ink tokens** — which is the dataviz rule anyway: text never wears the data colour.

---

## 4. Fixture heat

Blue-forward, deliberately **not** red-to-green. Every FPL tool uses red/green, which is the worst possible pair for the ~8% of users with deuteranopia. Indigo → azure → cyan → spring green gives the identical instant read, stays fully separable under every CVD simulation, and belongs to this palette rather than fighting it.

| Step | Dark | Light | Meaning |
|---|---|---|---|
| 1 | `#4A3191` | `#6A53BD` | hardest |
| 2 | `#3A55B1` | `#5778DF` | |
| 3 | `#0080CC` | `#3BA6F5` | |
| 4 | `#00B3D4` | `#28D3F4` | |
| 5 | `#00DCCA` | `#47F5E3` | |
| 6 | `#5EF8B1` | `#82FFC5` | easiest |

- **Ink rule:** white on steps 1–3, `--on-accent` on steps 4–6. Switch on the step index, never by eye.
- **Driven by** opponent xGC/90 for your attackers and opponent xG/90 for your defenders — so the same fixture renders as two different colours on two different rows. If it doesn't, the Board isn't built.
- **Double gameweek:** `inset 0 0 0 2px var(--volt)`, both opponents stacked. **Blank:** `--bg-sunk`, no colour at all, so bad runs read as holes in the grid.

---

## 5. Typography

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira:ital,wdth,wght@0,75..125,300..900;1,75..125,400..900&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;1,600&display=swap">
```

**Saira** is a squarish variable grotesque with both a width axis and true italics — the combination is what makes a broadcast scoreboard possible without a novelty sports font. **Barlow** handles everything you actually read: slightly squared, sporty, excellent at 12px.

| Role | Family | Size | Weight | Style | Width | Tracking |
|---|---|---|---|---|---|---|
| Hero figure | Saira | `clamp(58px,9.5vw,98px)` | 900 | *italic* | 116 | −.05em |
| Screen headline | Saira | clamp(28px,3.8vw,44px) | 800 | *italic* | 104 | −.03em |
| Stat value | Saira | 46px | 800 | *italic* | 110 | −.04em |
| Table figure | Saira | 13–21px | 800 | *italic* | 100 | −.02em |
| Section heading | Saira | 28px | 800 | *italic* | 104 | −.03em |
| Card title | Saira | 16px | 700 | upright | 96 | .06em, uppercase |
| Eyebrow / label | Saira | 11px | 700 | upright | 88 | **.22em**, uppercase |
| Button / tab | Saira | 12–13px | 800 | upright | 100 | .12em, uppercase |
| Row title | Barlow | 14.5px | 700 | upright | — | — |
| Body | Barlow | 15–16px | 400 | upright | — | max 65ch |
| Meta | Barlow | 11.5–13px | 500 | upright | — | — |

**Rules:**
- **Every figure is italic. Every name is upright.** That contrast is the whole typographic idea.
- `font-variant-numeric: tabular-nums` in tables and axes only. Large standalone figures use proportional figures — tabular makes `121` look loose at 90px.
- Hero figures get the gradient fill: `linear-gradient(172deg,#FFF,var(--ice) 52%,var(--volt) 108%)` + `background-clip:text`. **One per screen.**

---

## 6. The skew system

```css
/* chrome skews; content counter-skews so text stays upright */
.chip, .badge, .btn, .meter, .cell, .crest, .flag, .tabbar span {
  transform: skewX(var(--skew));
}
.chip > *, .badge > *, .btn > *, .cell > *, .crest > *, .tabbar span > * {
  display: inline-block;
  transform: skewX(9deg);          /* the inverse — keep it literal, not calc(-1 * …) inside nested vars */
}
@media (max-width: 640px){ :root{ --skew: -6deg; } }   /* soften on narrow screens */
```

**Skew these:** chips, badges, buttons, segmented-control items, meters and their fills, fixture cells, crest tiles, club flags, section rules, the live dot.

**Never skew these:** cards, tables, table cells, charts, chart marks, player photos, body copy, input fields, or anything with a text cursor. Skewed text is harder to read and skewed inputs feel broken.

---

## 7. Chrome recipes

```css
/* the fixed atmosphere layer — one element, behind everything */
.atmos{
  position:fixed; inset:0; z-index:0; pointer-events:none;
  background:
    radial-gradient(58% 42% at 16% -8%, var(--flare-l), transparent 64%),
    radial-gradient(58% 42% at 84% -8%, var(--flare-r), transparent 64%),
    radial-gradient(80% 60% at 50% 118%, var(--flare-b), transparent 62%),
    repeating-linear-gradient(115deg, var(--mesh) 0 1px, transparent 1px 7px);
}
.atmos::after{ content:""; position:absolute; inset:0; background:var(--vignette); }

/* every raised surface */
.card{
  background:var(--bg-raised); border-radius:var(--r-lg);
  box-shadow:var(--lift); position:relative; overflow:hidden;
}
.card::before{                 /* the gloss pass */
  content:""; position:absolute; inset:0 0 auto; height:52%;
  background:var(--gloss); pointer-events:none;
}
.card > *{ position:relative }  /* keep content above the gloss */

/* the specular streak, on stat tiles only */
.tile::after{
  content:""; position:absolute; top:-40%; right:-20%; width:70%; height:180%;
  transform:rotate(24deg);
  background:linear-gradient(90deg,transparent,rgba(157,240,255,.07),transparent);
  transition:transform 600ms cubic-bezier(.22,1,.36,1);
}
@media (hover:hover){ .tile:hover::after{ transform:rotate(24deg) translateX(-160%) } }

/* broadcast lower-third — the header for every screen */
.lower3{ display:flex; border-radius:4px; overflow:hidden; box-shadow:var(--lift) }
.lower3 .flag{ width:12px; transform:skewX(var(--skew)) scaleX(1.4) }   /* club-coloured */
.lower3 .body{ flex:1; display:flex; align-items:center; gap:12px; padding:10px 16px;
               background:linear-gradient(180deg,var(--bg-overlay),var(--bg-raised)) }
```

---

## 8. Club identity

Unchanged from `GAFFER_V2_UI_UPGRADE.md` §3 — the twenty club colours still apply, and they still sit on a **blue** ground, so they read even more distinctly than before.

Two updates:
- The club colour is now applied as an **angled flag** (`skewX(-9deg)`), not a straight rail — 5px on player rows, 12px on lower-third headers.
- Crest tiles are 36×30 skewed rectangles with the code counter-skewed inside, `--bevel` applied.

And the standing rule: **the club colour is a decorative identity accent, always paired with the 3-letter code.** Three clubs are red and two are white; colour alone never encodes club.

---

## 9. Charts — read this before painting anything

**The UI accents are not a chart series palette.** They are spread across too wide a lightness range to work as categorical series; I ran them through the validator and they fail the lightness band as a set.

- **Series palette (unchanged, and re-verified against the new surface):** the validated 8-slot categorical set — `#3987e5 #d95926 #199e70 #c98500 #d55181 #008300 #9085e9 #e66767` — passes every check on `--bg-raised #061A31`: worst adjacent CVD ΔE 8.4, worst adjacent normal-vision ΔE 19.3, all slots ≥3:1. Assign in slot order, never cycled. For scatter/bubble/small-multiples, cap at the first three slots.
- **The one validated accent pair:** `--volt` (you) against `--ultra` (selected rival) measures ΔE 23.6 normal / 13.0 CVD — the strongest 1-v-1 pair in the system. Use it for every head-to-head view.
- **Single-mark emphasis** — one line, one bar, one endpoint — uses `--volt`. That's an identity mark, not a series.
- **Sequential** uses the heat ramp. **Diverging** uses `--ultra` ↔ `--flare` with `--line` as the neutral midpoint.
- `--surge` / `--flare` are for **discrete deltas** — always with an arrow glyph and the word "gained"/"lost", never colour alone.

Everything else in `GAFFER_V2_UI_UPGRADE.md` §6 stands: one y-axis, legend at ≥2 series, selective direct labels, 2px surface gaps between touching marks, a table-view toggle, `role="img"` with a full-sentence label, log-inverted rank axes. And charts are **never skewed and never glossed**.

---

## 10. Motion

| Event | Spec |
|---|---|
| Value changes | Count-up 420ms `cubic-bezier(.22,1,.36,1)` + a one-frame volt wash behind the figure |
| Rank improves / worsens | Motion `layout` spring reorder + a surge / flare left edge fading over 900ms |
| New swing event | Enters `translateY(-8px)` + opacity, 240ms. Feed never scroll-jumps |
| Fixture goes live | The club flag animates from `--line` to the club colour over 600ms |
| Live dot | 8px skewed volt square, expanding box-shadow ring, 2s. **The only continuously animating element**, and only while a fixture is actually in play |
| Tile hover | The specular streak sweeps across, 600ms. Desktop pointer only |
| Card hover | `translateY(-2px)` + shadow lift, 90ms |
| Sheet open | `translateY(100%)→0`, 240ms, backdrop blurs in over 160ms |
| Atmosphere trend | Floodlight bank tint interpolates over 1200ms — surge-weighted when your rank is rising, flare-weighted when falling |

```css
[data-trend="up"]   .atmos{ --flare-r: rgba(44,242,182,.15); }
[data-trend="down"] .atmos{ --flare-r: rgba(255,82,91,.13); }
```

`prefers-reduced-motion: reduce` — count-ups show final values instantly, layout animation off, pulse static, streak static, atmosphere static. Test it with the OS setting on; it is the most commonly broken accessibility feature in animated dashboards.

---

## 11. Migration from revision 01

| Old (green) | New (stadium blue) |
|---|---|
| `--bg-base #01100A` | `#010C1F` |
| `--bg-sunk #000905` | `#000513` |
| `--bg-raised #061E18` | `#061A31` |
| `--bg-overlay #1A253A` | `#0E2945` |
| `--line #1B3D32` / `--line-hi #2E5A4B` | `#1E3957` / `#36597D` |
| `--ink-hi/mid/lo #EBFAED #AFCDBB #80A594` | `#EFF8FF #B4CBDF #87A2BB` |
| `--lumen #ACF744` | **`--volt #0AD0FF`** (rename the token) |
| `--mint #00E7A0` | **`--surge #2CF2B6`** (rename) |
| `--cyan #28D7F3` | folded into `--volt`; use `--surge` for DEFCON meters |
| `--rose #FB75BB` | **`--magenta #F86CCA`** (rename) |
| `--flare #FF5171` | `#FF525B` |
| `--ultra #907CFF` | `#A97AFF` |
| `--amber #FFB825` | `#FFC035` |
| heat ramp indigo→lime | heat ramp indigo→azure→cyan→spring |
| Archivo + Manrope | **Saira + Barlow** |
| bloom + mowing stripes | **floodlight banks + vignette + 115° mesh** |
| square chips, 999px radius | **9° skewed chips, 3px radius** |
| upright numerals | **italic numerals** |
| no bevel | `--bevel` on every raised surface |

Search-and-replace order: rename `--lumen`→`--volt`, `--mint`→`--surge`, `--cyan`→`--volt` (check each site), `--rose`→`--magenta`. Then paste the new token block. Then swap the fonts. Then add `--bevel` and `--gloss` to `.card`, `.tile` and row components. Then apply the skew list from §6.

---

## 12. Acceptance

- [ ] `grep -rn "#[0-9A-Fa-f]\{3,8\}" app components lib` returns nothing outside `globals.css`
- [ ] No token contains `grey`, `gray`, `slate`, `zinc` or `neutral`
- [ ] Every raised surface has both `--bevel` and a gloss pass
- [ ] Every figure is italic Saira; every name is upright Barlow
- [ ] Exactly one gradient-filled hero figure per screen
- [ ] Nothing skewed contains a text cursor, a chart, or a table cell
- [ ] Fixture heat is blue→green, never red→green
- [ ] Chart series use the validated 8-slot palette, not the UI accents
- [ ] The live dot is the only thing animating when nothing is in play
- [ ] Reduced motion genuinely stops everything
- [ ] Both themes verified at 375 / 768 / 1440
- [ ] Desaturate a screenshot: the layout still reads
