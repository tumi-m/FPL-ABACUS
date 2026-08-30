import { cacheStore } from "@/lib/cache/store";
import { BreakerOpenError, breakerOpen, breakerRemainingMs, recordUpstreamFailure, recordUpstreamSuccess } from "@/lib/cache/breaker";
import { FplHttpError, FplSchemaError } from "@/lib/fpl/client";
import type { GwPhase } from "@/lib/fpl/schemas";
import { ttlFor, type TtlKind } from "@/lib/cache/ttl";

interface Entry<T> {
  data: T;
  fetchedAt: number;
  ttl: number;
}

export interface CachedOptions {
  /** Phase-dependent TTLs: pass the kind and a phase provider (may itself read cache). */
  phase?: () => GwPhase | Promise<GwPhase>;
}

const LOCK_TTL_MS = 15_000;
const COLD_WAIT_MS = 8_000;
const COLD_POLL_MS = 25;

async function readEntry<T>(key: string): Promise<Entry<T> | null> {
  const raw = await cacheStore().get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Entry<T>;
  } catch {
    return null;
  }
}

async function writeEntry<T>(key: string, data: T, ttl: number): Promise<void> {
  await cacheStore().set(key, JSON.stringify({ data, fetchedAt: Date.now(), ttl }), ttl * 2 + 3600);
}

/**
 * Is this error evidence that FPL is unwell, or evidence that we asked it
 * something silly?
 *
 * The breaker exists to stop hammering an upstream that is failing. A 404 on
 * /entry/<id>/event/2/picks/ is not that: it is a correct, healthy answer to a
 * question about one team — the id was mistyped, or that manager never picked
 * a side. Counting it opened a breaker that is global and, in production,
 * shared through Redis across every instance and every user. Five mistyped
 * compare ids inside five minutes took the whole app off upstream for a
 * minute, for everybody, and the compare box invited exactly that by telling
 * the user to press the button again.
 *
 * So a request-shaped 4xx is excluded. 429 stays in — that IS the upstream
 * telling us to back off — as do 5xx, timeouts, aborts and network faults,
 * which arrive as something other than FplHttpError and count by default.
 */
function isUpstreamFault(err: unknown): boolean {
  if (err instanceof FplHttpError) {
    if (err.status === 429) return true;
    return !(err.status >= 400 && err.status < 500);
  }
  // A schema mismatch is our bug or their drift, not congestion; retrying
  // cannot fix it and tripping the breaker punishes every other caller.
  if (err instanceof FplSchemaError) return false;
  return true;
}

async function runFetch<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
  if (await breakerOpen()) throw new BreakerOpenError();
  try {
    const data = await fetcher();
    await writeEntry(key, data, ttl);
    await recordUpstreamSuccess();
    return data;
  } catch (err) {
    if (isUpstreamFault(err)) await recordUpstreamFailure();
    throw err;
  }
}

/**
 * Stale-while-revalidate with single-flight.
 * Fresh → serve. Stale → serve immediately, refresh in background if lock free.
 * Cold miss → exactly one caller fetches; concurrent callers poll for the value.
 */
export async function cached<T>(
  key: string,
  ttlOrKind: number | TtlKind,
  fetcher: () => Promise<T>,
  opts: CachedOptions = {},
): Promise<T> {
  const resolveTtl = async (): Promise<number> => {
    if (typeof ttlOrKind === "number") return ttlOrKind;
    const phase = opts.phase ? await opts.phase() : "live";
    return ttlFor(ttlOrKind, phase);
  };

  const entry = await readEntry<T>(key);
  const ttl = await resolveTtl();

  if (entry && Date.now() - entry.fetchedAt < entry.ttl) return entry.data;

  const lockKey = `lock:${key}`;

  if (entry) {
    void (async () => {
      try {
        if (await cacheStore().tryLock(lockKey, LOCK_TTL_MS)) {
          try {
            await runFetch(key, fetcher, ttl);
          } finally {
            await cacheStore().unlock(lockKey);
          }
        }
      } catch {
        // stale already served; background refresh failure is non-fatal
      }
    })();
    return entry.data;
  }

  // Cold miss: single flight — one caller fetches, the rest wait for the value.
  if (!(await cacheStore().tryLock(lockKey, LOCK_TTL_MS))) {
    const deadline = Date.now() + COLD_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, COLD_POLL_MS));
      const winner = await readEntry<T>(key);
      if (winner) return winner.data;
      if (await breakerOpen()) throw new BreakerOpenError();
    }
    if (!(await cacheStore().tryLock(lockKey, LOCK_TTL_MS))) throw new Error(`cache cold-miss timeout for ${key}`);
  }

  try {
    return await runFetch(key, fetcher, ttl);
  } finally {
    await cacheStore().unlock(lockKey);
  }
}

export async function upstreamDown(): Promise<boolean> {
  return breakerOpen();
}

export async function breakerMsLeft(): Promise<number> {
  return breakerRemainingMs();
}
