import { cacheStore } from "@/lib/cache/store";

export class BreakerOpenError extends Error {
  constructor() {
    super("FPL upstream circuit breaker open — serving stale only");
    this.name = "BreakerOpenError";
  }
}

const CB_FAILURES = "cb:fpl:failures";
const CB_OPEN_UNTIL = "cb:fpl:open_until";
const FAILURE_THRESHOLD = 5;
const OPEN_MS = 60_000;

/**
 * The breaker reads the same store as the cache, so a store outage must read
 * as "breaker closed" — otherwise a Redis hiccup would stop every fetch and
 * the pages would lose their data source entirely. Fail-safe closed.
 */
async function breakerRead(key: string): Promise<string | null> {
  try {
    return await cacheStore().get(key);
  } catch {
    return null;
  }
}

export async function breakerOpen(): Promise<boolean> {
  const until = await breakerRead(CB_OPEN_UNTIL);
  return until !== null && Number(until) > Date.now();
}

export async function breakerRemainingMs(): Promise<number> {
  const until = await breakerRead(CB_OPEN_UNTIL);
  if (!until) return 0;
  return Math.max(0, Number(until) - Date.now());
}

export async function recordUpstreamSuccess(): Promise<void> {
  try {
    await cacheStore().del(CB_FAILURES);
  } catch {
    /* breaker bookkeeping is never worth failing a fetch over */
  }
}

export async function recordUpstreamFailure(): Promise<void> {
  const store = cacheStore();
  try {
    const n = await store.incrWithTtl(CB_FAILURES, 300);
    if (n >= FAILURE_THRESHOLD) {
      await store.set(CB_OPEN_UNTIL, String(Date.now() + OPEN_MS), Math.ceil(OPEN_MS / 1000));
      await store.del(CB_FAILURES);
    }
  } catch {
    /* same: bookkeeping failure is not a fetch failure */
  }
}
