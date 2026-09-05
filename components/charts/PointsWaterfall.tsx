"use client";

import * as React from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { ChartEmpty, ChartFrame } from "@/components/charts/ChartFrame";
import { clubOf } from "@/config/clubs";
import { playerImg } from "@/lib/ui/format";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

/**
 * Points waterfall — where the gameweek score comes from. One floating bar per
 * scoring player (XI + came-on subs), building cumulatively to the total.
 * Bars wear their CLUB identity colour; the captain keeps a volt armband mark;
 * the total bar is the single volt identity mark. Marks stay flat and upright.
 *
 * The axis carries faces rather than names rotated thirty-five degrees. A
 * rotated name is unreadable at a glance and cost the chart its whole bottom
 * edge; a face is recognised without being read, and the name sits under it
 * upright for anyone who needs it.
 */
export function PointsWaterfall({
  rows,
  ariaLabel = "Waterfall of your gameweek points by player contribution",
}: {
  rows: MatchdayModel["squad"];
  ariaLabel?: string;
}) {
  const W = 720;
  const H = 360;
  // The bottom margin is the face rail: 34px of portrait plus the name under it.
  const M = { top: 26, right: 16, bottom: 74, left: 40 };
  const FACE = 30;

  const scoring = rows
    .filter((r) => !r.onBench)
    .map((r) => ({
      el: r.element,
      name: r.webName,
      pts: r.livePoints,
      teamId: r.teamId,
      captain: r.isCaptain && r.multiplier >= 2,
      photo: r.photo,
    }))
    .sort((a, b) => b.pts - a.pts);

  const total = scoring.reduce((s, r) => s + r.pts, 0);
  let running = 0;

  if (scoring.length === 0) {
    return (
      <ChartFrame eyebrow="Attribution" title="Where your points come from" ariaLabel={ariaLabel}>
        <ChartEmpty>Nobody has scored yet.</ChartEmpty>
      </ChartFrame>
    );
  }
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
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
            <text x={M.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" className="fill-(--ink-lo) num-tabular">
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
              {/* the point value rides centred in the bar (above it when thin) */}
              {height >= 20 ? (
                <text
                  x={cx} y={top + height / 2 + 6}
                  textAnchor="middle" fontSize="16" fontWeight="800"
                  fill="var(--on-accent)" opacity={0.97}
                  style={{ fontVariationSettings: '"wdth" 110' }}
                >
                  {b.pts}
                </text>
              ) : (
                <text
                  x={cx} y={top - 6}
                  textAnchor="middle" fontSize="14" fontWeight="800"
                  className="fill-(--ink-hi)"
                >
                  {b.pts}
                </text>
              )}
              {b.captain && (
                <text x={cx} y={top - 14} textAnchor="middle" fontSize="11" className="fill-(--volt)" fontWeight="800">
                  C
                </text>
              )}
            </g>
          );
        })}

        {/* the total — volt identity mark with its value centred inside */}
        <rect
          x={x("total")} y={y(running)} width={bw} height={Math.max(2, y(0) - y(running))}
          rx="3" fill="var(--volt)"
        />
        <text
          x={(x("total") ?? 0) + bw / 2} y={(y(running) + y(0)) / 2 + 5}
          textAnchor="middle" fontSize="19" fontWeight="800"
          className="fill-(--on-accent)"
          style={{ fontVariationSettings: '"wdth" 110' }}
        >
          {Math.round(running)}
        </text>

        {/* the face rail — recognised, not read, with the name upright below */}
        <defs>
          <clipPath id="wf-face">
            <rect x="0" y="0" width={FACE} height={FACE} rx="5" />
          </clipPath>
        </defs>
        {bars.map((b) => {
          const cx = (x(String(b.el)) ?? 0) + bw / 2;
          const fx = cx - FACE / 2;
          const fy = H - M.bottom + 8;
          const club = clubOf(b.teamId);
          return (
            <g key={`f${b.el}`}>
              {/* The club colour sits under the portrait, so a photo that
                  never loads leaves an identifiable tile rather than a hole. */}
              <rect x={fx} y={fy} width={FACE} height={FACE} rx="5" fill={club.rail} opacity="0.9" />
              <text
                x={cx} y={fy + FACE / 2 + 4} textAnchor="middle" fontSize="10" fontWeight="800"
                fill={club.lightInk ? "var(--ink-fixed-dark)" : "var(--ink-on-dark)"}
                opacity="0.9"
              >
                {club.code}
              </text>
              {b.photo && (
                <image
                  href={playerImg(b.photo)}
                  x={fx} y={fy} width={FACE} height={FACE}
                  clipPath="url(#wf-face)"
                  preserveAspectRatio="xMidYMin slice"
                />
              )}
              <rect
                x={fx} y={fy} width={FACE} height={FACE} rx="5"
                fill="none" stroke={b.captain ? "var(--volt)" : club.rail}
                strokeWidth={b.captain ? 2 : 1}
              />
              <text
                x={cx} y={fy + FACE + 12}
                textAnchor="middle" fontSize="10" className="fill-(--ink-mid)"
              >
                {b.name.length > 9 ? `${b.name.slice(0, 8)}…` : b.name}
              </text>
            </g>
          );
        })}
        <text
          x={(x("total") ?? 0) + bw / 2} y={H - M.bottom + 26}
          textAnchor="middle" fontSize="10" letterSpacing="1.5" className="fill-(--ink-lo)"
        >
          TOTAL
        </text>
      </svg>
    </ChartFrame>
  );
}
