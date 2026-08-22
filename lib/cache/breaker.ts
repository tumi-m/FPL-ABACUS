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

export async function breakerOpen(): Promise<boolean> {
  const until = await cacheStore().get(CB_OPEN_UNTIL);
  return until !== null && Number(until) > Date.now();
}

export async function breakerRemainingMs(): Promise<number> {
  const until = await cacheStore().get(CB_OPEN_UNTIL);
  if (!until) return 0;
  return Math.max(0, Number(until) - Date.now());
}

export async function recordUpstreamSuccess(): Promise<void> {
  await cacheStore().del(CB_FAILURES);
}

export async function recordUpstreamFailure(): Promise<void> {
  const store = cacheStore();
  const n = await store.incrWithTtl(CB_FAILURES, 300);
  if (n >= FAILURE_THRESHOLD) {
    await store.set(CB_OPEN_UNTIL, String(Date.now() + OPEN_MS), Math.ceil(OPEN_MS / 1000));
    await store.del(CB_FAILURES);
  }
}
