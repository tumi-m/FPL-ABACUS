"use client";

/**
 * The watchlist — players you are thinking about, kept in the browser.
 *
 * It lives in `localStorage` rather than on the server on purpose. A watchlist
 * is a scratchpad for one deadline, it belongs to the person and not to the
 * team id (you can watch a player you don't own, for a team you haven't
 * entered yet), and putting it behind an account would mean asking for one
 * before the app has earned it. The trade is that it does not follow you to
 * another device, which is stated where it is offered.
 */

import { KEY, EVENT, parseWatchlist, toggleIn } from "./watchlistCore";

export { parseWatchlist, toggleIn, WATCH_LIMIT } from "./watchlistCore";

function read(): number[] {
  if (typeof window === "undefined") return [];
  try {
    return parseWatchlist(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

function write(list: number[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage unavailable (private window, quota) — the toggle still works for
    // this render, it just won't survive a reload.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/**
 * Cached so `useSyncExternalStore` gets a stable reference between changes —
 * reading storage on every render would hand React a new array each time and
 * loop forever.
 */
let snapshot: number[] | null = null;

export function getWatchlist(): number[] {
  if (snapshot === null) snapshot = read();
  return snapshot;
}

/** The server render has no storage; an empty list is the honest answer. */
const EMPTY: number[] = [];
export function getServerWatchlist(): number[] {
  return EMPTY;
}

export function toggleWatch(id: number): number[] {
  const next = toggleIn(getWatchlist(), id);
  snapshot = next;
  write(next);
  return next;
}

export function clearWatchlist(): void {
  snapshot = [];
  write([]);
}

export function subscribeWatchlist(onChange: () => void): () => void {
  const invalidate = () => {
    snapshot = read();
    onChange();
  };
  window.addEventListener(EVENT, invalidate);
  // another tab starred somebody — `storage` carries the key that changed
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) invalidate();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, invalidate);
    window.removeEventListener("storage", onStorage);
  };
}
