"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { ChartFrame, ChartLegend } from "@/components/charts/ChartFrame";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

/**
 * EOScatter — UI doc §6. x = effective ownership in the cohort, y = your
 * multiplier − EO. Quadrants: Active bets · Ignored · Template · Trap.
 * You-via-captain marks use --volt (single-mark emphasis); dots are series-1.
 * Charts are never skewed, never glossed.
 */
export function EOScatter({
  rows,
  ariaLabel = "Scatter of your squad by effective ownership and active weight",
}: {
  rows: MatchdayModel["squad"];
  ariaLabel?: string;
}) {
  const W = 560;
  const H = 320;
  const M = { top: 18, right: 18, bottom: 34, left: 44 };

  const pts = rows.map((r) => ({
    el: r.element,
    name: r.webName,
    x: Math.max(0, Math.min(100, r.eo)),
    y: r.multiplier - r.eo / 100,
    captain: r.isCaptain && r.multiplier >= 2,
  }));

  const x = scaleLinear().domain([0, 100]).range([M.left, W - M.right]);
  const yMax = Math.max(1.2, ...pts.map((p) => Math.abs(p.y))) * 1.15;
  const y = scaleLinear().domain([-yMax, yMax]).range([H - M.bottom, M.top]);

  const table = {
    headers: ["Player", "EO %", "Your mult", "Active"],
    rows: [...pts]
      .sort((a, b) => b.y - a.y)
      .map((p) => [p.name, p.x.toFixed(1), p.captain ? "2+" : "1", p.y.toFixed(2)]),
  };

  return (
    <ChartFrame
      eyebrow="Exposure"
      title="Where am I exposed?"
      ariaLabel={ariaLabel}
      table={table}
      legend={
        <ChartLegend
          items={[
            { name: "Your players", colorVar: "var(--series-1)" },
            { name: "Captain", colorVar: "var(--volt)" },
          ]}
        />
      }
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* quadrant tints + labels */}
        <rect x={x(50)} y={M.top} width={x(100) - x(50)} height={y(0) - M.top} fill="var(--ultra)" opacity={0.05} />
        <rect x={x(50)} y={y(0)} width={x(100) - x(50)} height={y(-yMax) - y(0)} fill="var(--flare)" opacity={0.04} />
        {[
          ["Active bets", x(25), M.top + 14],
          ["Ignored", x(25), y(-yMax) - 8],
          ["Template", x(75), M.top + 14],
          ["Trap (faded)", x(75), y(-yMax) - 8],
        ].map(([t, cx, cy]) => (
          <text key={t as string} x={cx as number} y={cy as number} textAnchor="middle"
            className="fill-(--ink-lo)" fontSize="10" letterSpacing="1.5" style={{ textTransform: "uppercase" }}>
            {t}
          </text>
        ))}

        {/* zero rules */}
        <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="var(--line-hi)" strokeWidth="1" />
        <line x1={x(50)} x2={x(50)} y1={M.top} y2={H - M.bottom} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 4" />

        {/* axes */}
        {[0, 25, 50, 75, 100].map((t) => (
          <text key={t} x={x(t)} y={H - M.bottom + 16} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
            {t}
          </text>
        ))}
        {[yMax, 0, -yMax].map((t) => (
          <text key={t} x={M.left - 8} y={y(t) + 3} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">
            {t.toFixed(1)}
          </text>
        ))}
        <text x={(W + M.left) / 2} y={H - 4} textAnchor="middle" fontSize="10" className="fill-(--ink-mid)">
          Effective ownership % →
        </text>

        {/* dots — 2px surface gaps via stroke */}
        {pts.map((p) => (
          <circle
            key={p.el}
            cx={x(p.x)}
            cy={y(Math.max(-yMax, Math.min(yMax, p.y)))}
            r={p.captain ? 6 : 4.5}
            fill={p.captain ? "var(--volt)" : "var(--series-1)"}
            stroke="var(--bg-raised)"
            strokeWidth="2"
            opacity={p.captain ? 1 : 0.85}
          >
            <title>{`${p.name} — EO ${p.x.toFixed(1)}%, active ${p.y >= 0 ? "+" : ""}${p.y.toFixed(2)}`}</title>
          </circle>
        ))}
      </svg>
    </ChartFrame>
  );
}
