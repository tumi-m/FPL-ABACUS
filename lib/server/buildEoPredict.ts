import "server-only";

/**
 * Server composition for the deadline-EO predictor (v10 D3).
 *
 * Two entry points because the two surfaces arrive with different things
 * already loaded: the watchlist route holds snapshots for its price model
 * and only needs the news counts, while the Board holds neither and loads
 * both. Either way the engine sees the same parts — no surface recomputes
 * the prediction its own way.
 */
import { loadSnapshots } from "@/lib/server/priceStore";
import { recentItems } from "@/lib/news/store";
import { predictDeadlineEO, type EoPrediction } from "@/lib/engines/eoPredict";
import type { PriceSnapshot } from "@/lib/engines/price";
import type { BootstrapLite } from "@/lib/fpl/bootstrapLite";

/** Hours from now to the next deadline, floored at zero past it. */
export function hoursToDeadline(boot: BootstrapLite, now: number = Date.now()): number {
  const next = boot.events.find((e) => e.is_next);
  if (!next?.deadline_time) return 0;
  const deadline = new Date(next.deadline_time).getTime();
  if (!Number.isFinite(deadline)) return 0;
  return Math.max(0, (deadline - now) / 3_600_000);
}

/** News-tag counts per element over a short spike window. */
export async function newsTagsByElement(
  limit = 120,
  maxAgeDays = 3,
): Promise<Map<number, number>> {
  const items = await recentItems(limit, maxAgeDays).catch(() => []);
  const out = new Map<number, number>();
  for (const item of items) {
    for (const id of item.elementIds ?? []) {
      out.set(id, (out.get(id) ?? 0) + 1);
    }
  }
  return out;
}

export function predictFromParts(
  boot: BootstrapLite,
  elements: number[],
  snapshots: Map<number, PriceSnapshot[]>,
  tags: Map<number, number>,
  hoursLeft: number,
): Map<number, EoPrediction> {
  const out = new Map<number, EoPrediction>();
  for (const id of elements) {
    const el = boot.elements[id];
    out.set(
      id,
      predictDeadlineEO({
        element: id,
        ownedNow: el?.selected_by_percent ?? 0,
        snapshots: snapshots.get(id) ?? [],
        newsTags: tags.get(id) ?? 0,
        hoursToDeadline: hoursLeft,
        totalManagers: boot.totalPlayers ?? 0,
      }),
    );
  }
  return out;
}

/** Full composition for surfaces that hold no price parts yet. */
export async function predictDeadlineEOs(
  boot: BootstrapLite,
  elements: number[],
  now: number = Date.now(),
): Promise<Map<number, EoPrediction>> {
  const [snapshots, tags] = await Promise.all([
    loadSnapshots(elements).catch(() => new Map<number, PriceSnapshot[]>()),
    newsTagsByElement().catch(() => new Map<number, number>()),
  ]);
  return predictFromParts(boot, elements, snapshots, tags, hoursToDeadline(boot, now));
}
