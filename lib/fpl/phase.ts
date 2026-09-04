import type { GwPhase } from "@/lib/fpl/schemas";

/**
 * The phase every phase-aware TTL reads.
 *
 * The TTL table (lib/cache/ttl.ts) has always had an off-week column —
 * `eventStatus` 600s, `history` 3600s — but no caller ever passed a phase
 * provider, so every key used the live bucket forever and the app re-polled
 * FPL at live rates on a Tuesday. Wiring each call site by hand would recurse
 * (the provider would have to read the same caches it is choosing TTLs for).
 *
 * The honest cheap source is the phase `loadGwContext` already computes on
 * every render: it is noted here, and every cached endpoint falls back to it.
 * Before the first render of a warm instance the phase is unknown and reads
 * as "live" — exactly today's behaviour, so this can only improve freshness
 * economics, never worsen them. The warm cron runs loadGwContext too, so a
 * cron-primed instance always knows.
 */

let noted: { phase: GwPhase; at: number } | null = null;

/** How long a noted phase stays authoritative before we prefer "live". */
const FRESH_MS = 120_000;

/** Record the phase a real page render computed. Cheap; call on every load. */
export function notePhase(phase: GwPhase): void {
  noted = { phase, at: Date.now() };
}

/** The provider endpoints fall back to. Sync, never throws, never fetches. */
export function currentPhase(): GwPhase {
  if (noted && Date.now() - noted.at < FRESH_MS) return noted.phase;
  return "live";
}