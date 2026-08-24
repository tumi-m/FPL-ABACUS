import Link from "next/link";
import type { LiveBarData } from "@/lib/ui/types";
import { LiveDot } from "@/components/gaffer/LiveDot";
import { cn } from "@/lib/ui/cn";

/**
 * The app-wide status pill (v4-D): no more top banner. Centred above the
 * thumb bar on mobile, docked bottom-right on desktop. Reports the match
 * state while live/provisional and the Week Machine moment the rest of the
 * week. Tapping it goes to Matchday.
 *
 * The thumb bar is now padded (pt-2 + 6px gaps), so the pill floats a full
 * 1.75rem above it on mobile.
 */
export function LiveBar({ data }: { data: LiveBarData }) {
  const isLive = data.phase === "live" || data.phase === "provisional";
  const moment = data.moment;
  if (!isLive && !moment) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-4 z-40 flex justify-center",
        "bottom-[calc(3.5rem+env(safe-area-inset-bottom)+1.75rem)]",
        "lg:inset-x-auto lg:right-6 lg:bottom-6 lg:justify-end",
      )}
    >
      <Link
        href="/live"
        aria-label="Gameweek status"
        className="pointer-events-auto skewed inline-flex h-11 items-center gap-2.5 rounded-md bg-raised card-ring px-4 text-xs text-ink-2 num-tabular transition-colors dur-instant hover:bg-surface-3"
      >
        {isLive ? (
          <>
            <LiveDot />
            <span className="font-semibold tracking-wide uppercase text-ink-1">Live</span>
            <span>GW{data.gameweek}</span>
            <span aria-hidden className="h-3.5 w-px bg-hairline-strong" />
            <span>
              {data.fixturesInPlay} in play
            </span>
            {data.latestMinute != null && (
              <span className="text-ink-mid">{Math.min(data.latestMinute, 90)}&prime;</span>
            )}
          </>
        ) : (
          moment && (
            <>
              <span
                aria-hidden
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  moment.key === "warroom" ? "bg-warning" : "bg-hairline-strong",
                )}
              />
              <span className="font-semibold tracking-wide uppercase text-ink-1">{moment.label}</span>
              <span>GW{data.gameweek}</span>
            </>
          )
        )}
      </Link>
    </div>
  );
}
