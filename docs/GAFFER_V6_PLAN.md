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

### V6-A — persona registry ⬜ (next)
- [ ] `lib/ai/personas.ts`: id, name, role, region, accent tokens, system-prompt fragment per
      gaffer; `personaPrompt(persona, context)` composes voice + constraints + resolved facts.
- [ ] Tests pin: every persona prompt carries the no-numbers line, the 40-word cap line, and
      its distinct analytical lens.

### V6-B — arcade console in the AskBar sheet ⬜
- [ ] Character-select strip: four skewed tiles, volt ring on the active gaffer, choice
      persisted (localStorage `gaffer_gaffer`).
- [ ] Speech bubble: pixel-border chrome (chrome only — stat chips stay flat), persona prose
      streams token-by-token from the existing NDJSON pipeline with punctuation pauses.
- [ ] Stat chips render resolver figures beside the bubble — the only numbers on screen.
- [ ] Breathing idle / talking bounce states on cropped mockup stills; static under
      reduced-motion.
- [ ] WebAudio blips while streaming, pause at punctuation, persisted mute toggle.

### V6-C — context passing ⬜
- [ ] `/api/ask` accepts the persona id; resolver context summary (GW, team structure, rank)
      injected into the prompt; template fallback prose per persona when the model is down.

## Cross-cutting rules (every phase)
Model selects components and parameters only — numbers come from engines via the resolver ·
zero raw hex outside globals.css · skew/gloss/bevel chrome only · one hero figure per screen ·
prefers-reduced-motion stops everything including blips · buttons ≥44px · no exclamation spam.
