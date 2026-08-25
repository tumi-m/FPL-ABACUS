import "server-only";

import { cache } from "react";
import { getEntry } from "@/lib/fpl/endpoints";
import { loadGwContext, liveBarData } from "@/lib/server/gw";
import { StatusChip } from "@/components/gaffer/LiveStatus";

/**
 * The shell's two upstream-backed fragments, split out of the layout so the
 * header, nav and page skeleton paint on the first flush instead of waiting
 * for the FPL API. Both render inside a Suspense boundary; a slow or dead
 * upstream now costs a missing pill, not a blank screen.
 */

const loadHeader = cache(async (teamId: number) => {
  const [entryRes, ctxRes] = await Promise.allSettled([getEntry(teamId), loadGwContext()]);
  const entry = entryRes.status === "fulfilled" ? entryRes.value : null;
  let live = null;
  if (ctxRes.status === "fulfilled") {
    try {
      live = liveBarData(ctxRes.value);
      live.gwPoints = entry?.summary_event_points ?? null;
      live.seasonTotal = entry?.summary_overall_points ?? null;
    } catch {
      live = null;
    }
  }
  return { entry, live };
});

export async function LiveBarSlot({ teamId }: { teamId: number }) {
  const { live } = await loadHeader(teamId);
  return live ? <StatusChip data={live} /> : null;
}

export async function TeamPill({ teamId }: { teamId: number }) {
  const { entry, live } = await loadHeader(teamId);
  return (
    <span className="hidden sm:inline-flex h-8 items-center gap-2 rounded-full card-ring pl-3 pr-3 text-xs text-ink-2">
      {entry?.name ?? `Team ${teamId}`}
      {live?.gwPoints != null && (
        <span className="inline-flex items-baseline gap-1.5 border-l border-line pl-2">
          <span className="fig-num text-sm text-volt" title={`GW${live.gameweek} live score`}>
            {live.gwPoints}
          </span>
          {live.seasonTotal != null && (
            <span className="fig-num text-xs text-ink-mid num-tabular" title="Season total">
              {live.seasonTotal.toLocaleString("en-GB")}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
