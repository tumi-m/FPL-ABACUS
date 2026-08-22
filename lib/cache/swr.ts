import { cacheStore } from "@/lib/cache/store";
import { BreakerOpenError, breakerOpen, breakerRemainingMs, recordUpstreamFailure, recordUpstreamSuccess } from "@/lib/cache/breaker";
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

async function runFetch<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
  if (await breakerOpen()) throw new BreakerOpenError();
  try {
    const data = await fetcher();
    await writeEntry(key, data, ttl);
    await recordUpstreamSuccess();
    return data;
  } catch (err) {
    await recordUpstreamFailure();
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
