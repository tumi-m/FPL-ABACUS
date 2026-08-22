"use client";

import * as React from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import { line, curveMonotoneX } from "d3-shape";
import { useMeasure } from "@/lib/charts/useMeasure";
import { ChartFrame, ChartLegend, type ChartTable } from "@/components/charts/ChartFrame";
import type { Series } from "@/lib/charts/series";
import { entityColor } from "@/lib/charts/series";

const HEIGHT = 220;

export function RankCurve({
  series,
  table,
}: {
  /** Each series' y values are RANKS (lower is better). */
  series: Series[];
  table?: ChartTable;
}) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();
  const [hoverX, setHoverX] = React.useState<number | null>(null);
  const w = Math.max(width, 280);
  const margin = { top: 12, right: 12, bottom: 22, left: 44 };

  const allPoints = series.flatMap((s) => s.data);
  const yExtent: [number, number] = [
    Math.max(...allPoints.map((p) => p.y), 10),
    Math.min(...allPoints.map((p) => p.y), 1),
  ];
  const xExtent: [number, number] = [
    Math.min(...allPoints.map((p) => p.x)),
    Math.max(...allPoints.map((p) => p.x)),
  ];

  const x = scaleLinear().domain(xExtent).range([margin.left, w - margin.right]);
  const y = scaleLog()
    .domain([Math.max(1, yExtent[0]), Math.max(1, yExtent[1])])
    .range([HEIGHT - margin.bottom, margin.top]);

  const gen = line<{ x: number; y: number }>()
    .x((d) => x(d.x))
    .y((d) => y(Math.max(1, d.y)))
    .curve(curveMonotoneX);

  const gridRanks = [1, 100, 10_000, 1_000_000].filter((r) => r >= yExtent[1] && r <= yExtent[0]);
  const hoverIdx = hoverX !== null ? Math.round(x.invert(hoverX)) : null;

  return (
    <ChartFrame
      eyebrow="Rank"
      title="Overall rank by gameweek"
      ariaLabel={`Line chart of overall rank across gameweeks for ${series.map((s) => s.name).join(", ")}. Lower is better.`}
      legend={
        <ChartLegend
          items={series.map((s) => ({
            name: s.name,
            colorVar: entityColor(s.entity),
          }))}
        />
      }
      table={table}
    >
      <div ref={ref} className="relative">
        <svg
          role="img"
          width="100%"
          height={HEIGHT}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            setHoverX(e.clientX - rect.left);
          }}
          onMouseLeave={() => setHoverX(null)}
        >
          {gridRanks.map((r) => (
            <g key={r}>
              <line x1={margin.left} x2={w - margin.right} y1={y(r)} y2={y(r)} stroke="var(--grid)" strokeWidth={1} />
              <text x={margin.left - 6} y={y(r) + 3} textAnchor="end" fontSize={10} fill="var(--ink-3)" className="num-tabular">
                {compactRank(r)}
              </text>
            </g>
          ))}
          {series.map((s) => {
            const isYou = s.entity === "you";
            return (
              <path
                key={s.id}
                d={gen(s.data) ?? undefined}
                fill="none"
                stroke={isYou ? "var(--volt)" : entityColor(s.entity)}
                strokeWidth={isYou ? 3 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={isYou ? 1 : 0.85}
              />
            );
          })}
          {series
            .filter((s) => s.entity === "you" && s.data.length > 0)
            .map((s) => {
              const last = s.data[s.data.length - 1];
              return (
                <g key={`${s.id}-dot`}>
                  <circle cx={x(last.x)} cy={y(Math.max(1, last.y))} r={8} fill="var(--surface-1)" />
                  <circle cx={x(last.x)} cy={y(Math.max(1, last.y))} r={4.5} fill="var(--volt)" />
                  <text
                    x={x(last.x) - 8}
                    y={y(Math.max(1, last.y)) - 9}
                    textAnchor="end"
                    fontSize={11}
                    fill="var(--ink-2)"
                    className="fig-num"
                  >
                    {compactRank(last.y)}
                  </text>
                </g>
              );
            })}
          {hoverIdx !== null && (
            <line
              x1={x(hoverIdx)}
              x2={x(hoverIdx)}
              y1={margin.top}
              y2={HEIGHT - margin.bottom}
              stroke="var(--axis)"
              strokeWidth={1}
            />
          )}
        </svg>
        {hoverIdx !== null && series.length > 0 && (
          <div
            className="pointer-events-none absolute z-10 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs text-ink-2 card-ring overlay-shadow num-tabular"
            style={{ left: Math.min(x(hoverIdx) + 10, w - 130), top: 8 }}
          >
            <div className="font-medium text-ink-1">GW {hoverIdx}</div>
            {series.map((s) => {
              const pt = s.data.find((p) => p.x === hoverIdx);
              return pt ? (
                <div key={s.id}>
                  {s.name}: {compactRank(pt.y)}
                </div>
              ) : null;
            })}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

function compactRank(rank: number): string {
  if (rank >= 1_000_000) return `${(rank / 1_000_000).toFixed(1)}M`;
  if (rank >= 1_000) return `${(rank / 1_000).toFixed(0)}k`;
  return String(rank);
}
