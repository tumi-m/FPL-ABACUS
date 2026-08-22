"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { line, curveMonotoneX } from "d3-shape";
import { ChartFrame, ChartLegend, type ChartTable } from "@/components/charts/ChartFrame";

export interface XgPoint {
  /** Gameweek number. */
  gw: number;
  /** Cumulative expected goal involvement. */
  xgi: number;
  /** Cumulative actual returns (goals + assists). */
  actual: number;
}

/**
 * xGvsActual — UI doc §6. Cumulative xGI vs cumulative returns on ONE axis
 * (same unit, so dual-axis stays illegal). The gap answers "is he due, or is
 * he finished?". Series slots 1–2; the final gap figure is the emphasis.
 */
export function XgVsActual({
  playerName,
  points,
  ariaLabel,
}: {
  playerName?: string;
  points: XgPoint[];
  ariaLabel?: string;
}) {
  const W = 560;
  const H = 260;
  const M = { top: 16, right: 56, bottom: 30, left: 40 };

  const x = scaleLinear()
    .domain([Math.min(...points.map((p) => p.gw)), Math.max(...points.map((p) => p.gw, 0))])
    .range([M.left, W - M.right]);
  const hi = Math.max(...points.map((p) => Math.max(p.xgi, p.actual)), 1) * 1.08;
  const y = scaleLinear().domain([0, hi]).range([H - M.bottom, M.top]);

  const gen = (key: "xgi" | "actual") =>
    line<XgPoint>()
      .x((d) => x(d.gw))
      .y((d) => y(d[key]))
      .curve(curveMonotoneX)(points) ?? undefined;

  const last = points[points.length - 1];
  const gap = last ? last.actual - last.xgi : 0;
  const due = gap < 0;

  const table: ChartTable = {
    headers: ["GW", "Cum. xGI", "Cum. returns", "Gap"],
    rows: points.map((p) => [p.gw, p.xgi.toFixed(2), p.actual.toFixed(2), (p.actual - p.xgi).toFixed(2)]),
  };

  return (
    <ChartFrame
      eyebrow="Underlying"
      title={playerName ? `${playerName} — due, or finished?` : "Due, or finished?"}
      ariaLabel={ariaLabel ?? `Line chart of cumulative expected goal involvement versus cumulative actual returns`}
      table={table}
      legend={
        <ChartLegend
          items={[
            { name: "Cumulative xGI", colorVar: "var(--series-1)" },
            { name: "Actual returns", colorVar: "var(--series-2)" },
          ]}
        />
      }
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={M.left} x2={W - M.right} y1={y(hi * f)} y2={y(hi * f)} stroke="var(--grid)" strokeWidth="1" />
        ))}
        {y.ticks(4).filter((t) => t > 0).map((t) => (
          <text key={t} x={M.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">
            {t}
          </text>
        ))}
        {points.filter((_, i) => i === 0 || i === points.length - 1).map((p) => (
          <text key={p.gw} x={x(p.gw)} y={H - M.bottom + 16} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
            GW{p.gw}
          </text>
        ))}

        {/* the gap wash between the lines */}
        <path
          d={`${gen("actual")} L ${x(last?.gw ?? 0)} ${y(0)} L ${x(points[0]?.gw ?? 0)} ${y(0)} Z`}
          fill="var(--seq-400)"
          opacity="0.07"
        />

        <path d={gen("xgi")} fill="none" stroke="var(--series-1)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.95" />
        <path d={gen("actual")} fill="none" stroke="var(--series-2)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* end dots + the verdict figure */}
        {last && (
          <>
            <circle cx={x(last.gw)} cy={y(last.xgi)} r="4" fill="var(--bg-raised)" stroke="var(--series-1)" strokeWidth="2" />
            <circle cx={x(last.gw)} cy={y(last.actual)} r="4" fill="var(--bg-raised)" stroke="var(--series-2)" strokeWidth="2" />
            <text x={x(last.gw) + 9} y={y(last.xgi) - 4} fontSize="11" className="fig-num fill-(--series-1)">
              {last.xgi.toFixed(1)}
            </text>
            <text x={x(last.gw) + 9} y={y(last.actual) + 14} fontSize="11" className="fig-num fill-(--series-2)">
              {last.actual.toFixed(1)}
            </text>
            <text x={x(last.gw) + 9} y={(y(last.xgi) + y(last.actual)) / 2 + 4} fontSize="10" letterSpacing="1" className={due ? "fill-(--surge)" : "fill-(--flare)"}>
              {due ? "DUE" : "OVER"}
            </text>
          </>
        )}
      </svg>
    </ChartFrame>
  );
}
