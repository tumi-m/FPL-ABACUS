"use client";

import * as React from "react";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { cn } from "@/lib/ui/cn";
import type { PointsSource } from "@/lib/engines/playerSeason";

/**
 * Points by gameweek, as bars.
 *
 * This was a sparkline, which needs a shape to be worth drawing. Two
 * gameweeks in, it was a diagonal line between two dots and a stray point — a
 * chart that looked broken rather than sparse. Bars read correctly at n=1,
 * carry their own labels, and mark the blanks a line has to invent a path
 * across.
 */
export function PointsByGameweek({
  series,
}: {
  series: { gw: number; points: number; minutes: number }[];
}) {
  if (series.length === 0) return null;
  const max = Math.max(4, ...series.map((s) => Math.abs(s.points)));
  const best = Math.max(...series.map((s) => s.points));
  const played = series.filter((s) => s.minutes > 0).length;

  return (
    <ChartFrame
      eyebrow="Season"
      title="Points by gameweek"
      ariaLabel={`Points in each of ${series.length} gameweeks, best ${best}`}
      table={{
        headers: ["GW", "Min", "Pts"],
        rows: series.map((s) => [`GW${s.gw}`, s.minutes, s.points]),
      }}
      caption={`Best ${best}. Played ${played} of ${series.length}. A hollow bar is a match he did not appear in.`}
    >
      <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ height: 132 }}>
        {series.map((s) => {
          const h = Math.max(2, (Math.abs(s.points) / max) * 96);
          const blank = s.minutes <= 0;
          const neg = s.points < 0;
          return (
            <div key={s.gw} className="flex min-w-[26px] flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] leading-none text-ink-lo num-tabular">{s.points}</span>
              <span
                title={`GW${s.gw}: ${s.points} points from ${s.minutes} minutes`}
                className="w-full rounded-sm"
                style={{
                  height: h,
                  background: blank
                    ? "transparent"
                    : neg
                      ? "var(--flare)"
                      : s.points === best
                        ? "var(--volt)"
                        : "color-mix(in oklab, var(--volt) 42%, transparent)",
                  boxShadow: blank ? "inset 0 0 0 1px var(--line)" : undefined,
                }}
              />
              <span className="text-[10px] leading-none text-ink-lo num-tabular">{s.gw}</span>
            </div>
          );
        })}
      </div>
    </ChartFrame>
  );
}

const SOURCE_TONE: Record<string, string> = {
  appearance: "var(--ink-lo)",
  goals: "var(--volt)",
  assists: "var(--surge)",
  clean: "var(--ultra)",
  defcon: "var(--ultra)",
  bonus: "var(--volt)",
  saves: "var(--surge)",
  conceded: "var(--flare)",
  cards: "var(--flare)",
  misc: "var(--flare)",
  other: "var(--ink-lo)",
};

/**
 * Where the season's points came from.
 *
 * The header says 18 and the page never said what the 18 was made of, which
 * is the difference between a defender worth keeping and one riding two clean
 * sheets that will not repeat. Positive and negative sit either side of a
 * baseline, because a card is not a smaller kind of goal.
 */
export function PointsSources({ sources, total }: { sources: PointsSource[]; total: number }) {
  if (sources.length === 0) return null;
  const span = Math.max(1, ...sources.map((s) => Math.abs(s.points)));

  return (
    <ChartFrame
      eyebrow="Season"
      title="Where the points came from"
      ariaLabel={`Breakdown of ${total} season points by source`}
      table={{
        headers: ["Source", "Pts", "Share"],
        rows: sources.map((s) => [
          s.label,
          s.points,
          total > 0 ? `${Math.round((s.points / total) * 100)}%` : "—",
        ]),
      }}
      caption="Derived from each match's own stat line against FPL's live scoring values. Anything the named rows cannot account for shows as Other, so this always adds up to the total above."
    >
      <ul className="space-y-1.5">
        {sources.map((s) => {
          const neg = s.points < 0;
          const w = (Math.abs(s.points) / span) * 100;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span className="w-[92px] shrink-0 truncate text-2xs text-ink-lo">{s.label}</span>
              <span className="relative h-4 min-w-0 flex-1">
                <span className="absolute inset-y-0 left-1/2 w-px bg-hairline" aria-hidden />
                <span
                  className={cn("absolute inset-y-0 rounded-sm", neg ? "right-1/2" : "left-1/2")}
                  style={{ width: `${w / 2}%`, background: SOURCE_TONE[s.key] ?? "var(--volt)" }}
                />
              </span>
              <span
                className={cn(
                  "w-9 shrink-0 text-right text-xs font-semibold num-tabular",
                  neg ? "text-flare" : "text-ink-hi",
                )}
              >
                {s.points > 0 ? `+${s.points}` : s.points}
              </span>
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}

/**
 * Defensive contributions against the line that pays.
 *
 * A season total says nothing on its own — the lane scores per match, and
 * everything under the line in a given match is worth nothing at all. So each
 * match is a bar against its threshold, and only the ones that actually paid
 * are filled.
 */
export function DefconByMatch({
  series,
  threshold,
}: {
  series: { gw: number; defcon: number; minutes: number }[];
  threshold: number;
}) {
  if (threshold >= 99 || series.length === 0) return null;
  const max = Math.max(threshold + 2, ...series.map((s) => s.defcon));
  const hits = series.filter((s) => s.defcon >= threshold).length;

  return (
    <ChartFrame
      eyebrow="Season"
      title="Defensive contributions per match"
      ariaLabel={`Defensive contributions in each gameweek against a threshold of ${threshold}`}
      table={{
        headers: ["GW", "DEFCON", "Cleared"],
        rows: series.map((s) => [`GW${s.gw}`, s.defcon, s.defcon >= threshold ? "yes" : "no"]),
      }}
      caption={`${threshold} clears the line and pays 2 points. Cleared in ${hits} of ${series.length}; everything under the line scored nothing.`}
    >
      <div className="relative flex items-end gap-1.5 pb-1" style={{ height: 128 }}>
        {/* the line that pays — drawn across, because a bar means nothing
            without it */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-hairline-strong"
          style={{ bottom: `${(threshold / max) * 96 + 18}px` }}
        />
        {series.map((s) => {
          const h = Math.max(2, (s.defcon / max) * 96);
          const hit = s.defcon >= threshold;
          return (
            <div key={s.gw} className="flex min-w-[26px] flex-1 flex-col items-center justify-end gap-1">
              <span
                title={`GW${s.gw}: ${s.defcon} of ${threshold}${hit ? " — cleared, 2 points" : ""}`}
                className="w-full rounded-sm"
                style={{
                  height: h,
                  background: hit ? "var(--ultra)" : "color-mix(in oklab, var(--ultra) 28%, transparent)",
                }}
              />
              <span className="text-[10px] leading-none text-ink-lo num-tabular">{s.gw}</span>
            </div>
          );
        })}
      </div>
    </ChartFrame>
  );
}
