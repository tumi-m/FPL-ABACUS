# GAFFER v6 — THE ARCADE GAFFERS plan & progress

> Resume file. Four arcade-era character avatars become the face of the assistant: the user
> picks a gaffer, the gaffer speaks in a speech bubble with 90s typewriter streaming while the
> model generates. North-star mockup: `docs/photos/Gemini_Generated_Image_lzcs46lzcs.jpeg`
> (OLEG · KOFI · MEI · ANA character-select screen). Gates every phase: lint · typecheck ·
> vitest · build · e2e, one commit each.

## Locked decisions

- **Strict numbers rule holds.** The persona NEVER states figures. Every number in a bubble is
  a resolver-rendered stat chip beside the prose; system prompts forbid inventing numbers and
  instruct the persona to refer to the figures on screen. Template fallback keeps bubbles
  alive when the gateway is down.
- **Arcade sheet first:** the character select + speech console live inside the existing ⌘K
  AskBar sheet. A full `/arcade` route comes later, after the voices prove out.
- **Personas (mockup canon):**
  - OLEG — The Tactician (Europe): template captaincy, xG, clean-sheet odds, safe picks.
  - KOFI — The Maverick (Africa): low-ownership differentials, explosive captains, aggressive
    hit-taking.
  - MEI — The Scout (Asia): budget enablers, cheap defenders with underlying stats, bench
    structure.
  - ANA — The Fixture Specialist (South America): fixture swings, blanks/doubles, long-horizon
    chip planning; rainbow armband per mockup.
- **Voice constraints (every persona prompt):** ≤40 words · arcade-announcer tone · at most one
  exclamation mark · never numbers · always grounded in the resolved context.
- **Audio is synthesised, not shipped:** 8-bit blips via WebAudio square-wave oscillator — no
  audio files, no licences, no autoplay issues (starts only after a user gesture); muted by
  default with a persisted toggle.
- **Avatar art phase 1:** stills cropped from the mockup with CSS breathing/talking motion
  (transform only, stopped under prefers-reduced-motion). Real 2-frame sprite sheets are a
  later swap when the user generates them.

## Phases

### V6-A — persona registry ✅ (this commit)
- [x] `lib/ai/personas.ts`: canon ids/names/regions, identity accent tokens
      (`--persona-*` in globals.css, name-paired, never meaning-coded), prompt fragments with
      distinct lenses, `personaPrompt(persona, context)` (voice + pinned GAFFER_CONSTRAINTS +
      resolved facts), deterministic `personaFallback` (number-free by construction). 9 tests.

### V6-B — arcade console in the AskBar sheet ✅ (this commit)
- [x] Character-select strip: four skewed tiles with avatar stills (cropped from the owner's
      mockups into `public/avatars/`), volt ring on the active gaffer, accent rail, choice
      persisted (`gaffer_gaffer`).
- [x] Speech bubble: pixel-border chrome (accent rail + hard shadow, skew-free content),
      token-by-token typewriter (18ms/char, 130ms punctuation pause) mapped from the NDJSON
      stream; blinking caret; breathing idle / talking bounce avatar states.
- [x] Stat chips — resolver cards render below the bubble untouched; persona prose never
      carries figures (`scrubFigures` server-side strips slips before they can ship).
- [x] WebAudio blips while typing (square-wave chirp, punctuation tick), pause at
      punctuation, toggle persisted (`gaffer_blips_muted=1` mutes; default on — the Ask
      submit is the user gesture unlocking the AudioContext). Reduced-motion: instant text,
      no blips, static avatar.
- [x] `/api/ask` accepts `persona`, streams `{type:"gaffer"}` before the card; mobile Ask
      trigger added (44px, header). e2e pins strip, selection, bubble + API persona (58✓).

### V6-C — context passing ⬜
- [ ] `/api/ask` accepts the persona id; resolver context summary (GW, team structure, rank)
      injected into the prompt; template fallback prose per persona when the model is down.

## Cross-cutting rules (every phase)
Model selects components and parameters only — numbers come from engines via the resolver ·
zero raw hex outside globals.css · skew/gloss/bevel chrome only · one hero figure per screen ·
prefers-reduced-motion stops everything including blips · buttons ≥44px · no exclamation spam.
