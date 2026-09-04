import "server-only";

/**
 * Bounded-concurrency map over upstream reads.
 *
 * Firing 50–1000 `getHistory` calls in one `Promise.all` hammers FPL harder
 * than a browser opens connections, and a rate-limit reply costs the whole
 * view. `mapPool` keeps `limit` in flight — the same politeness contract the
 * rank curve has used since V9-K (CONCURRENCY = 4) — and preserves input
 * order, so callers can zip results back onto their rows.
 *
 * Rejections degrade to `fallback` per item rather than failing the batch:
 * a missing history row is an honest empty cell, not a 500.
 */
export async function mapPool<TIn, TOut>(
  items: readonly TIn[],
  limit: number,
  run: (item: TIn, index: number) => Promise<TOut>,
  fallback: (item: TIn, index: number) => TOut,
): Promise<TOut[]> {
  const out = new Array<TOut>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      const item = items[i]!;
      try {
        out[i] = await run(item, i);
      } catch {
        out[i] = fallback(item, i);
      }
    }
  });
  await Promise.all(workers);
  return out;
}