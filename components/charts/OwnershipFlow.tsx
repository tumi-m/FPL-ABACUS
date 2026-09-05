"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { area, curveMonotoneX } from "d3-shape";
import { ChartEmpty, ChartFrame, ChartLegend, type ChartTable } from "@/components/charts/ChartFrame";

export interface FlowClub {
  /** Three-letter code — always paired with its club rail colour. */
  club: string;
  /** Club rail token, e.g. "var(--club-ars)". */
  colorVar: string;
  /** Net transfers per day, aligned with `days`. */
  values: number[];
}

/**
 * OwnershipFlow — UI doc §6. Stacked area of net transfers per day across the
 * top movers, club-rail coloured (decorative accent, always with the code).
 */
export function OwnershipFlow({
  days,
  clubs,
  ariaLabel,
}: {
  days: string[];
  clubs: FlowClub[];
  ariaLabel?: string;
}) {
  const W = 560;
  const H = 240;
  const M = { top: 14, right: 14, bottom: 26, left: 44 };

  if (clubs.length === 0 || days.length === 0) {
    return (
      <ChartFrame
        eyebrow="Ownership"
        title="Who is the crowd buying?"
        ariaLabel={ariaLabel ?? "Stacked area chart of net transfers per day for the top moving clubs"}
      >
        <ChartEmpty>No transfer traffic yet.</ChartEmpty>
      </ChartFrame>
    );
  }

  const n = Math.min(days.length, clubs[0]?.values.length ?? 0);
  const x = scaleLinear().domain([0, Math.max(1, n - 1)]).range([M.left, W - M.right]);

  // stack in slot order
  const bases: number[][] = Array.from({ length: n + 1 }, () => []);
  let running = new Array(n).fill(0);
  const layers = clubs.map((c) => {
    const lower = [...running];
    running = running.map((v, i) => v + Math.max(0, c.values[i] ?? 0));
    return { club: c, lower, upper: [...running] };
  });
  void bases;

  const yMax = Math.max(...running, 1);
  const y = scaleLinear().domain([0, yMax]).nice().range([H - M.bottom, M.top]);

  const layerArea = (lower: number[], upper: number[]) =>
    area<number>()
      .x((_, i) => x(i))
      .y0((_, i) => y(lower[i] ?? 0))
      .y1((_, i) => y(upper[i] ?? 0))
      .curve(curveMonotoneX)(Array.from({ length: n }, (_, i) => i)) ?? undefined;

  const table: ChartTable = {
    headers: ["Day", ...clubs.map((c) => c.club)],
    rows: days.slice(0, n).map((d, i) => [d, ...clubs.map((c) => (c.values[i] ?? 0).toLocaleString("en-GB"))]),
  };

  return (
    <ChartFrame
      eyebrow="Ownership"
      title="Who is the crowd buying?"
      ariaLabel={ariaLabel ?? "Stacked area chart of net transfers per day for the top moving clubs"}
      table={table}
      legend={
        <ChartLegend
          items={clubs.map((c) => ({ name: c.club, colorVar: c.colorVar }))}
        />
      }
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f} x1={M.left} x2={W - M.right}
            y1={y(yMax * f)} y2={y(yMax * f)}
            stroke="var(--grid)" strokeWidth="1"
          />
        ))}
        {y.ticks(3).map((t) => (
          <text key={t} x={M.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">
            {t >= 1000 ? `${Math.round(t / 1000)}k` : t}
          </text>
        ))}
        {layers.map((l) => (
          <path key={l.club.club} d={layerArea(l.lower, l.upper)} fill={l.club.colorVar} opacity="0.62" />
        ))}
        {/* day labels — first / middle / last */}
        {[0, Math.floor((n - 1) / 2), n - 1]
          .filter((i, idx, a) => a.indexOf(i) === idx)
          .map((i) => (
            <text key={i} x={x(i)} y={H - M.bottom + 16} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="10" className="fill-(--ink-lo)">
              {days[i]}
            </text>
          ))}
      </svg>
    </ChartFrame>
  );
}
