# GAFFER v5 — "THE BROADCAST" plan & progress

> Resume file. Design north star: Dieter Rams / Jony Ive simplicity, Deutsch's *hard-to-vary*
> beauty — every element constrained by the whole, nothing decorative that doesn't inform.
> Audience: football analytics enthusiasts who want halftime-analysis clarity, not data professionals.
> Hobby tier is fine; distribution/marketing work is deferred until scale demands it.

## Locked decisions

- **Verification:** every change audited through independent lenses (data · design · a11y · state)
  before commit; bugs fixed at root cause, never worked around.
- **AI invariant unchanged:** the model selects components and parameters ONLY. Every number comes
  from our engines via the resolver. Grounded prose is template-generated from resolved data.
- **Buttons:** min touch target 44px; primary actions are real buttons, never bare text links;
  back actions top-left and generously sized; mobile content centred where it reads better.
- **No invented copy:** simple, informative labels. No "smart" AI-flavoured titles.
- **Charts/tables must give value at a glance:** one question per chart, direct labels, table views.

## Phases

### V5-A — bug fixes & interaction debt ✅ (this commit)
- [x] **Mobile More sheet unreadable** — root cause: bottom nav is `grid-cols-5` but renders six
      children (5 tabs + More), so More wraps into an invisible second row against arbitrary
      content. Fixed with a dynamic grid (`repeat(N+1, 1fr)`), explicit high-contrast link styles,
      44px+ targets, active-state rails.
- [x] **League stuck on page 1** — `/leagues/[id]` now takes `?page=N`, shows real position
      (`page N of M`, member count), and a centred **Load 50 more** button appends the next page
      server-side (cumulative render, no JS needed). Clamp past the end; hide when exhausted.

### V5-B — Points contribution, in team colour ✅ (this commit)
- [x] Waterfall bars coloured by **club identity tokens** (`--club-*`) instead of uniform series
      blue; captain keeps the volt armband mark; total stays volt.
- [x] Field hero link replaced by a proper skewed **"Points contribution"** button (44px target).

### V5-C — Field: Planner + broadcast pitch ✅ (this commit)
- [x] Fifth mode **Planner** beside Leverage — reuses BoardDesk (staging ledger + chip lane) so
      planning lives where the team lives; URL-state preserved (`/field?mode=planner`).
- [x] Pitch surface moved toward the broadcast look: deep tournament-green gradient kept inside
      Floodlight discipline (floodlight wash + mowing stripes + 40% markings retained).

### V5-D — grounded assistant use cases (Ollama / deepseek-v4-flash) ✅ (this commit)
Seven assistant intents, all router-first, all numbers from engines:
- [x] **Squad generator** — "build me a differential wildcard squad" → model sets strategy params
      only (budget, risk, premium count); resolver runs a deterministic greedy optimiser over
      bootstrap + projections and returns a legal 15.
- [x] **Transfer watch** — weakest XI links by ep_next vs price band → transfer-sim card.
- [x] **Chip timing** — v3-15 Snell envelope over remaining GWs → exercise-week recommendation.
- [x] **Review** — post-gameweek summary composed from matchdayModel facts (hero, biggest swing,
      regret) — template prose only.
- [x] Captain-compare, injury-list, news-search already shipped in Phase F (unchanged).

### V5-E — Regret meter, readable at a glance ✅ (this commit)
- [x] Two-arm bar replaced by a centred diverging meter with labelled ends, count-up figures,
      plain-language caption ("What your best/worst alternative was worth"), Est on estimates.

### V5-F — League & Board visual polish ✅ (this commit)
- [x] League detail: broadcast lower-third header (12px angled volt flag + gradient body),
      summary strip (Avg GW as the hero figure · spread · best GW over shown rows),
      movement rails — 5px skewed rail per row coloured surge/flare paired with ▲/▼ +
      signed delta and aria text (never colour alone), you-row highlight via surface tint +
      volt inset rail + YOU chip from the gaffer_team cookie, zebra-free hairline rhythm.
- [x] Board: hero strip in BoardDesk (FT wrapped in Est · bank £m · hits staged −points,
      flare when non-zero) so Field's Planner mode inherits it; selects h-10, Stage move
      h-11, Drop/Clear get 44px hit areas (pseudo-element expansion / real buttons);
      Fixture grid + Blanks & doubles section headers as upper-labels.

### V5-G — UX depth (next)
- [ ] Week Machine lite: phase-driven home emphasis + nav order (Autopsy/Workshop/War Room/
      Reveal/Match/Wait), always escapable.
- [ ] Moments: settle-fade when bonus confirms; passed-rival toast (once, dismissible).
- [ ] Copy deck consolidation into `lib/copy/*.ts`.

### Deferred until scale (explicitly NOT now)
Accounts/payments, alerts/push, manager_index name search + crawl, club-theme generator rollout,
Python research service/backtests, Twin Study 30k cohort extension, Manifold. Distribution and
marketing work begins when the product earns it; hobby tiers cover current load comfortably.

## Multi-agent verification
Adapted from GAFFER_MULTIAGENT.md for this environment: after each phase run independent lens
audits (data usage · Floodlight design · a11y · states) with fresh context, fix findings, then
re-audit until clean. Replay tests remain the floor for any engine change.

## Cross-cutting rules (every phase)
Zero raw hex outside globals.css · skew/gloss/bevel chrome only · one hero figure per screen ·
heat blue→green · `<Est>` on estimates · reduced-motion stops everything · charts hand-built SVG
with table toggles · buttons ≥44px, centred on mobile · no exclamation-mark copy.
