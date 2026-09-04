"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { CrestBadge } from "@/components/gaffer/CrestBadge";
import {
  runCuts,
  runHeat,
  sumRuns,
  type TickerRun,
} from "@/lib/engines/planner";
import type { PlannerClub, PlannerGw, Ticker } from "@/lib/engines/planner";

/**
 * The ticker — twenty clubs against the planning window, each cell coloured by
 * the model's projection and each row totalled so a run reads at a glance.
 *
 * Two things lift it above the FDR ladder it replaced:
 *
 * 1. **Attack and defence are different fixtures.** One number for both is the
 *    compromise that makes most tickers useless for picking defenders, so the
 *    two are scored separately and switched between — the same two-number
 *    model the Board's ticker reads.
 * 2. **The scores are quantities, not indices.** An attacking run is the goals
 *    the model expects the club to score across the window; a defensive run is
 *    the clean sheets it expects to keep. Both readable on their own terms.
 *
 * Every cell arrives carrying its two-number projection, so switching side or
 * dragging the window re-scores locally — no request, no round trip.
 */

type Side = "attack" | "defence";
type SortMode = "run" | "name";

const SIDES: { key: Side; label: string; hint: string }[] = [
  {
    key: "attack",
    label: "Attack",
    hint: "Goals the model expects this club to score across the range — the fixture as a forward sees it",
  },
  {
    key: "defence",
    label: "Defence",
    hint: "Clean sheets it expects to keep — the Poisson shutout chance at the projected concession rate, summed",
  },
];

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
  const [side, setSide] = React.useState<Side>("attack");
  const [sort, setSort] = React.useState<SortMode>("run");
  const [weeks, setWeeks] = React.useState(Math.min(5, gws.length));

  const window = gws.slice(0, weeks);

  const scored = React.useMemo(() => {
    const rows = clubs.map((club) => {
      const cells = window.map((g) => ticker[club.id]?.[g.id] ?? []);
      const run = sumRuns(cells.flat().map((c) => c.run).filter((r): r is TickerRun => r != null));
      return { club, cells, run };
    });
    const order = [...rows].sort((a, b) =>
      side === "attack"
        ? b.run.attack - a.run.attack || a.club.id - b.club.id
        : b.run.defence - a.run.defence || a.club.id - b.club.id,
    );
    if (sort === "name") order.sort((a, b) => a.club.name.localeCompare(b.club.name));
    return order;
  }, [clubs, window, ticker, side, sort]);

  const cuts = React.useMemo(
    () => runCuts(scored.map((r) => (side === "attack" ? r.run.attack : r.run.defence))),
    [scored, side],
  );

  const best = scored[0]
    ? side === "attack"
      ? scored[0].run.attack
      : scored[0].run.defence
    : 0;

  return (
    <section aria-label="Fixture ticker" className="space-y-3 rounded-lg bg-raised card-ring p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="fig-num text-lg leading-none text-ink-hi">Fixture ticker</h2>
          <p className="mt-1 text-2xs text-ink-lo">
            {side === "attack"
              ? "Projected goals for · easiest runs on top · doubles stack, blanks score zero"
              : "Projected clean sheets · easiest runs on top · doubles stack, blanks score zero"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Side" className="flex gap-1 rounded-md glass-edge p-1">
            {SIDES.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={side === s.key}
                title={s.hint}
                onClick={() => setSide(s.key)}
                className={cn(
                  "skewed rounded-sm px-3 py-1.5 text-2xs uppercase-label transition-colors dur-instant",
                  side === s.key ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
                )}
              >
                <span>{s.label}</span>
              </button>
            ))}
          </div>
          <div role="group" aria-label="Ticker window" className="flex gap-1 rounded-md glass-edge p-1">
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
          <div role="group" aria-label="Ticker order" className="flex gap-1 rounded-md glass-edge p-1">
            {(
              [
                { key: "run", label: "Best run" },
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
            {side === "attack" ? "Attacking" : "Defensive"} fixture value for every club over the
            next {weeks} gameweeks
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
            {scored.map(({ club, cells, run }) => {
              const mine = highlightTeams?.has(club.id) ?? false;
              const score = side === "attack" ? run.attack : run.defence;
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
                  {cells.map((cell, i) => {
                    const gwId = window[i].id;
                    if (cell.length === 0) {
                      return (
                        <td key={gwId} className="px-0.5 py-1 text-center">
                          <span
                            title={`GW${gwId} · blank gameweek`}
                            className="block rounded-[3px] px-1 py-1 text-[10px] text-ink-lo"
                            style={{ background: "color-mix(in oklab, var(--bg-sunk) 82%, var(--flare))" }}
                          >
                            —
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={gwId} className="px-0.5 py-1 text-center">
                        <span className="flex flex-col gap-0.5">
                          {cell.map((f, j) => {
                            const value = side === "attack" ? (f.run?.attack ?? 0) : (f.run?.defence ?? 0);
                            const heat = runHeat(value, cuts);
                            const detail =
                              side === "attack"
                                ? `${f.run ? f.run.attack.toFixed(2) : "?"} xG for`
                                : `${f.run ? Math.round(f.run.defence * 100) : "?"}% clean sheet`;
                            return (
                              <span
                                key={j}
                                title={`GW${gwId} · ${f.opp} ${f.home ? "home" : "away"} · ${detail}`}
                                className="block rounded-[3px] px-1 py-0.5 text-[10px] font-semibold"
                                style={{
                                  background: `color-mix(in oklab, var(--heat-${heat}) 26%, transparent)`,
                                  color: "var(--ink-hi)",
                                }}
                              >
                                {f.home ? f.opp : f.opp.toLowerCase()}
                              </span>
                            );
                          })}
                        </span>
                      </td>
                    );
                  })}
                  <td className="pl-2 py-1.5 text-right">
                    <span
                      className="inline-flex items-center justify-end gap-1.5"
                      title={
                        side === "attack"
                          ? `${score.toFixed(2)} expected goals over the window`
                          : `${score.toFixed(2)} expected clean sheets over the window`
                      }
                    >
                      <span
                        aria-hidden
                        className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-sunk sm:inline-block"
                      >
                        <span
                          className="block h-full rounded-full bg-volt"
                          style={{ width: `${best > 0 ? Math.max(2, (score / best) * 100) : 0}%` }}
                        />
                      </span>
                      <span className="fig-num text-sm text-ink-hi">{score.toFixed(1)}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-2xs text-ink-lo">
        UPPERCASE is a home fixture, lowercase away.{" "}
        {side === "attack"
          ? "Run totals add the goals the model expects in every fixture of the window, so a double counts twice and a blank counts nothing."
          : "Run totals add the clean-sheet chance of every fixture in the window, so a double counts twice and a blank counts nothing."}
      </p>
    </section>
  );
}