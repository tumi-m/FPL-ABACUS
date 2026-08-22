"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { useMeasure } from "@/lib/charts/useMeasure";
import { ChartFrame, type ChartTable } from "@/components/charts/ChartFrame";

export interface SwingBarRow {
  label: string;
  detail?: string;
  value: number;
}

/** Diverging horizontal bars — blue for rank lost, red for rank gained (div-pos). */
export function SwingBars({ rows, ariaLabel }: { rows: SwingBarRow[]; ariaLabel: string }) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();
  const w = Math.max(width, 280);
  const rowH = 26;
  const height = rows.length * rowH + 8;
  const labelW = Math.min(150, w * 0.38);
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const x = scaleLinear().domain([-maxAbs, maxAbs]).range([labelW, w - 64]);
  const zero = x(0);

  const table: ChartTable = {
    headers: ["Event", "Ranks"],
    rows: rows.map((r) => [r.label + (r.detail ? ` · ${r.detail}` : ""), formatDelta(r.value)]),
  };

  return (
    <ChartFrame eyebrow="Swing" title="Rank impact by event" ariaLabel={ariaLabel} table={table}>
      <div ref={ref}>
        <svg role="img" width="100%" height={height} aria-hidden>
          {rows.map((r, i) => {
            const yTop = i * rowH + 4;
            const barH = 16;
            const startX = Math.min(zero, x(r.value));
            const endX = Math.max(zero, x(r.value));
            const pos = r.value >= 0;
            return (
              <g key={`${r.label}-${i}`}>
                <text x={0} y={yTop + barH / 2 + 3.5} fontSize={11} fill="var(--ink-2)">
                  {truncate(r.label, 22)}
                </text>
                <rect
                  x={startX}
                  y={yTop}
                  width={Math.max(1, endX - startX)}
                  height={barH}
                  rx={4}
                  ry={4}
                  fill={pos ? "var(--div-pos)" : "var(--div-neg)"}
                  opacity={0.9}
                  className="transition-all dur-base"
                />
                <rect x={zero - 0.5} y={yTop - 2} width={1} height={barH + 4} fill="var(--axis)" />
                <text
                  x={pos ? endX + 6 : endX + 6}
                  y={yTop + barH / 2 + 3.5}
                  fontSize={10.5}
                  fill="var(--ink-2)"
                  className="num-tabular"
                >
                  {formatDelta(r.value)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </ChartFrame>
  );
}

export function formatDelta(v: number): string {
  const abs = Math.abs(v);
  const sign = v > 0 ? "+" : v < 0 ? "\u2212" : "";
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return `${sign}${Math.round(abs)}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
