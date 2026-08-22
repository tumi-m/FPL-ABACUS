import { hasRedis, env } from "@/lib/env";

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Returns true if the lock was acquired. */
  tryLock(key: string, ttlMs: number): Promise<boolean>;
  unlock(key: string): Promise<void>;
  incrWithTtl(key: string, ttlSeconds: number): Promise<number>;
}

export class MemoryStore implements CacheStore {
  private data = new Map<string, { value: string; expiresAt: number }>();
  private locks = new Map<string, number>();

  async get(key: string) {
    const hit = this.data.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key: string, value: string, ttlSeconds: number) {
    this.data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string) {
    this.data.delete(key);
    this.locks.delete(key);
  }

  async tryLock(key: string, ttlMs: number) {
    const heldUntil = this.locks.get(key);
    if (heldUntil !== undefined && Date.now() < heldUntil) return false;
    this.locks.set(key, Date.now() + ttlMs);
    return true;
  }

  async unlock(key: string) {
    this.locks.delete(key);
  }

  async incrWithTtl(key: string, ttlSeconds: number) {
    const existing = await this.get(key);
    const n = (existing ? Number(existing) : 0) + 1;
    const cur = this.data.get(key);
    const expiresAt = cur && Date.now() < cur.expiresAt ? cur.expiresAt : Date.now() + ttlSeconds * 1000;
    this.data.set(key, { value: String(n), expiresAt });
    return n;
  }
}

class UpstashStore implements CacheStore {
  constructor(private url: string, private token: string) {}

  private cmd(...args: (string | number)[]): Promise<string | null> {
    return fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    })
      .then((r) => r.json() as Promise<{ result: string | null }>)
      .then((j) => j.result);
  }

  async get(key: string) {
    return this.cmd("GET", key);
  }

  async set(key: string, value: string, ttlSeconds: number) {
    await this.cmd("SET", key, value, "EX", String(ttlSeconds));
  }

  async del(key: string) {
    await this.cmd("DEL", key);
  }

  async tryLock(key: string, ttlMs: number) {
    const res = await this.cmd("SET", key, "1", "NX", "PX", String(ttlMs));
    return res === "OK";
  }

  async unlock(key: string) {
    await this.cmd("DEL", key);
  }

  async incrWithTtl(key: string, ttlSeconds: number) {
    const n = Number((await this.cmd("INCR", key)) ?? 0);
    if (n === 1) await this.cmd("EXPIRE", key, String(ttlSeconds));
    return n;
  }
}

let store: CacheStore | null = null;

export function cacheStore(): CacheStore {
  if (!store) {
    store =
      hasRedis && env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
        ? new UpstashStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN)
        : new MemoryStore();
  }
  return store;
}

/** Test seam */
export function setCacheStore(s: CacheStore | null) {
  store = s;
}
