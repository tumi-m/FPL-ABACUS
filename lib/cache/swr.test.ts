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
});
