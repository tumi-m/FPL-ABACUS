"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { area, line, curveMonotoneX } from "d3-shape";
import { useMeasure } from "@/lib/charts/useMeasure";
import { ChartFrame, ChartLegend, type ChartTable } from "@/components/charts/ChartFrame";

export interface BandPoint {
  x: number;
  p5: number;
  p50: number;
  p95: number;
}

/** Monte Carlo fan: p5–p95 band with median line. */
export function ProbabilityBand({
  points,
  ariaLabel,
  xLabel = "Gameweek",
}: {
  points: BandPoint[];
  ariaLabel: string;
  xLabel?: string;
}) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();
  const w = Math.max(width, 280);
  const HEIGHT = 180;
  const margin = { top: 12, right: 12, bottom: 22, left: 40 };

  const x = scaleLinear()
    .domain([points[0]?.x ?? 0, points[points.length - 1]?.x ?? 1])
    .range([margin.left, w - margin.right]);

  const allY = points.flatMap((p) => [p.p5, p.p95]);
  const y = scaleLinear()
    .domain([Math.min(...allY), Math.max(...allY)].map((v) => v) as [number, number])
    .nice()
    .range([HEIGHT - margin.bottom, margin.top]);

  const bandArea = area<BandPoint>()
    .x((d) => x(d.x))
    .y0((d) => y(d.p5))
    .y1((d) => y(d.p95))
    .curve(curveMonotoneX);
  const medianLine = line<BandPoint>()
    .x((d) => x(d.x))
    .y((d) => y(d.p50))
    .curve(curveMonotoneX);

  const table: ChartTable = {
    headers: [xLabel, "p5", "Median", "p95"],
    rows: points.map((p) => [p.x, fmt(p.p5), fmt(p.p50), fmt(p.p95)]),
  };

  return (
    <ChartFrame
      eyebrow="Projection"
      title="Simulated outcome band"
      ariaLabel={ariaLabel}
      legend={
        <ChartLegend
          items={[
            { name: "p5–p95", colorVar: "var(--seq-250)" },
            { name: "median", colorVar: "var(--volt)" },
          ]}
        />
      }
      table={table}
    >
      <div ref={ref}>
        <svg role="img" width="100%" height={HEIGHT}>
          {[0.25, 0.5, 0.75].map((f) => {
            const yy = margin.top + (HEIGHT - margin.top - margin.bottom) * f;
            return <line key={f} x1={margin.left} x2={w - margin.right} y1={yy} y2={yy} stroke="var(--grid)" strokeWidth={1} />;
          })}
          <path d={bandArea(points) ?? undefined} fill="var(--seq-400)" opacity={0.14} />
          <path d={medianLine(points) ?? undefined} fill="none" stroke="var(--volt)" strokeWidth={2} strokeLinejoin="round" />
          {points
            .filter((_, i) => i % Math.ceil(points.length / 6) === 0)
            .map((p) => (
              <text key={p.x} x={x(p.x)} y={HEIGHT - 6} textAnchor="middle" fontSize={10} fill="var(--ink-3)" className="num-tabular">
                {p.x}
              </text>
            ))}
        </svg>
      </div>
    </ChartFrame>
  );
}

const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));
