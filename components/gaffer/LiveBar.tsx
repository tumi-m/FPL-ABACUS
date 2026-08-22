import type { LiveBarData } from "@/lib/ui/types";

export function LiveBar({ data }: { data: LiveBarData }) {
  const isLive = data.phase === "live" || data.phase === "provisional";
  if (!isLive) return null;
  return (
    <div className="sticky top-0 z-50 flex h-10 items-center gap-3 border-b border-hairline bg-surface-1 px-4 md:px-6 text-xs">
      <span className="relative flex h-2 w-2">
        <span aria-hidden className="absolute inline-flex h-full w-full rounded-full bg-brand opacity-60 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
      </span>
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
