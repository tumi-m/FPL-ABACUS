"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { ChartFrame, ChartEmpty } from "@/components/charts/ChartFrame";
import { Est } from "@/components/gaffer/Est";
import { clubOf } from "@/config/clubs";
import { formatPrice, POSITION_SHORT } from "@/lib/ui/format";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

type Row = MatchdayModel["squad"][number];

/**
 * Season-shaped charts for your own fifteen.
 *
 * The decision board asks what this gameweek did to your rank. These ask the
 * slower question underneath it — whether the players you own are actually any
 * good — on the four axes the analytics sites are built around: finishing
 * against expectation, creation against expectation, minutes you can rely on,
 * and what you are paying per point.
 *
 * Everything is drawn from the bootstrap the page already loaded, so none of
 * it costs a request. Every figure is a season total, not a projection, and
 * nothing here is wrapped in `<Est>` except the shrunk rates that are.
 */

const DOT = 5;

/** Enough of a season to read a rate from. Below it, the dot is hollow. */
const TRUSTED_MINUTES = 450;

/**
 * Nudge labels apart.
 *
 * Two players on the same number sit on the same point, and their names print
 * on top of each other. Walking the points in draw order and pushing each
 * label to the other side of its dot when it lands near the previous one is
 * enough to separate them without a layout solver.
 */
function labelOffsets(points: { x: number; y: number }[]): number[] {
  const NEAR = 26;
  const out: number[] = [];
  points.forEach((p, i) => {
    const clash = points.some(
      (q, j) => j < i && Math.abs(q.x - p.x) < NEAR && Math.abs(q.y - p.y) < 14 && out[j] === -9,
    );
    out.push(clash ? 15 : -9);
  });
  return out;
}

/* ── 1. xG against actual goals ────────────────────────────────────────────
   The chart every analytics site opens with, and the one that answers "is he
   due?" honestly: above the line he has scored more than the chances were
   worth, below it he has not. The line itself is parity, not a target. */
export function ExpectedVsActual({ rows }: { rows: Row[] }) {
  const data = React.useMemo(
    () => shapeRows(rows).filter((d) => d.xg > 0 || d.goals > 0),
    [rows],
  );
  if (data.length === 0) {
    return (
      <ChartFrame eyebrow="Finishing" title="Goals against expected" ariaLabel="Goals against expected goals">
        <ChartEmpty>
          No shots taken yet this season — nothing to compare.
        </ChartEmpty>
      </ChartFrame>
    );
  }

  const W = 520;
  const H = 300;
  const M = { top: 16, right: 18, bottom: 40, left: 44 };
  const max = Math.max(1, ...data.map((d) => Math.max(d.xg, d.goals))) * 1.15;
  const x = scaleLinear().domain([0, max]).range([M.left, W - M.right]);
  const y = scaleLinear().domain([0, max]).range([H - M.bottom, M.top]);

  const table = {
    headers: ["Player", "xG", "Goals", "Difference"],
    rows: data
      .slice()
      .sort((a, b) => b.goals - a.goals)
      .map((d) => [d.name, d.xg.toFixed(2), d.goals, (d.goals - d.xg).toFixed(2)]) as (string | number)[][],
  };

  return (
    <ChartFrame
      eyebrow="Finishing"
      title="Goals against expected"
      ariaLabel="Scatter of goals scored against expected goals, with a parity line"
      caption="Above the line he has out-scored his chances; below it he has not. The line is parity, not a target."
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={M.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">{t}</text>
          </g>
        ))}
        {x.ticks(4).map((t) => (
          <text key={t} x={x(t)} y={H - M.bottom + 14} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
            {t}
          </text>
        ))}
        {/* parity */}
        <line
          x1={x(0)} y1={y(0)} x2={x(max)} y2={y(max)}
          stroke="var(--line-hi)" strokeWidth="1.5" strokeDasharray="4 4"
        />
        {(() => {
          const offs = labelOffsets(data.map((d) => ({ x: x(d.xg), y: y(d.goals) })));
          return data.map((d, i) => {
          const over = d.goals >= d.xg;
          return (
            <g key={d.el}>
              <circle
                cx={x(d.xg)} cy={y(d.goals)} r={DOT}
                fill={d.trusted ? clubOf(d.teamId).rail : "transparent"}
                stroke={clubOf(d.teamId).rail}
                strokeWidth="1.5"
              >
                <title>
                  {`${d.name} — ${d.goals} goal${d.goals === 1 ? "" : "s"} from ${d.xg.toFixed(2)} xG (${over ? "+" : "−"}${Math.abs(d.goals - d.xg).toFixed(2)})`}
                </title>
              </circle>
              <text
                x={x(d.xg)} y={y(d.goals) + offs[i]} textAnchor="middle" fontSize="9"
                className="fill-(--ink-mid)"
              >
                {d.name}
              </text>
            </g>
          );
        });
        })()}
        <text x={(W) / 2} y={H - 6} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
          expected goals
        </text>
        <text
          x={12} y={H / 2} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)"
          transform={`rotate(-90 12 ${H / 2})`}
        >
          goals
        </text>
      </svg>
      <p className="mt-2 text-2xs text-ink-lo">
        A hollow dot is under {TRUSTED_MINUTES} minutes — too little football to read a rate from.
      </p>
    </ChartFrame>
  );
}

/* ── 2. Finishing and creation, as one diverging pair ─────────────────────
   Two bars per player: goals minus xG, assists minus xA. The Opta shape —
   what the player did against what the chances were worth, on both sides of
   the ball at once, because a forward over-performing his xG while creating
   nothing is a different bet from one doing both. */
export function OverUnder({ rows }: { rows: Row[] }) {
  const data = React.useMemo(
    () =>
      shapeRows(rows)
        .map((d) => ({ ...d, dg: d.goals - d.xg, da: d.assists - d.xa }))
        .filter((d) => Math.abs(d.dg) > 0.05 || Math.abs(d.da) > 0.05)
        .sort((a, b) => b.dg + b.da - (a.dg + a.da))
        .slice(0, 10),
    [rows],
  );
  if (data.length === 0) {
    return (
      <ChartFrame eyebrow="Over / under" title="Against expectation" ariaLabel="Over and under performance">
        <ChartEmpty>
          Nobody has diverged from their expected numbers yet.
        </ChartEmpty>
      </ChartFrame>
    );
  }

  const rowH = 26;
  const W = 520;
  const H = data.length * rowH + 44;
  const M = { top: 16, right: 16, bottom: 26, left: 104 };
  const span = Math.max(1, ...data.flatMap((d) => [Math.abs(d.dg), Math.abs(d.da)]));
  const mid = M.left + (W - M.left - M.right) / 2;
  const half = (W - M.left - M.right) / 2;

  const table = {
    headers: ["Player", "G − xG", "A − xA"],
    rows: data.map((d) => [d.name, d.dg.toFixed(2), d.da.toFixed(2)]) as (string | number)[][],
  };

  return (
    <ChartFrame
      eyebrow="Over / under"
      title="Against expectation"
      ariaLabel="Goals minus expected goals and assists minus expected assists, per player"
      caption="Right of the line is more than the chances were worth; left is less. Ice is finishing, violet is creation."
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={mid} y1={M.top - 6} x2={mid} y2={H - M.bottom} stroke="var(--axis)" strokeWidth="1" />
        {data.map((d, i) => {
          const yTop = M.top + i * rowH;
          const bar = (v: number, offset: number, tone: string, label: string) => {
            const w = (half * Math.abs(v)) / span;
            return (
              <rect
                x={v >= 0 ? mid : mid - w}
                y={yTop + offset}
                width={Math.max(1.5, w)}
                height={8}
                rx="2"
                fill={tone}
              >
                <title>{`${d.name} — ${label} ${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`}</title>
              </rect>
            );
          };
          return (
            <g key={d.el}>
              <text x={M.left - 10} y={yTop + 13} textAnchor="end" fontSize="11" className="fill-(--ink-mid)">
                {d.name}
              </text>
              {bar(d.dg, 1, "var(--ice)", "goals over expected")}
              {bar(d.da, 11, "var(--ultra)", "assists over expected")}
            </g>
          );
        })}
        <text x={mid - 8} y={H - 8} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">under</text>
        <text x={mid + 8} y={H - 8} textAnchor="start" fontSize="10" className="fill-(--ink-lo)">over</text>
      </svg>
    </ChartFrame>
  );
}

/* ── 3. Minutes you can rely on ───────────────────────────────────────────
   A points-per-week projection is worth nothing if the player is a substitute.
   Starts against appearances is the cheapest honest read on rotation, and it
   is the number most projections quietly assume. */
export function MinutesSecurity({ rows, currentGw }: { rows: Row[]; currentGw: number }) {
  const data = React.useMemo(() => {
    const played = Math.max(1, currentGw);
    return shapeRows(rows)
      .map((d) => ({
        ...d,
        startShare: Math.min(1, d.starts / played),
        minsPerGw: d.minutes / played,
      }))
      .sort((a, b) => a.startShare - b.startShare || a.minsPerGw - b.minsPerGw);
  }, [rows, currentGw]);

  if (data.length === 0) {
    return (
      <ChartFrame eyebrow="Minutes" title="Who actually starts" ariaLabel="Start share per player">
        <ChartEmpty>Nobody has played yet this season.</ChartEmpty>
      </ChartFrame>
    );
  }

  const table = {
    headers: ["Player", "Starts", "Minutes", "Minutes per GW"],
    rows: data.map((d) => [d.name, d.starts, d.minutes, Math.round(d.minsPerGw)]) as (string | number)[][],
  };

  return (
    <ChartFrame
      eyebrow="Minutes"
      title="Who actually starts"
      ariaLabel="Share of gameweeks started, per player, least secure first"
      caption="Least secure first. A projection is worth nothing on a player who does not start."
      table={table}
    >
      <ul className="space-y-1.5">
        {data.map((d) => {
          const pct = Math.round(d.startShare * 100);
          const tone = pct >= 80 ? "var(--surge)" : pct >= 50 ? "var(--amber)" : "var(--flare)";
          return (
            <li key={d.el} className="flex items-center gap-2.5">
              <span className="w-[92px] shrink-0 truncate text-xs text-ink-mid">{d.name}</span>
              <span className="upper-label w-8 shrink-0 text-[9px] text-ink-lo">{POSITION_SHORT[d.pos]}</span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-sunk">
                <span
                  className="block h-full rounded-full transition-[width] dur-slow"
                  style={{ width: `${Math.max(2, pct)}%`, background: tone }}
                />
              </span>
              <span className="w-24 shrink-0 text-right text-2xs text-ink-lo num-tabular">
                {d.starts}/{Math.max(1, currentGw)} · {Math.round(d.minsPerGw)}′
              </span>
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}

/* ── 4. What you pay per point ────────────────────────────────────────────
   Price against points, with the squad's own value line through it. Above the
   line you are getting more than your squad's average pound buys; below it
   you are paying for a name. */
export function ValueForMoney({ rows }: { rows: Row[] }) {
  const data = React.useMemo(() => shapeRows(rows).filter((d) => d.cost > 0), [rows]);
  if (data.length === 0) {
    return (
      <ChartFrame eyebrow="Value" title="Points per pound" ariaLabel="Points against price">
        <ChartEmpty>No prices to compare yet.</ChartEmpty>
      </ChartFrame>
    );
  }

  const W = 520;
  const H = 300;
  const M = { top: 16, right: 18, bottom: 40, left: 44 };
  const totalPts = data.reduce((s, d) => s + d.points, 0);
  const totalCost = data.reduce((s, d) => s + d.cost, 0);
  const perTenth = totalCost > 0 ? totalPts / totalCost : 0;

  const maxCost = Math.max(...data.map((d) => d.cost)) * 1.1;
  const maxPts = Math.max(1, ...data.map((d) => d.points)) * 1.15;
  const x = scaleLinear().domain([Math.min(...data.map((d) => d.cost)) * 0.9, maxCost]).range([M.left, W - M.right]);
  const y = scaleLinear().domain([0, maxPts]).range([H - M.bottom, M.top]);

  const table = {
    headers: ["Player", "Price", "Points", "Points per £m"],
    rows: data
      .slice()
      .sort((a, b) => b.points / b.cost - a.points / a.cost)
      .map((d) => [
        d.name,
        formatPrice(d.cost),
        d.points,
        (d.points / (d.cost / 10)).toFixed(1),
      ]) as (string | number)[][],
  };

  return (
    <ChartFrame
      eyebrow="Value"
      title="Points per pound"
      ariaLabel="Season points against price, with the squad's own value line"
      caption="The line is what a pound buys across your fifteen. Above it you are ahead of your own squad; below it you are paying for a name."
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={M.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">{t}</text>
          </g>
        ))}
        {x.ticks(4).map((t) => (
          <text key={t} x={x(t)} y={H - M.bottom + 14} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
            {formatPrice(t)}
          </text>
        ))}
        {/* the squad's own value line */}
        <line
          x1={x(x.domain()[0])} y1={y(x.domain()[0] * perTenth)}
          x2={x(maxCost)} y2={y(maxCost * perTenth)}
          stroke="var(--line-hi)" strokeWidth="1.5" strokeDasharray="4 4"
        />
        {(() => {
          const offs = labelOffsets(data.map((d) => ({ x: x(d.cost), y: y(d.points) })));
          return data.map((d, i) => (
          <g key={d.el}>
            <circle
              cx={x(d.cost)} cy={y(d.points)} r={DOT}
              fill={d.trusted ? clubOf(d.teamId).rail : "transparent"}
              stroke={clubOf(d.teamId).rail}
              strokeWidth="1.5"
            >
              <title>
                {`${d.name} — ${d.points} pts at ${formatPrice(d.cost)} (${(d.points / (d.cost / 10)).toFixed(1)} per £m)`}
              </title>
            </circle>
            <text x={x(d.cost)} y={y(d.points) + offs[i]} textAnchor="middle" fontSize="9" className="fill-(--ink-mid)">
              {d.name}
            </text>
          </g>
        ));
        })()}
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">price</text>
        <text
          x={12} y={H / 2} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)"
          transform={`rotate(-90 12 ${H / 2})`}
        >
          season points
        </text>
      </svg>
      <p className="mt-2 text-2xs text-ink-lo">
        Your squad averages{" "}
        <Est method="Season points divided by squad value, across the players who have featured">
          {`${(perTenth * 10).toFixed(1)} points per £m`}
        </Est>
        .
      </p>
    </ChartFrame>
  );
}

/** The shared shaping. A plain function, so the charts can call it in a memo. */
function shapeRows(rows: Row[]) {
  return rows
    .filter((r) => r.season.minutes > 0)
    .map((r) => ({
      el: r.element,
      name: r.webName,
      pos: r.pos,
      teamId: r.teamId,
      ...r.season,
      trusted: r.season.minutes >= TRUSTED_MINUTES,
    }));
}
