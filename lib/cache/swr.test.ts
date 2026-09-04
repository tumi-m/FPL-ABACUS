import { describe, expect, it, vi, beforeEach } from "vitest";
import { cached } from "@/lib/cache/swr";
import { MemoryStore, setCacheStore, type CacheStore } from "@/lib/cache/store";

function freshStore(): CacheStore {
  return new MemoryStore();
}

describe("single-flight cache", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setCacheStore(freshStore());
  });

  it("100 parallel cold calls produce exactly 1 upstream fetch", async () => {
    const spy = vi.fn(async () => ({ n: Math.random() }));
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      return spy();
    };

    const results = await Promise.all(Array.from({ length: 100 }, () => cached("k1", 60, fetcher)));
    expect(fetchCount).toBe(1);
    const first = results[0]!.n;
    for (const r of results) expect(r.n).toBe(first);
  });

  it("serves fresh without refetching", async () => {
    let n = 0;
    const fetcher = async () => ++n;
    await cached("k2", 60, fetcher);
    await cached("k2", 60, fetcher);
    await cached("k2", 60, fetcher);
    expect(n).toBe(1);
  });

  it("serves stale when upstream fails during refresh", async () => {
    let fail = false;
    let value = 10;
    const fetcher = async () => {
      if (fail) throw new Error("upstream down");
      return ++value;
    };
    await cached("k3", -1, fetcher); // negative ttl → immediately stale
    fail = true;
    const result = await cached("k3", -1, fetcher);
    expect(result).toBe(11);
  });

  it("a store read failure is a cold miss, not a 500", async () => {
    let n = 0;
    const fetcher = async () => ++n;
    const broken = new MemoryStore();
    broken.get = async () => {
      throw new Error("redis down");
    };
    setCacheStore(broken);
    // The fetch still happens and the caller still gets the value.
    await expect(cached("k4", 60, fetcher)).resolves.toBe(1);
    expect(n).toBe(1);
  });

  it("a store write failure does not lose the fetched value", async () => {
    let n = 0;
    const fetcher = async () => ++n;
    const broken = new MemoryStore();
    broken.set = async () => {
      throw new Error("redis full");
    };
    setCacheStore(broken);
    await expect(cached("k5", 60, fetcher)).resolves.toBe(1);
    expect(n).toBe(1);
  });

  it("a store lock failure behaves as the sole caller", async () => {
    let n = 0;
    const fetcher = async () => ++n;
    const broken = new MemoryStore();
    broken.tryLock = async () => {
      throw new Error("redis down");
    };
    broken.unlock = async () => {
      throw new Error("redis down");
    };
    setCacheStore(broken);
    await expect(cached("k6", 60, fetcher)).resolves.toBe(1);
    expect(n).toBe(1);
  });

  it("cold-miss pollers pick up the winner's value without refetching", async () => {
    let n = 0;
    const slow = async () => {
      await new Promise((r) => setTimeout(r, 200));
      return ++n;
    };
    setCacheStore(freshStore());
    // First caller takes the lock and fetches slowly; the second caller must
    // poll, find the written value and return it — one fetch, two callers.
    const first = cached("k7", 60, slow);
    await new Promise((r) => setTimeout(r, 30));
    const second = await cached("k7", 60, async () => 99);
    await first;
    expect(n).toBe(1);
    expect(second).toBe(1);
  });
});
