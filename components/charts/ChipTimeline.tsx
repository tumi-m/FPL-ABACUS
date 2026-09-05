"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { ChartEmpty, ChartFrame, ChartLegend, type ChartTable } from "@/components/charts/ChartFrame";

export type ChipKind = "wc1" | "fh" | "bb" | "wc2" | "mb";

export interface ChipPlay {
  /** Lane owner — manager name or "You". */
  manager: string;
  gw: number;
  kind: ChipKind;
}

/** Chip → series slot. Colour follows the chip type, never the lane. */
const CHIP_SLOT: Record<ChipKind, string> = {
  wc1: "var(--series-1)",
  fh: "var(--series-2)",
  bb: "var(--series-3)",
  wc2: "var(--series-4)",
  mb: "var(--series-5)",
};

const CHIP_NAME: Record<ChipKind, string> = {
  wc1: "WC1",
  fh: "FH",
  bb: "BB",
  wc2: "WC2",
  mb: "MB",
};

/**
 * ChipTimeline — UI doc §6. Lane chart: one lane per manager, chips as pills
 * on a shared gameweek axis. Answers "when is everyone playing chips?".
 */
export function ChipTimeline({
  plays,
  gwRange,
  ariaLabel,
}: {
  plays: ChipPlay[];
  /** [minGw, maxGw] of the visible axis. */
  gwRange?: [number, number];
  ariaLabel?: string;
}) {
  const W = 560;
  const rowH = 30;
  const M = { top: 26, right: 16, bottom: 28, left: 92 };

  if (plays.length === 0) {
    return (
      <ChartFrame eyebrow="Chips" title="When is everyone playing chips?" ariaLabel={ariaLabel ?? "Lane chart of chip plays by gameweek per manager"}>
        <ChartEmpty>No chips played yet.</ChartEmpty>
      </ChartFrame>
    );
  }

  const managers = [...new Set(plays.map((p) => p.manager))];
  const H = Math.max(90, M.top + managers.length * rowH + M.bottom);

  const [g0, g1] = gwRange ?? [
    Math.min(...plays.map((p) => p.gw), 1),
    Math.max(...plays.map((p) => p.gw), 38),
  ];
  const x = scaleLinear().domain([g0, g1]).range([M.left, W - M.right]);
  const laneY = (m: string) => {
    const i = managers.indexOf(m);
    return M.top + i * rowH + (rowH - 12) / 2;
  };

  const usedKinds = [...new Set(plays.map((p) => p.kind))];

  const table: ChartTable = {
    headers: ["Manager", "GW", "Chip"],
    rows: [...plays]
      .sort((a, b) => a.gw - b.gw)
      .map((p) => [p.manager, p.gw, CHIP_NAME[p.kind]]),
  };

  return (
    <ChartFrame
      eyebrow="Chips"
      title="When is everyone playing chips?"
      ariaLabel={ariaLabel ?? "Lane chart of chip plays by gameweek per manager"}
      table={table}
      legend={
        <ChartLegend
          items={usedKinds.map((k) => ({ name: `${CHIP_NAME[k]} — ${chipLabel(k)}`, colorVar: CHIP_SLOT[k] }))}
        />
      }
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* GW gridlines */}
        {range(g0, g1).map((gw) => (
          <g key={gw}>
            <line x1={x(gw)} x2={x(gw)} y1={M.top - 6} y2={H - M.bottom} stroke="var(--grid)" strokeWidth="1" opacity="0.7" />
            <text x={x(gw)} y={H - M.bottom + 15} textAnchor="middle" fontSize="10" className="fill-(--ink-lo) num-tabular">
              {gw}
            </text>
          </g>
        ))}

        {/* lane rails */}
        {managers.map((m) => (
          <g key={m}>
            <line
              x1={M.left} x2={W - M.right}
              y1={laneY(m) + 6} y2={laneY(m) + 6}
              stroke="var(--surface-3)" strokeWidth="8" strokeLinecap="round"
            />
            <text x={M.left - 8} y={laneY(m) + 10} textAnchor="end" fontSize="11" className="fill-(--ink-mid)">
              {truncate(m, 14)}
            </text>
          </g>
        ))}

        {/* chips — flat rounded pills on the rail */}
        {plays.map((p, i) => {
          const px = x(p.gw);
          const py = laneY(p.manager);
          return (
            <g key={`${p.manager}-${p.kind}-${i}`}>
              <rect
                x={px - 13} y={py - 5} width="26" height="22" rx="5"
                fill={CHIP_SLOT[p.kind]}
                stroke="var(--bg-raised)" strokeWidth="2"
              >
                <title>{`${p.manager} — ${chipLabel(p.kind)} in GW${p.gw}`}</title>
              </rect>
              <text
                x={px} y={py + 9}
                textAnchor="middle" fontSize="9" fontWeight="800"
                style={{ fill: "var(--ink-fixed-dark)" }}
              >
                {CHIP_NAME[p.kind]}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

function chipLabel(k: ChipKind): string {
  return { wc1: "Wildcard 1", fh: "Free Hit", bb: "Bench Boost", wc2: "Wildcard 2", mb: "Manager" }[k];
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  const step = b - a > 12 ? Math.ceil((b - a) / 12) : 1;
  for (let g = a; g <= b; g += step) out.push(g);
  if (out[out.length - 1] !== b && b - a <= 24) out.push(b);
  return out;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
