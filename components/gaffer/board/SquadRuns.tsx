"use client";

import * as React from "react";
import { CrestBadge } from "@/components/gaffer/CrestBadge";
import { PlayerAvatar, useAvatarMode } from "@/components/gaffer/PlayerAvatar";
import { clubOf } from "@/config/clubs";
import { cn } from "@/lib/ui/cn";
import { POSITION_SHORT } from "@/lib/ui/format";
import {
  rescore,
  scoreLabel,
  tickerCuts,
  tickerHeat,
  type TickerRow,
  type TickerSide,
} from "@/lib/engines/fixtureTicker";
import type { Pos } from "@/lib/engines/types";

/**
 * Your fifteen against the same grid, judged by position.
 *
 * The league ticker asks you to pick a side to read; a squad does not need
 * asking. A keeper or a defender is read on clean sheets and everyone else on
 * goals, because the same fixture is not the same fixture for Gabriel and
 * Watkins — which is the one thing a club-level ticker structurally cannot
 * tell you, and the reason this panel survived the rebuild.
 */

export interface SquadMember {
  element: number;
  webName: string;
  pos: Pos;
  teamId: number;
  /** FPL photo code, for the face; the kit stands in when it is missing. */
  photo: string;
}

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

const SPANS = [3, 6, 8] as const;

/** Keepers and defenders are paid for shutouts; midfielders and forwards for goals. */
function sideFor(pos: Pos): TickerSide {
  return pos <= 2 ? "defence" : "attack";
}

export function SquadRuns({
  squad,
  rows,
  gws,
}: {
  squad: SquadMember[];
  rows: TickerRow[];
  gws: number[];
}) {
  const [span, setSpan] = React.useState<number>(6);
  // The device-wide faces/kits preference, same as every other board.
  const [avatar] = useAvatarMode();
  const range = React.useMemo(() => gws.slice(0, span), [gws, span]);

  // Both sides of the same grid, so each player can be read on their own.
  const attack = React.useMemo(() => rescore(rows, "attack", range), [rows, range]);
  const defence = React.useMemo(() => rescore(rows, "defence", range), [rows, range]);
  const attackCuts = React.useMemo(() => tickerCuts(attack), [attack]);
  const defenceCuts = React.useMemo(() => tickerCuts(defence), [defence]);

  const byTeam = React.useMemo(
    () => ({
      attack: new Map(attack.map((r) => [r.teamId, r])),
      defence: new Map(defence.map((r) => [r.teamId, r])),
    }),
    [attack, defence],
  );

  const players = React.useMemo(
    () =>
      squad
        .map((p) => {
          const side = sideFor(p.pos);
          const row = byTeam[side].get(p.teamId);
          return { ...p, side, row };
        })
        .filter((p): p is typeof p & { row: TickerRow } => p.row != null)
        // Worst runs first: this panel is for spotting who to move on, and the
        // player you need to see is the one whose fixtures have turned.
        .sort((a, b) => a.row.score - b.row.score || a.pos - b.pos),
    [squad, byTeam],
  );

  if (players.length === 0) {
    return (
      <section aria-label="Your squad's fixture runs" className="space-y-2">
        <h2 className="upper-label text-2xs text-ink-lo">Your fifteen</h2>
        <p className="rounded-lg bg-surface-1 card-ring p-6 text-center text-sm text-ink-lo">
          Your picks for this gameweek are not visible yet.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Your squad's fixture runs" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="upper-label text-2xs text-ink-lo">
          Your fifteen · hardest run first
        </h2>
        <div role="group" aria-label="Squad horizon" className="flex gap-1 rounded-md card-ring p-1">
          {SPANS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSpan(n)}
              aria-pressed={span === n}
              className={cn(
                "skewed rounded-sm px-2.5 py-1 text-2xs uppercase-label transition-colors dur-instant",
                span === n ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
              )}
            >
              <span>next {n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg bg-surface-1 card-ring p-2 md:p-3">
        <table className="w-full border-separate text-xs" style={{ borderSpacing: 3 }}>
          <caption className="sr-only">
            Your squad&apos;s fixture runs over the next {span} gameweeks, keepers and defenders
            scored on clean sheets and everyone else on goals
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface-1 px-1 text-left upper-label text-2xs text-ink-lo">
                Player
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
            {players.map((p) => {
              const cuts = p.side === "attack" ? attackCuts : defenceCuts;
              return (
                <tr key={p.element}>
                  <th scope="row" className="sticky left-0 z-10 bg-surface-1 px-1 text-left font-normal">
                    <span className="inline-flex items-center gap-1.5">
                      {/* face over crest, the way every other squad list reads */}
                      <span className="relative inline-block h-7 w-7 shrink-0">
                        <span className="block h-7 w-7 overflow-hidden rounded-md bg-surface-3">
                          <PlayerAvatar
                            photo={p.photo}
                            teamId={p.teamId}
                            mode={avatar}
                            className="h-7 w-7 object-cover object-top"
                          />
                        </span>
                        <CrestBadge
                          teamId={p.teamId}
                          size={12}
                          className="absolute -bottom-0.5 -right-0.5 rounded-[2px] bg-surface-1"
                        />
                      </span>
                      <span className="truncate text-[13px] text-ink-hi">{p.webName}</span>
                      <span className="upper-label text-[9px] text-ink-lo">{POSITION_SHORT[p.pos]}</span>
                    </span>
                  </th>
                  {p.row.cells.map((cell) => {
                    const heat = tickerHeat(cell, cuts);
                    const blank = cell.kind === "blank";
                    const label = cellLabel(cell);
                    return (
                      <td
                        key={cell.gw}
                        title={
                          blank
                            ? `${p.webName} GW${cell.gw}: no fixture`
                            : `${p.webName} GW${cell.gw} — ${cell.fixtures
                                .map((f) =>
                                  p.side === "attack"
                                    ? `${clubOf(f.opponentId).name}: ${f.xgFor.toFixed(2)} xG for`
                                    : `${clubOf(f.opponentId).name}: ${Math.round(f.cleanSheet * 100)}% clean sheet`,
                                )
                                .join(" · ")}`
                        }
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
                  <td
                    className="px-1 text-right fig-num text-[13px] text-ink-hi num-tabular"
                    title={`${scoreLabel(p.row.score, p.side)} over the next ${span} — ${
                      p.side === "attack" ? "scored on goals" : "scored on clean sheets"
                    }`}
                  >
                    {p.row.score.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-2xs text-ink-lo">
        Keepers and defenders are scored on clean sheets kept, everyone else on goals scored — so
        the same club can sit in different colours for two of your players.
      </p>
    </section>
  );
}
