import { FplHttpError, FplSchemaError } from "@/lib/fpl/client";
import { BreakerOpenError } from "@/lib/cache/breaker";

export type RivalFailure =
  | "picks-not-set"
  | "no-such-entry"
  | "no-gameweek"
  /** Our own breaker is open — FPL is being rested, and a retry now makes it worse. */
  | "upstream-busy"
  | "upstream";

/**
 * What a probe of the entry endpoint told us, after a 404 on picks.
 *
 * Three outcomes, not two. "The lookup failed" is its own answer and must not
 * be collapsed into "missing" — see readRivalFailure.
 */
export type EntryProbe = { kind: "exists" } | { kind: "missing" } | { kind: "failed"; err: unknown };

export interface RivalFailureRead {
  reason: RivalFailure;
  detail?: string;
}

/**
 * Turn the errors from a rival build into something a user can act on.
 *
 * The rule that matters: never claim the rival's id is wrong unless FPL has
 * actually said so. The first version probed the entry endpoint with
 * `.catch(() => null)` and read null as "no such team", so a timeout on that
 * second request — or the breaker having opened between the two — produced
 * "No FPL team with id 4143072". That is a confident, checkable, wrong
 * statement about something the user typed correctly, and it sends them off to
 * re-find an id that was fine. A failed probe now reports our failure instead.
 */
export function readRivalFailure(picksErr: unknown, probe?: EntryProbe): RivalFailureRead {
  if (picksErr instanceof BreakerOpenError) {
    return { reason: "upstream-busy", detail: "Paused after repeated upstream failures" };
  }

  const status = picksErr instanceof FplHttpError ? picksErr.status : null;
  if (status !== 404) return { reason: "upstream", detail: describeFailure(picksErr) };

  // A 404 on picks means one of two very different things, and only the entry
  // endpoint can tell them apart.
  if (!probe || probe.kind === "failed") {
    return { reason: "upstream", detail: describeFailure(probe?.err) };
  }
  return { reason: probe.kind === "missing" ? "no-such-entry" : "picks-not-set" };
}

/** A short, safe description — never a raw stack, never a URL carrying an id. */
export function describeFailure(err: unknown): string {
  if (err instanceof FplHttpError) return `FPL returned ${err.status}`;
  if (err instanceof FplSchemaError) return "FPL sent a shape we did not expect";
  if (err instanceof BreakerOpenError) return "Paused after repeated upstream failures";
  if (err instanceof Error && err.name === "TimeoutError") return "FPL timed out";
  if (err instanceof Error && err.message.includes("cold-miss timeout")) return "FPL timed out";
  return "The request to FPL failed";
}
