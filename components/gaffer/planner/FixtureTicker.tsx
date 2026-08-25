"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { CrestBadge } from "@/components/gaffer/CrestBadge";
import { fdrHeatStep, runScore } from "@/lib/engines/planner";
import type { PlannerClub, PlannerGw, Ticker } from "@/lib/engines/planner";

/**
 * The ticker — twenty clubs against the planning window, each cell coloured by
 * how easy that fixture rates and each row totalled so a run reads at a glance.
 *
 * The scale runs blue (hard) to green (easy), never red-to-green: a fifth of
 * men are red-green colour blind and the difficulty number sits in every cell
 * anyway. Doubles stack two codes in one cell; blanks read "—" and score zero.
 */

type SortMode = "total" | "name";

export function FixtureTicker({
  clubs,
  gws,
  ticker,
  highlightTeams,
}: {
  clubs: PlannerClub[];
  gws: PlannerGw[];
  ticker: Ticker;
  /** Clubs you already own — marked so your own run stands out. */
  highlightTeams?: Set<number>;
}) {
  const [sort, setSort] = React.useState<SortMode>("total");
  const [weeks, setWeeks] = React.useState(Math.min(5, gws.length));

  const window = gws.slice(0, weeks);

  const rows = React.useMemo(() => {
    const scored = clubs.map((club) => {
      const cells = window.map((g) => ticker[club.id]?.[g.id] ?? []);
      return { club, cells, total: cells.reduce((s, c) => s + runScore(c), 0) };
    });
    scored.sort((a, b) =>
      sort === "name" ? a.club.name.localeCompare(b.club.name) : b.total - a.total,
    );
    return scored;
  }, [clubs, window, ticker, sort]);

  return (
    <section aria-label="Fixture ticker" className="space-y-3 rounded-lg bg-raised card-ring p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="fig-num text-lg leading-none text-ink-hi">Fixture ticker</h2>
          <p className="mt-1 text-2xs text-ink-lo">
            Official difficulty per fixture · easiest runs on top · doubles stack, blanks score zero
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Ticker window" className="flex gap-1 rounded-md card-ring p-1">
            {[3, 5, gws.length].filter((n, i, a) => n > 0 && a.indexOf(n) === i).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={weeks === n}
                onClick={() => setWeeks(n)}
                className={cn(
                  "skewed rounded-sm px-3 py-1.5 text-2xs uppercase-label transition-colors dur-instant",
                  weeks === n ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
                )}
              >
                <span>{n} GW</span>
              </button>
            ))}
          </div>
          <div role="group" aria-label="Ticker order" className="flex gap-1 rounded-md card-ring p-1">
            {(
              [
                { key: "total", label: "Best run" },
                { key: "name", label: "A–Z" },
              ] as const
            ).map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={sort === s.key}
                onClick={() => setSort(s.key)}
                className={cn(
                  "skewed rounded-sm px-3 py-1.5 text-2xs uppercase-label transition-colors dur-instant",
                  sort === s.key ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
                )}
              >
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-xs num-tabular">
          <caption className="sr-only">
            Fixture difficulty for every club over the next {weeks} gameweeks
          </caption>
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className="py-2 pr-2 text-left text-2xs font-semibold uppercase tracking-wide text-ink-3">
                Club
              </th>
              {window.map((g) => (
                <th key={g.id} scope="col" className="px-1 py-2 text-center text-2xs font-semibold text-ink-3">
                  <span className="block uppercase tracking-wide">GW{g.id}</span>
                  <span className="block text-[10px] font-normal text-ink-lo">{g.deadline}</span>
                </th>
              ))}
              <th scope="col" className="pl-2 py-2 text-right text-2xs font-semibold uppercase tracking-wide text-ink-3">
                Run
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ club, cells, total }) => {
              const mine = highlightTeams?.has(club.id) ?? false;
              return (
                <tr
                  key={club.id}
                  className={cn("border-b border-hairline last:border-0", mine && "bg-surface-3/40")}
                >
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <CrestBadge teamId={club.id} size={18} />
                      <span className="truncate text-xs font-semibold text-ink-hi">{club.name}</span>
                      {mine && (
                        <span className="skewed rounded-[3px] bg-volt/15 px-1 text-[9px] uppercase tracking-wide text-volt">
                          <span>Owned</span>
                        </span>
                      )}
                    </span>
                  </th>
                  {cells.map((cell, i) => (
                    <td key={window[i].id} className="px-0.5 py-1 text-center">
                      {cell.length === 0 ? (
                        <span
                          title={`GW${window[i].id} · blank gameweek`}
                          className="block rounded-[3px] px-1 py-1 text-[10px] text-ink-lo"
                          style={{ background: "color-mix(in oklab, var(--bg-sunk) 82%, var(--flare))" }}
                        >
                          —
                        </span>
                      ) : (
                        <span className="flex flex-col gap-0.5">
                          {cell.map((f, j) => (
                            <span
                              key={j}
                              title={`GW${window[i].id} · ${f.opp} ${f.home ? "home" : "away"} · difficulty ${f.fdr}`}
                              className="block rounded-[3px] px-1 py-0.5 text-[10px] font-semibold"
                              style={{
                                background: `color-mix(in oklab, var(--heat-${fdrHeatStep(f.fdr)}) 26%, transparent)`,
                                color: "var(--ink-hi)",
                              }}
                            >
                              {f.home ? f.opp : f.opp.toLowerCase()}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="pl-2 py-1.5 text-right">
                    <span className="fig-num text-sm text-ink-hi">{total}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-2xs text-ink-lo">
        UPPERCASE is a home fixture, lowercase away. Run totals add 5 minus the difficulty of every
        fixture in the window, so a double counts twice and a blank counts nothing.
      </p>
    </section>
  );
}
