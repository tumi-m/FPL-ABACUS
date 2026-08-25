"use client";

import * as React from "react";
import Link from "next/link";
import { CrestBadge } from "@/components/gaffer/CrestBadge";
import { PlayerAvatar, useAvatarMode } from "@/components/gaffer/PlayerAvatar";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { cn } from "@/lib/ui/cn";
import { POSITION_SHORT } from "@/lib/ui/format";
import { matchEvents, MatchEventStrip } from "@/components/gaffer/field/MatchEvents";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

type Row = MatchdayModel["squad"][number];

/**
 * Two reads of the same gameweek, under the waterfall.
 *
 * The waterfall says how the total was built; it cannot say what any single
 * bar is *made of*. A six can be a goal, or ninety quiet minutes plus a clean
 * sheet, and those are different players to own. So: a stacked bar per
 * position showing where the points came from by line, and a table that shows
 * each player's actual stat line beside the number.
 */

const LINES = [
  { pos: 1, label: "Keeper" },
  { pos: 2, label: "Defence" },
  { pos: 3, label: "Midfield" },
  { pos: 4, label: "Attack" },
] as const;

/** The captain's multiplier is part of what a player contributed. */
const contribution = (r: Row) => r.livePoints * r.multiplier;

export function PointsByLine({ rows }: { rows: Row[] }) {
  const data = React.useMemo(() => {
    const playing = rows.filter((r) => !r.onBench);
    return LINES.map((l) => {
      const inLine = playing.filter((r) => r.pos === l.pos);
      return {
        ...l,
        points: inLine.reduce((s, r) => s + contribution(r), 0),
        players: inLine.length,
      };
    });
  }, [rows]);

  const total = data.reduce((s, d) => s + d.points, 0);
  const max = Math.max(1, ...data.map((d) => Math.abs(d.points)));

  const table = {
    headers: ["Line", "Players", "Points", "Share"],
    rows: data.map((d) => [
      d.label,
      d.players,
      d.points,
      total > 0 ? `${Math.round((d.points / total) * 100)}%` : "—",
    ]) as (string | number)[][],
  };

  return (
    <ChartFrame
      eyebrow="Shape"
      title="Where the score came from"
      ariaLabel="Gameweek points by line of the team"
      caption="Captaincy included, so a doubled forward shows the weight he actually carried."
      table={table}
    >
      <ul className="space-y-2.5">
        {data.map((d) => {
          const share = total > 0 ? d.points / total : 0;
          return (
            <li key={d.pos} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-ink-mid">{d.label}</span>
              <span className="relative h-4 flex-1 overflow-hidden rounded-md bg-sunk">
                <span
                  className="block h-full rounded-md bg-volt transition-[width] dur-slow"
                  style={{ width: `${Math.max(1, (Math.abs(d.points) / max) * 100)}%` }}
                />
              </span>
              <span className="w-20 shrink-0 text-right num-tabular">
                <span className="fig-num text-sm text-ink-hi">{d.points}</span>
                <span className="ml-1.5 text-2xs text-ink-lo">{Math.round(share * 100)}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}

/**
 * The stat line behind every number.
 *
 * A points figure with no working shown is a number you have to trust. This is
 * the working: minutes, what he did, and what it added up to — the same event
 * badges the pitch uses, so the two screens speak one language.
 */
export function PointsTable({ rows }: { rows: Row[] }) {
  const [avatar] = useAvatarMode();
  const ordered = React.useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          Number(a.onBench) - Number(b.onBench) ||
          contribution(b) - contribution(a) ||
          a.pos - b.pos,
      ),
    [rows],
  );

  return (
    <section aria-label="Points by player" className="space-y-2">
      <h2 className="upper-label text-2xs text-ink-lo">Every player, and the working</h2>
      <div className="overflow-x-auto rounded-lg bg-surface-1 card-ring p-2 md:p-3">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Each player&apos;s minutes, what they did, and the points it produced
          </caption>
          <thead>
            <tr className="border-b border-hairline text-left">
              {["Player", "Opp", "Min", "Did", "Pts"].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    "px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-3",
                    i >= 2 && "text-right",
                    h === "Did" && "text-center",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((r) => {
              const done = r.fixtureState === "done";
              const events = matchEvents(r.liveStats, {
                pos: r.pos,
                fixtureDone: done,
                bonus: r.bonus,
                bonusOfficial: r.bonusOfficial,
              });
              return (
                <tr
                  key={r.element}
                  className={cn(
                    "border-b border-hairline last:border-0",
                    r.onBench && "opacity-60",
                  )}
                >
                  <td className="px-2 py-2">
                    <Link
                      href={`/players/${r.element}`}
                      className="flex min-w-0 items-center gap-2 transition-colors dur-instant hover:text-volt"
                    >
                      <span className="relative inline-block h-8 w-8 shrink-0">
                        <span className="block h-8 w-8 overflow-hidden rounded-md bg-surface-3">
                          <PlayerAvatar
                            photo={r.photo}
                            teamId={r.teamId}
                            mode={avatar}
                            className="h-8 w-8 object-cover object-top"
                          />
                        </span>
                        <CrestBadge
                          teamId={r.teamId}
                          size={12}
                          className="absolute -bottom-0.5 -right-0.5 rounded-[2px] bg-surface-1"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink-hi">
                          {r.webName}
                          {r.isCaptain && r.multiplier >= 2 && (
                            <span className="ml-1.5 text-2xs font-bold text-volt">
                              {r.multiplier >= 3 ? "3C" : "C"}
                            </span>
                          )}
                        </span>
                        <span className="upper-label block text-[9px] text-ink-lo">
                          {POSITION_SHORT[r.pos]}
                          {r.onBench ? " · bench" : ""}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-xs text-ink-mid num-tabular">{r.opponentShort}</td>
                  <td className="px-2 py-2 text-right text-xs text-ink-mid num-tabular">
                    {r.minutes}
                  </td>
                  <td className="px-2 py-2">
                    {events.length > 0 ? (
                      <MatchEventStrip events={events} className="!mt-0 justify-center" />
                    ) : (
                      <span className="block text-center text-2xs text-ink-lo">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className="fig-num text-base text-ink-hi num-tabular">
                      {contribution(r)}
                    </span>
                    {r.multiplier >= 2 && (
                      <span className="block text-2xs text-ink-lo num-tabular">
                        {r.livePoints}×{r.multiplier}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
