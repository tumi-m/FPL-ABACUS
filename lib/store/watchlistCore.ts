/**
 * The pure half of the watchlist: the storage key, the cap, and the two rules
 * that decide what a stored list means. No "use client" and no DOM, so the
 * API route can import the cap and get a number rather than a client
 * reference — which is what silently truncated the response to nothing.
 */

export const KEY = "gaffer_watchlist";
/** Enough for a shortlist, small enough that the deadline section stays a list. */
export const WATCH_LIMIT = 30;
/** Same-tab listeners; `storage` only fires in the *other* tabs. */
export const EVENT = "gaffer:watchlist";

/**
 * Parse whatever is in storage into element ids. Anything that isn't a
 * positive integer is dropped rather than trusted: this value is editable by
 * hand and by any earlier version of the app.
 */
export function parseWatchlist(raw: string | null): number[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: number[] = [];
  for (const v of parsed) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
    if (out.length >= WATCH_LIMIT) break;
  }
  return out;
}

/**
 * Add or remove, newest first, capped. Pure so the ordering rule is testable:
 * a player you just starred belongs at the top of the shortlist, not at the
 * bottom of the order you happened to add them in.
 */
export function toggleIn(list: number[], id: number): number[] {
  if (!Number.isInteger(id) || id <= 0) return list;
  if (list.includes(id)) return list.filter((x) => x !== id);
  return [id, ...list].slice(0, WATCH_LIMIT);
}
