"use client";

import * as React from "react";
import Link from "next/link";
import { CrestTile } from "@/components/gaffer/ClubCrest";
import { clubOf } from "@/config/clubs";
import { cn } from "@/lib/ui/cn";
import {
  rescore,
  scoreLabel,
  tickerCuts,
  tickerHeat,
  type TickerRow,
  type TickerSide,
} from "@/lib/engines/fixtureTicker";

/**
 * The league fixture ticker.
 *
 * Twenty club rows against the gameweeks, ranked by how good the run ahead
 * actually is. The grid arrives once, for the whole rest of the season and
 * with both halves of every projection in it, so switching side, dragging the
 * range or re-sorting is instant — no request, no server round trip. That is
 * what makes a ticker usable: you scan it by fiddling with it.
 *
 * Every control is local state rather than URL state for the same reason. The
 * one thing worth a link is a club's players, which is what the row heading
 * does.
 */

export interface TickerData {
  /** Gameweeks in the grid, ascending — usually now to the end of the season. */
  gws: number[];
  /** Every club, with both sides' projections per fixture. */
  rows: TickerRow[];
  /** Club ids you already own, for the ownership rail. */
  ownedTeamIds: number[];
  /** Short codes and names come from config, but the ids must agree. */
  currentGw: number;
}

type Sort = "run" | "club";

const SIDES: { key: TickerSide; label: string; hint: string }[] = [
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

/**
 * A cell's opponents, capped.
 *
 * FPL never schedules more than a double in practice, but a rescheduled
 * backlog can put three or four in one week, and an uncapped join makes that
 * one cell as wide as the rest of the grid put together. Three plus a count
 * keeps the columns rigid; the full list stays in the cell's title.
 */
const MAX_SHOWN = 3;
function cellLabel(cell: { kind: string; fixtures: { opponentId: number; home: boolean }[] }): string {
  if (cell.kind === "blank") return "—";
  const codes = cell.fixtures.map((f) => {
    const code = clubOf(f.opponentId).code;
    return f.home ? code.toUpperCase() : code.toLowerCase();
  });
  if (codes.length <= MAX_SHOWN) return codes.join("·");
  return `${codes.slice(0, MAX_SHOWN).join("·")}+${codes.length - MAX_SHOWN}`;
}

/** How many gameweeks the range opens on. Six is the usual planning horizon. */
const DEFAULT_SPAN = 6;

export function FixtureTicker({ data }: { data: TickerData }) {
  const { gws, rows, ownedTeamIds } = data;
  const [side, setSide] = React.useState<TickerSide>("attack");
  const [sort, setSort] = React.useState<Sort>("run");
  const [mineOnly, setMineOnly] = React.useState(false);
  const [from, setFrom] = React.useState(gws[0] ?? data.currentGw);
  const [to, setTo] = React.useState(gws[Math.min(DEFAULT_SPAN - 1, gws.length - 1)] ?? data.currentGw);

  const owned = React.useMemo(() => new Set(ownedTeamIds), [ownedTeamIds]);

  // The range in view. Dragging the ends re-scores rather than re-fetching.
  const range = React.useMemo(
    () => gws.filter((g) => g >= Math.min(from, to) && g <= Math.max(from, to)),
    [gws, from, to],
  );

  const scored = React.useMemo(() => rescore(rows, side, range), [rows, side, range]);
  const cuts = React.useMemo(() => tickerCuts(scored), [scored]);

  const visible = React.useMemo(() => {
    const list = mineOnly ? scored.filter((r) => owned.has(r.teamId)) : scored;
    return [...list].sort((a, b) =>
      sort === "run"
        ? a.rank - b.rank
        : clubOf(a.teamId).name.localeCompare(clubOf(b.teamId).name),
    );
  }, [scored, sort, mineOnly, owned]);

  const best = visible[0]?.score ?? 0;
  const sideSpec = SIDES.find((s) => s.key === side)!;

  return (
    <section aria-label="League fixture ticker" className="space-y-3">
      {/* controls — everything local, so the grid answers on the tap */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Side" className="flex gap-1 rounded-md card-ring p-1">
          {SIDES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSide(s.key)}
              aria-pressed={side === s.key}
              title={s.hint}
              className={cn(
                "skewed rounded-sm px-3 py-1.5 text-xs uppercase-label transition-colors dur-instant",
                side === s.key ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
              )}
            >
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* the range, Focal-style: two ends you set rather than a fixed horizon */}
        <label className="inline-flex items-center gap-1.5 rounded-md card-ring px-2 py-1">
          <span className="upper-label text-2xs text-ink-lo">From</span>
          <select
            aria-label="First gameweek"
            value={from}
            onChange={(e) => setFrom(Number(e.target.value))}
            className="h-7 rounded-sm bg-transparent px-1 text-xs fig-num focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
          >
            {gws.map((g) => (
              <option key={g} value={g}>
                GW{g}
              </option>
            ))}
          </select>
          <span className="upper-label text-2xs text-ink-lo">to</span>
          <select
            aria-label="Last gameweek"
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
            className="h-7 rounded-sm bg-transparent px-1 text-xs fig-num focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
          >
            {gws.map((g) => (
              <option key={g} value={g}>
                GW{g}
              </option>
            ))}
          </select>
        </label>

        <div role="group" aria-label="Sort" className="flex gap-1 rounded-md card-ring p-1">
          {(["run", "club"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              aria-pressed={sort === s}
              className={cn(
                "skewed rounded-sm px-3 py-1.5 text-xs uppercase-label transition-colors dur-instant",
                sort === s ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
              )}
            >
              <span>{s === "run" ? "Best run" : "A–Z"}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setMineOnly((v) => !v)}
          aria-pressed={mineOnly}
          className={cn(
            "skewed inline-flex h-9 items-center rounded-md px-3 text-xs uppercase-label transition-colors dur-instant",
            mineOnly ? "bg-volt text-on-accent" : "card-ring text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
          )}
        >
          <span>My clubs</span>
        </button>
      </div>

      <p className="text-2xs leading-relaxed text-ink-lo">{sideSpec.hint}.</p>

      <div className="overflow-x-auto rounded-lg bg-surface-1 card-ring p-2 md:p-3">
        <table className="w-full border-separate text-xs" style={{ borderSpacing: 3 }}>
          <caption className="sr-only">
            {`Fixture ticker, ${side === "attack" ? "attacking" : "defensive"} value, GW${range[0]} to GW${range[range.length - 1]}`}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface-1 px-1 text-left upper-label text-2xs text-ink-lo">
                Club
              </th>
              {range.map((g) => (
                <th key={g} scope="col" className="min-w-[42px] px-1 text-center upper-label text-2xs text-ink-lo">
                  {g}
                </th>
              ))}
              <th scope="col" className="px-1 text-right upper-label text-2xs text-ink-lo">
                Run
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const club = clubOf(row.teamId);
              const mine = owned.has(row.teamId);
              return (
                <tr key={row.teamId}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-surface-1 px-1 text-left font-normal"
                  >
                    <Link
                      href={`/players?club=${row.teamId}`}
                      title={`${club.name} — see their players`}
                      className="inline-flex items-center gap-1.5 rounded-sm transition-colors dur-instant hover:text-ink-hi"
                    >
                      {/* the ownership rail: your clubs are marked, not filtered */}
                      <span
                        aria-hidden
                        className={cn("h-5 w-[3px] shrink-0 rounded-full", mine ? "bg-volt" : "bg-transparent")}
                      />
                      <CrestTile teamId={row.teamId} className="h-4 w-4 shrink-0" />
                      <span className={cn("fig-num text-[13px]", mine ? "text-ink-hi" : "text-ink-2")}>
                        {club.code}
                      </span>
                      {mine && <span className="sr-only">(in your squad)</span>}
                    </Link>
                  </th>

                  {row.cells.map((cell) => {
                    const heat = tickerHeat(cell, cuts);
                    const blank = cell.kind === "blank";
                    const label = cellLabel(cell);
                    const detail = blank
                      ? `GW${cell.gw}: no fixture`
                      : cell.fixtures
                          .map(
                            (f) =>
                              `${clubOf(f.opponentId).name} (${f.home ? "H" : "A"}) · ${
                                side === "attack"
                                  ? `${f.xgFor.toFixed(2)} xG for`
                                  : `${Math.round(f.cleanSheet * 100)}% clean sheet`
                              }`,
                          )
                          .join("  ·  ");
                    return (
                      <td
                        key={cell.gw}
                        title={`${club.name} GW${cell.gw} — ${detail}`}
                        className={cn(
                          "h-8 whitespace-nowrap rounded-[5px] px-1 text-center fig-num text-[11px] leading-none",
                          blank && "card-ring text-ink-lo",
                          cell.kind === "double" && "font-bold",
                        )}
                        style={
                          blank
                            ? undefined
                            : {
                                background: `var(--heat-${heat})`,
                                color: heat >= 4 ? "var(--ink-fixed-dark)" : "var(--ink-on-dark)",
                              }
                        }
                      >
                        {label}
                      </td>
                    );
                  })}

                  <td className="px-1 text-right">
                    {/* the run as a quantity, with a bar so the gaps are visible */}
                    <span
                      className="inline-flex items-center justify-end gap-1.5"
                      title={`${scoreLabel(row.score, side)} over GW${range[0]}–${range[range.length - 1]} · ranked ${row.rank} of ${scored.length}`}
                    >
                      <span aria-hidden className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-sunk sm:inline-block">
                        <span
                          className="block h-full rounded-full bg-volt"
                          style={{ width: `${best > 0 ? Math.max(2, (row.score / best) * 100) : 0}%` }}
                        />
                      </span>
                      <span className="fig-num text-[13px] text-ink-hi num-tabular">
                        {row.score.toFixed(1)}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-lo">
            None of your clubs are in the grid — clear the filter to see the league.
          </p>
        )}
      </div>

      {/* legend — the ramp, and the two things that are not on it */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-2xs text-ink-lo">
        <span className="inline-flex items-center gap-1.5">
          <span className="upper-label">Hard</span>
          {[1, 2, 3, 4, 5, 6].map((h) => (
            <span key={h} aria-hidden className="h-3 w-5 rounded-[3px]" style={{ background: `var(--heat-${h})` }} />
          ))}
          <span className="upper-label">Easy</span>
        </span>
        <span>UPPERCASE home · lowercase away</span>
        <span>A·B is a double · — is a blank</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-[3px] rounded-full bg-volt" /> in your squad
        </span>
      </div>
    </section>
  );
}
