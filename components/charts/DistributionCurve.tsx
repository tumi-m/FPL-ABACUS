"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { area, line, curveMonotoneX } from "d3-shape";
import { useMeasure } from "@/lib/charts/useMeasure";
import { ChartFrame, type ChartTable } from "@/components/charts/ChartFrame";

export interface DistBin {
  x: number;
  y: number;
}

/** Field score distribution with your position marked. One hue + brand marker. */
export function DistributionCurve({
  bins,
  yourScore,
  ariaLabel,
}: {
  bins: DistBin[];
  yourScore: number;
  ariaLabel: string;
}) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();
  const w = Math.max(width, 280);
  const HEIGHT = 160;
  const margin = { top: 10, right: 12, bottom: 22, left: 32 };

  const x = scaleLinear()
    .domain([bins[0]?.x ?? 0, bins[bins.length - 1]?.x ?? 100])
    .range([margin.left, w - margin.right]);
  const yMax = Math.max(...bins.map((b) => b.y), 1);
  const y = scaleLinear().domain([0, yMax]).nice().range([HEIGHT - margin.bottom, margin.top]);

  const areaGen = area<DistBin>()
    .x((d) => x(d.x))
    .y0(HEIGHT - margin.bottom)
    .y1((d) => y(d.y))
    .curve(curveMonotoneX);
  const lineGen = line<DistBin>()
    .x((d) => x(d.x))
    .y((d) => y(d.y))
    .curve(curveMonotoneX);

  const table: ChartTable = {
    headers: ["Score", "Managers"],
    rows: bins.filter((_, i) => i % 5 === 0).map((b) => [b.x, b.y.toLocaleString()]),
  };

  return (
    <ChartFrame eyebrow="Field" title="Gameweek score distribution" ariaLabel={ariaLabel} table={table}>
      <div ref={ref} className="relative">
        <svg role="img" width="100%" height={HEIGHT}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={margin.left}
              x2={w - margin.right}
              y1={y(yMax * f)}
              y2={y(yMax * f)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
          ))}
          <path d={areaGen(bins) ?? undefined} fill="var(--seq-400)" opacity={0.14} />
          <path d={lineGen(bins) ?? undefined} fill="none" stroke="var(--seq-400)" strokeWidth={2} strokeLinejoin="round" />
          <line
            x1={x(yourScore)}
            x2={x(yourScore)}
            y1={margin.top}
            y2={HEIGHT - margin.bottom}
            stroke="var(--brand)"
            strokeWidth={2}
          />
          <text
            x={Math.min(x(yourScore) + 6, w - margin.right - 60)}
            y={margin.top + 12}
            fontSize={11}
            fontWeight={600}
            fill="var(--ink-1)"
            className="num-tabular"
          >
            you · {yourScore}
          </text>
          {bins
            .filter((_, i) => i % 10 === 0)
            .map((b) => (
              <text key={b.x} x={x(b.x)} y={HEIGHT - 6} textAnchor="middle" fontSize={10} fill="var(--ink-3)" className="num-tabular">
                {b.x}
              </text>
            ))}
        </svg>
      </div>
    </ChartFrame>
  );
}
