import { FplHttpError, FplSchemaError } from "@/lib/fpl/client";
import { BreakerOpenError } from "@/lib/cache/breaker";

/**
 * Why an upstream read failed, and what the reader should do about it.
 *
 * Three screens had each invented their own sentence for this, and all three
 * guessed. "FPL may be busy. Try again shortly" was printed for a mistyped
 * league id, for a league that does not exist, and for our own circuit breaker
 * being open — none of which is FPL being busy, and only one of which gets
 * better by trying again shortly. A reader who follows that advice on a
 * mistyped id retries forever.
 *
 * So the cause is read from the error rather than assumed, and the advice
 * follows the cause. Where nothing can be told apart, it says that plainly
 * instead of inventing a likely-sounding reason.
 */
export type UpstreamFailureKind =
  | "not-found"
  | "forbidden"
  | "rate-limited"
  | "server"
  | "paused"
  | "timeout"
  | "shape"
  | "unknown";

export interface UpstreamFailureRead {
  kind: UpstreamFailureKind;
  /** One line naming what happened. */
  title: string;
  /** What to do about it. Empty when there is genuinely nothing to suggest. */
  body: string;
  /** Whether pressing the same button again could plausibly work. */
  retryable: boolean;
}

export function readUpstreamFailure(err: unknown, subject = "that"): UpstreamFailureRead {
  if (err instanceof BreakerOpenError) {
    return {
      kind: "paused",
      title: "Paused on FPL requests",
      // Ours, not theirs, and it runs on a clock — so "try again" is the one
      // piece of advice that cannot help.
      body: "We stopped asking FPL after a run of failures. It clears itself in under a minute; reloading now won't hurry it.",
      retryable: false,
    };
  }

  if (err instanceof FplSchemaError) {
    return {
      kind: "shape",
      title: "FPL sent something we couldn't read",
      body: "Their data changed shape. Retrying won't fix it — this one is on us.",
      retryable: false,
    };
  }

  if (err instanceof Error && (err.name === "TimeoutError" || err.message.includes("cold-miss timeout"))) {
    return {
      kind: "timeout",
      title: "FPL took too long to answer",
      body: "Usually a busy minute during matches. Reloading is worth a try.",
      retryable: true,
    };
  }

  if (err instanceof FplHttpError) {
    if (err.status === 404) {
      return {
        kind: "not-found",
        title: `FPL has no record of ${subject}`,
        body: "Check the number — it's the one in the URL of the page on the official site.",
        retryable: false,
      };
    }
    if (err.status === 403 || err.status === 401) {
      return {
        kind: "forbidden",
        title: `FPL wouldn't show us ${subject}`,
        body: "It may be private, or FPL is refusing requests from this server.",
        retryable: false,
      };
    }
    if (err.status === 429) {
      return {
        kind: "rate-limited",
        title: "FPL is rate-limiting us",
        body: "Too many requests too quickly. Give it a minute.",
        retryable: true,
      };
    }
    return {
      kind: "server",
      title: `FPL returned ${err.status}`,
      body: "Their end, not yours. Reloading in a moment usually works.",
      retryable: true,
    };
  }

  return {
    kind: "unknown",
    title: "The request to FPL failed",
    body: "No more detail than that, unfortunately. Reloading is worth a try.",
    retryable: true,
  };
}

/** A short, safe one-liner — never a raw stack, never a URL carrying an id. */
export function describeFailure(err: unknown): string {
  if (err instanceof FplHttpError) return `FPL returned ${err.status}`;
  if (err instanceof FplSchemaError) return "FPL sent a shape we did not expect";
  if (err instanceof BreakerOpenError) return "Paused after repeated upstream failures";
  if (err instanceof Error && err.name === "TimeoutError") return "FPL timed out";
  if (err instanceof Error && err.message.includes("cold-miss timeout")) return "FPL timed out";
  return "The request to FPL failed";
}
