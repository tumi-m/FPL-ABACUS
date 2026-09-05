/**
 * Watchlist sorting (v10 D3) — pure comparators over priced rows.
 *
 * The rows arrive in starred order; the sort control reorders them
 * client-side with no refetch. Deadline EO sorts by the predicted figure —
 * uncovered rows carry current ownership as the prediction (the engine's
 * honest fallback), so the order stays meaningful where snapshots are thin.
 */
export type WatchSort = "starred" | "eo" | "price";

export interface SortableWatchRow {
  id: number;
  price: number;
  eo_predicted: number;
}

export function sortWatchRows<T extends SortableWatchRow>(rows: T[], sort: WatchSort): T[] {
  if (sort === "eo") {
    return [...rows].sort((a, b) => b.eo_predicted - a.eo_predicted || a.id - b.id);
  }
  if (sort === "price") {
    return [...rows].sort((a, b) => b.price - a.price || a.id - b.id);
  }
  return rows;
}
