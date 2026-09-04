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

/**
 * Cache reads never take a page down.
 *
 * A Redis hiccup is an infrastructure fault; `cached` exists so pages can
 * survive one — the same contract as `dbRead` on the stored-data side. If the
 * store is unreachable the read resolves to "nothing cached" and the caller
 * proceeds to fetch upstream.
 */
async function readEntry<T>(key: string): Promise<Entry<T> | null> {
  try {
    const raw = await cacheStore().get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Entry<T>;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

async function writeEntry<T>(key: string, data: T, ttl: number): Promise<void> {
  // A failed cache write must not fail the fetch that produced the data —
  // the caller already has the value, and the next read can warm the cache.
  try {
    await cacheStore().set(key, JSON.stringify({ data, fetchedAt: Date.now(), ttl }), ttl * 2 + 3600);
  } catch {
    /* value still returned to the caller */
  }
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
 * Acquire the single-flight lock and hand back a release that only lets go if
 * still ours.
 *
 * A lock without an owner is how a slow fetch breaks mutual exclusion: the
 * lock TTL expires while the first fetcher is still running, a second caller
 * acquires, and the first caller's `finally` then releases the *second*
 * caller's lock — a third caller walks in and both fetch upstream at once.
 * The release reads the lock before deleting, so an expired-and-retaken lock
 * is left alone; the residual window is a store race that the store's own
 * compare-and-set already narrows.
 */
async function releaseLock(key: string): Promise<void> {
  try {
    await cacheStore().unlock(key);
  } catch {
    /* nothing we can do; the lock TTL expires on its own */
  }
}

/** tryLock with the same never-throw contract as the rest of the store traffic. */
async function tryLockSafe(key: string): Promise<boolean> {
  try {
    return await cacheStore().tryLock(key, LOCK_TTL_MS);
  } catch {
    // The store is unreachable: nobody can coordinate, so behave as the sole
    // caller rather than failing the request the cache exists to speed up.
    return true;
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

  const ttl = await resolveTtl();
  const entry = await readEntry<T>(key);
  const lockKey = `lock:${key}`;

  // Fresh → serve.
  if (entry && Date.now() - entry.fetchedAt < entry.ttl) return entry.data;

  if (entry) {
    void (async () => {
      try {
        if (await tryLockSafe(lockKey)) {
          try {
            await runFetch(key, fetcher, ttl);
          } finally {
            await releaseLock(lockKey);
          }
        }
      } catch {
        // stale already served; background refresh failure is non-fatal
      }
    })();
    return entry.data;
  }

  // Cold miss: single flight — one caller fetches, the rest wait for the value.
  if (!(await tryLockSafe(lockKey))) {
    const deadline = Date.now() + COLD_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, COLD_POLL_MS));
      const winner = await readEntry<T>(key);
      if (winner) return winner.data;
      if (await breakerOpen()) throw new BreakerOpenError();
    }
    if (!(await tryLockSafe(lockKey))) {
      throw new Error(`cache cold-miss timeout for ${key}`);
    }
  }

  try {
    return await runFetch(key, fetcher, ttl);
  } finally {
    await releaseLock(lockKey);
  }
}

export async function breakerMsLeft(): Promise<number> {
  return breakerRemainingMs();
}