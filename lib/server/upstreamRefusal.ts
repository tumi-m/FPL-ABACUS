import { BreakerOpenError } from "@/lib/cache/breaker";
import { FplHttpError, FplSchemaError } from "@/lib/fpl/client";

/**
 * Did FPL refuse to serve us, or did we break?
 *
 * The scheduled jobs only ever read season-wide paths — `/bootstrap-static/`,
 * `/fixtures/`, `/event/N/live/`. None of them takes a parameter a caller
 * could get wrong, so a 4xx on one of them is not us asking something silly:
 * it is FPL declining to answer. 403 is the one that actually happens, and it
 * is what took the scheduler red at 00:37 while the runs either side passed.
 *
 * Deliberately NOT the circuit breaker's `isUpstreamFault`, which answers a
 * different question and answers it the other way round. The breaker asks
 * "should I back off?", so it excludes 4xx (a mistyped entry id must not take
 * the app off upstream for everyone) and treats anything unrecognised as
 * upstream, because backing off wrongly is cheap. This asks "is this someone
 * else's outage?", where being wrong is expensive in both directions: call a
 * real bug an outage and it goes unreported for as long as it lasts.
 *
 * So this one defaults the other way. Only causes that are positively
 * identifiable as FPL's are named; a TypeError out of our own code is not an
 * outage and stays red.
 */
export function fplRefusal(err: unknown): string | null {
  // The breaker is open precisely because upstream has been failing; the
  // request never left the building, and that is still not our fault.
  if (err instanceof BreakerOpenError) return "FPL upstream breaker open";
  // A payload that no longer matches the schema is drift worth a person's
  // attention — ours to fix or theirs to explain, but never "wait it out".
  if (err instanceof FplSchemaError) return null;
  if (err instanceof FplHttpError) return err.message;
  // A network fault reaching FPL: DNS, connection reset, the 120s timeout.
  // `fetch` reports all of these as a TypeError whose cause carries the code,
  // so match on the shape rather than assuming every TypeError is upstream.
  if (err instanceof TypeError && /fetch failed|network|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(String(err.message) + String((err as { cause?: unknown }).cause ?? ""))) {
    return `FPL unreachable: ${err.message}`;
  }
  if (err instanceof Error && err.name === "TimeoutError") return `FPL timed out: ${err.message}`;
  return null;
}

/**
 * The body a scheduled job returns when it could not finish.
 *
 * One shape for all six, because the workflow reading them has to tell an
 * outage from a fault by the body alone — and until now it could not: five
 * routes named their cause through `explainDbError` and one answered the bare
 * string "warm-failed", so which endpoint explained an FPL outage depended on
 * which happened to have better wording.
 *
 * `upstream: "fpl"` is the flag the scheduler keys on. Without it the caller
 * would have to pattern-match prose, and the day somebody rewords an error
 * message the scheduler would quietly start alerting on outages again.
 */
export function cronFailure(err: unknown, fallback: string) {
  const refusal = fplRefusal(err);
  return refusal
    ? { ok: false as const, upstream: "fpl" as const, error: refusal }
    : { ok: false as const, error: fallback };
}
