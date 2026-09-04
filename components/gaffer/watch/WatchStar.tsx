"use client";

import { Star } from "@/components/primitives/icons";
import { useWatchlist } from "./useWatchlist";

/**
 * Star a player. The same control on a row, on a profile and in the market —
 * every instance reads one store, so starring somebody in the explorer fills
 * the star on the profile behind it without a reload.
 *
 * It is a toggle, so it reports `aria-pressed` rather than changing its label:
 * a screen reader announces "Saka, watchlist, pressed", which says both who and
 * what state, where "Remove Saka from watchlist" would only ever describe the
 * next click.
 */
export function WatchStar({
  id,
  name,
  className = "",
}: {
  id: number;
  name: string;
  className?: string;
}) {
  const { has, toggle } = useWatchlist();
  const on = has(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${name} — watchlist`}
      title={on ? `Watching ${name}` : `Watch ${name}`}
      onClick={(e) => {
        // rows are usually links; starring is not navigating
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-volt ${
        on ? "text-amber" : "text-ink-lo hover:text-ink-hi"
      } ${className}`}
    >
      <Star filled={on} width={18} height={18} />
    </button>
  );
}
