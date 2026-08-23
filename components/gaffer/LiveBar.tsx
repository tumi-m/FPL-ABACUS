import type { LiveBarData } from "@/lib/ui/types";
import { LiveDot } from "@/components/gaffer/LiveDot";

/**
 * The app-wide status strip. During live/provisional it reports the match
 * state; the rest of the week it carries the Week Machine moment so every
 * screen knows what the week is for right now.
 */
export function LiveBar({ data }: { data: LiveBarData }) {
  const isLive = data.phase === "live" || data.phase === "provisional";

  if (!isLive) {
    const moment = data.moment;
    if (!moment) return null;
    const urgent = moment.key === "warroom";
    return (
      <div className="sticky top-0 z-50 flex h-10 items-center gap-3 border-b border-hairline bg-surface-1 px-4 md:px-6 text-xs">
        <span
          aria-hidden
          className={`inline-block h-2 w-2 rounded-full ${urgent ? "bg-warning" : "bg-hairline-strong"}`}
        />
        <span className="font-semibold tracking-wide uppercase text-ink-1">{moment.label}</span>
        <span className="text-ink-2 num-tabular">GW{data.gameweek}</span>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 flex h-10 items-center gap-3 border-b border-hairline bg-surface-1 px-4 md:px-6 text-xs">
      <LiveDot />
      <span className="font-semibold tracking-wide uppercase text-ink-1">Live</span>
      <span className="text-ink-2 num-tabular">GW{data.gameweek}</span>
      <span aria-hidden className="h-4 w-px bg-hairline-strong" />
      <span className="text-ink-2 num-tabular">
        {data.fixturesInPlay} fixture{data.fixturesInPlay === 1 ? "" : "s"} in play
      </span>
      {data.latestMinute != null && (
        <>
          <span aria-hidden className="h-4 w-px bg-hairline-strong" />
          <span className="text-ink-2 num-tabular">{Math.min(data.latestMinute, 90)}&prime;</span>
        </>
      )}
    </div>
  );
}
