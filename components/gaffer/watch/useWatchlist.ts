"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getServerWatchlist,
  getWatchlist,
  subscribeWatchlist,
  toggleWatch,
} from "@/lib/store/watchlist";

/**
 * The watchlist as React sees it.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: a star can be
 * toggled from a row, from the profile page and from another tab, and every
 * star on screen has to agree immediately. The store keeps one cached array so
 * the snapshot is referentially stable between changes.
 *
 * The server snapshot is empty, which means the first paint shows no stars and
 * hydration fills them in. That is the correct trade for a value that only
 * exists in the browser — the alternative is rendering a state the server
 * cannot know and flashing it away.
 */
export function useWatchlist(): {
  ids: number[];
  has: (id: number) => boolean;
  toggle: (id: number) => void;
} {
  const ids = useSyncExternalStore(subscribeWatchlist, getWatchlist, getServerWatchlist);
  const has = useCallback((id: number) => ids.includes(id), [ids]);
  const toggle = useCallback((id: number) => {
    toggleWatch(id);
  }, []);
  return { ids, has, toggle };
}
