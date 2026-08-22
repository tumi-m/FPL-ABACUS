# GAFFER — build notes & assumptions

## Live-rank probe (docs/04 §6.2) — INCONCLUSIVE, leaning positive

- **Poll 1** 2026-08-22T02:05:53Z · entry 1851681 · `summary_event_points` 56 · `summary_event_rank` 1 · `summary_overall_rank` 1
- **Poll 2** 2026-08-22T02:30:02Z · identical (no football being played between polls — Friday fixture finished_provisional, Saturday kick-offs start 11:30 UTC)

**What we can already conclude:** `summary_event_rank`/`summary_overall_rank` are **populated and non-null while the gameweek is still unfinished** — historically these stayed null until processing. The official API therefore exposes at least checkpoint-level live rank in 2026/27.

**Still unproven:** whether it updates *continuously* during play. Re-run the two-poll probe ≥5 min apart during Saturday's 11:30 UTC window. Until then:

- `/api/gaffer/live` returns BOTH `hero.officialLiveRank` (ground truth when present) and `hero.estimatedLiveRank` (curve model), so the display can prefer official instantly if the probe confirms.
- Rank deltas already use official rank when available (`rankDeltaSinceLastPoll`).

## Schema drift caught by record-fixtures (2026-08-22)

1. `teams[].strength` is now **nullable** (pre-season ratings not yet published).
2. Classic standings rows no longer include `id`.
Both fixed in `lib/fpl/schemas.ts`. This is exactly why fixtures are recorded against the live endpoint rather than trusted from docs.

## Decisions

- `noUncheckedIndexedAccess` disabled (beyond `strict`) — numeric-heavy engines; documented here per contract.
- Cache store has an in-process `MemoryStore` fallback used until Upstash env vars are provided; single-flight semantics identical within one instance.
- Cron jobs degrade to explicit no-ops without `DATABASE_URL` (`skipped:"no-database-configured"`) instead of failing.
- Provisional bonus skips only fixtures whose day has `bonus_added && finished`; provisional-phase fixtures still get computed projections.

## Verification status vs Phase 2 gates

| Gate | Status |
|---|---|
| Bonus tie rules (5 shapes) | unit-tested |
| Replay exact bonus/autosubs/GW points | **PENDING** — runs after GW1 `data_checked` flips (~Sun 09:00 UK). Fixtures recorded; suite: `pnpm replay` |
| BPS constants verify | partial — Friday fixture BPS recorded; final bonus lands overnight |
| Single-flight 100→1 fetch | passing |

## Payload budget

`/api/gaffer/live` measured **10.3 KB** (budget ≤ 60 KB); warm p95 locally ~90 ms (budget ≤ 250 ms).
