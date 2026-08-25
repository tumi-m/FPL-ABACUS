"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/ui/cn";

/**
 * The gameweek picker, shared by every screen that has a gameweek.
 *
 * It was the Field's, built there when the arrow stepper came out. Home needs
 * the same control and the same behaviour — one list of every week played,
 * the platform's own wheel on a phone, and picking the current week clearing
 * `?gw=` rather than pinning a historical view of the present — so it lives
 * here and both call it. Two pickers that drift apart is how a back button
 * starts lying.
 */
export function GameweekPicker({
  /** The week being viewed. */
  gw,
  /** The live week — the top of the list, and the one that clears the param. */
  latest,
  /** Route to push, without the gameweek. */
  basePath,
  /** Query the page needs kept as it changes week (mode, filters). */
  keep,
  className,
}: {
  gw: number;
  latest: number;
  basePath: string;
  keep?: Record<string, string | undefined>;
  className?: string;
}) {
  const router = useRouter();

  const go = (next: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(keep ?? {})) if (v) params.set(k, v);
    // The current week is the default view, so it carries no gw of its own.
    if (next !== latest) params.set("gw", String(next));
    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  };

  return (
    <label className={cn("flex items-center gap-2", className)}>
      <span className="sr-only">Gameweek</span>
      <select
        value={gw}
        onChange={(e) => go(Number(e.target.value))}
        /* colour is inherited: the lower third is its own surface, and a token
           picked for page text washes out against it */
        className="skewed h-9 rounded-md card-ring bg-transparent pl-3 pr-1 fig-num text-lg leading-none transition-colors dur-instant hover:bg-surface-3/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
      >
        {Array.from({ length: latest }, (_, i) => latest - i).map((n) => (
          <option key={n} value={n}>
            GW{n}
            {n === latest ? " · current" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
