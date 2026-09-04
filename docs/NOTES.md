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
| Replay exact bonus/autosubs/GW points | **PENDING** — runs after GW1 `data_checked` flips (~Sun 09:00 UK). `pnpm record` now auto-drops the `replay-ready` marker when the recorded GW is final; suite: `pnpm replay` |
| BPS constants verify | partial — Friday fixture BPS recorded; final bonus lands overnight |
| Single-flight 100→1 fetch | passing |

## Postgres wiring (phase C, landed)

- Drizzle client over `postgres.js` (`lib/db/index.ts`) — Neon TCP and Supabase pooler safe (`prepare: false`). Migration `drizzle/0000_*.sql` validated against a real pg16: snapshot upsert idempotency, composite PKs, quoted reserved columns.
- **The 0006 gap is intentional — do not "repair" it.** `drizzle/meta/_journal.json`
  jumps 0005→0007 and only an orphan `0006_snapshot.json` remains, because the twin
  `match_id` change was squashed into `0007_purple_justin_hammer.sql` (ADD COLUMN +
  backfill + composite PK in one file). Verified 2026-09-03 against scratch pg16:
  `db:migrate` succeeds fresh, re-run is a no-op exit 0, `drizzle-kit check` clean,
  `generate` reports no drift, all 10 tables land with the composite
  `(snapshot_id, entry, match_id)` PK. Reconstructing a 0006 SQL file would BREAK
  migrate (0007 line 1 re-adds the column).
- Cohort builder (`lib/server/cohortBuilder.ts`): log-spaced league-314 sweep → reservoir sample (target 2000) → bounded picks fan-out (6 concurrent) → `cohort_snapshot` upsert + ownership replace. Lock/fresh-marker fast paths keep the */10 cron cheap.
- Real EO path: `getCohortEO(gw)` feeds `composeMatchdayModel`; `leverage.eoSource` becomes `"cohort"` and LeverageBoard shows n + binomial MOE. Without DB the estimated prior remains, labelled.
- Price cron persists hourly snapshots + changes; finalise archives fixtures/live/status into `raw_archive` + a `score_distribution` sample row.

## Payload budget

`/api/gaffer/live` measured **10.3 KB** (budget ≤ 60 KB); warm p95 locally ~90 ms (budget ≤ 250 ms).

## v10 Task 0 — MuseSpark 1.3 probe (2026-09-04, harness: opencode)

Probed from inside the build sandbox. Direct site fetches are blocked here,
so provider-doc numbers are NOT claimed — only harness-observed behaviour.
Design branches on observed behaviour, with safe fallbacks where unproven.

- **Context window — UNVERIFIED number, no degradation observed.** Provider
  docs were not reachable from the sandbox, so no token count is recorded
  here. Observed: the harness holds the full v10 brief + repo exploration
  (registry, router, ask route, personas, quant engines) in one session
  without degradation. Decision: B-work keeps prompts small anyway
  (`q.slice(0, 200–300)`, facts capped at 1600 chars in
  `factsToPromptContext`) so the design does not depend on a large window.
- **Structured output — YES (JSON), grammar-constrained mode NOT assumed.**
  The harness produces well-formed JSON tool calls and `parseJson`-tolerant
  payloads reliably. `lib/ai/client.ts` already requests `format: "json"`
  on the Ollama gateway and `parseJson` extracts prose-wrapped/fenced JSON.
  Decision: `modelSelect` keeps parsing prose with `parseJson`; do not
  require a grammar-constrained mode. B4 asserts routing, never prose.
- **Tool / function calling — NATIVE in this harness, prompt-and-parse on
  the gateway.** This session itself uses native tool calls (one call per
  message, parallel batches). The production path (`app/api/ask/route.ts`
  → Ollama gateway) today uses the prompt-and-parse `{"tool","params"}`
  contract via `modelSelect`. Decision: B1 keeps the JSON-reply contract as
  the portable path and MAY add a native-tools branch when served over an
  endpoint that advertises it — B1 as written still works without it. The
  "B3 gets cheaper" shortcut in the brief applies to B1 (the tool loop),
  not B3 (personas); B3's cost is unchanged either way.
- **Streaming shape — Ollama-native NDJSON confirmed in code, SSE second
  parser still needed.** `lib/ai/client.ts:chat()` speaks
  `POST /api/chat` → `{ message:{content} }` (non-streaming), and
  `app/api/ask/route.ts` streams to the browser as NDJSON
  (`application/x-ndjson`, one JSON object per line). No `chatStream`
  exists yet despite the brief naming one. An OpenAI-compatible endpoint
  emits `data: {...}` SSE frames instead. Decision: when streaming from the
  gateway is introduced, add a second SSE parser beside the NDJSON one —
  do not rewrite `chat()`; detect the `data:` prefix per chunk.
