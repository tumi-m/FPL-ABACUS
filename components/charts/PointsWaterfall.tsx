"use client";

import * as React from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { clubOf } from "@/config/clubs";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

/**
 * Points waterfall — where the gameweek score comes from. One floating bar per
 * scoring player (XI + came-on subs), building cumulatively to the total.
 * Bars wear their CLUB identity colour; the captain keeps a volt armband mark;
 * the total bar is the single volt identity mark. Marks stay flat and upright.
 */
export function PointsWaterfall({
  rows,
  ariaLabel = "Waterfall of your gameweek points by player contribution",
}: {
  rows: MatchdayModel["squad"];
  ariaLabel?: string;
}) {
  const W = 720;
  const H = 320;
  const M = { top: 24, right: 16, bottom: 46, left: 40 };

  const scoring = rows
    .filter((r) => !r.onBench)
    .map((r) => ({
      el: r.element,
      name: r.webName,
      pts: r.livePoints,
      teamId: r.teamId,
      captain: r.isCaptain && r.multiplier >= 2,
    }))
    .sort((a, b) => b.pts - a.pts);

  const total = scoring.reduce((s, r) => s + r.pts, 0);
  let running = 0;
  const bars = scoring.map((r) => {
    const start = running;
    running += r.pts;
    return { ...r, start, end: running };
  });
  void total;

  const x = scaleBand<string>()
    .domain([...bars.map((b) => String(b.el)), "total"])
    .range([M.left, W - M.right])
    .padding(0.18);
  const yMax = Math.max(1, running) * 1.08;
  const y = scaleLinear().domain([0, yMax]).range([H - M.bottom, M.top]);
  const bw = x.bandwidth();

  const table = {
    headers: ["Player", "Points", "Cumulative"],
    rows: [
      ...bars.map((b) => [b.name + (b.captain ? " (C)" : ""), b.pts, Math.round(b.end)]),
      ["Total", Math.round(running), Math.round(running)],
    ],
  };

  return (
    <ChartFrame
      eyebrow="Attribution"
      title="Where your points come from"
      ariaLabel={ariaLabel}
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* y gridlines — hairline */}
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={M.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">
              {t}
            </text>
          </g>
        ))}

        {bars.map((b, i) => {
          const top = y(Math.max(b.start, b.end));
          const height = Math.max(2, y(Math.min(b.start, b.end)) - top);
          const cx = (x(String(b.el)) ?? 0) + bw / 2;
          return (
            <g key={b.el}>
              {/* connector to next bar */}
              {i < bars.length - 1 && (
                <line
                  x1={cx + bw / 2} x2={(x(String(bars[i + 1].el)) ?? 0) + bw / 2}
                  y1={y(b.end)} y2={y(b.end)}
                  stroke="var(--line-hi)" strokeWidth="1" strokeDasharray="2 3"
                />
              )}
              <rect
                x={x(String(b.el))} y={top} width={bw} height={height}
                rx="3" fill={clubOf(b.teamId).rail}
                opacity={b.captain ? 1 : 0.85}
                stroke="var(--bg-raised)" strokeWidth="2"
              >
                <title>{`${b.name}${b.captain ? " (captain)" : ""} — ${b.pts} pts`}</title>
              </rect>
              {b.captain && (
                <text x={cx} y={top - 12} textAnchor="middle" fontSize="9" className="fill-(--volt)" fontWeight="800">
                  C
                </text>
              )}
            </g>
          );
        })}

        {/* the total — volt identity mark */}
        <rect
          x={x("total")} y={y(running)} width={bw} height={Math.max(2, y(0) - y(running))}
          rx="3" fill="var(--volt)"
        />
        <text
          x={(x("total") ?? 0) + bw / 2} y={y(running) - 8}
          textAnchor="middle" fontSize="15" fontWeight="800" fontStyle="italic"
          className="fill-(--ink-hi)" style={{ fontVariationSettings: '"wdth" 110' }}
        >
          {Math.round(running)}
        </text>

        {/* names upright Barlow; values never skew */}
        {bars.map((b) => (
          <text
            key={`n${b.el}`}
            x={(x(String(b.el)) ?? 0) + bw / 2} y={H - M.bottom + 14}
            textAnchor="end" fontSize="10" className="fill-(--ink-mid)"
            transform={`rotate(-35 ${(x(String(b.el)) ?? 0) + bw / 2} ${H - M.bottom + 14})`}
          >
            {b.name}
          </text>
        ))}
        <text x={(x("total") ?? 0) + bw / 2} y={H - M.bottom + 14} textAnchor="middle" fontSize="10" letterSpacing="1.5" className="fill-(--ink-lo)">
          TOTAL
        </text>
      </svg>
    </ChartFrame>
  );
}
