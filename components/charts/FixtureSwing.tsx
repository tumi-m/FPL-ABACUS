"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { ChartEmpty, ChartFrame, ChartLegend, type ChartTable } from "@/components/charts/ChartFrame";

export interface SwingPoint {
  /** Gameweek number. */
  gw: number;
  /** Opponent expected-goals-conceded per 90 — lower is an easier fixture. */
  xgc: number;
}

/**
 * FixtureSwing — UI doc §6. Slope chart of opponent xGC/90 across the next
 * run; each segment is coloured by direction — easing in surge, hardening in
 * flare. Answers "when do his fixtures turn?".
 */
export function FixtureSwing({
  playerName,
  points,
  leagueMean,
  ariaLabel,
}: {
  playerName?: string;
  points: SwingPoint[];
  /** League-average xGC/90 reference. */
  leagueMean?: number;
  ariaLabel?: string;
}) {
  const W = 560;
  const H = 240;
  const M = { top: 22, right: 52, bottom: 30, left: 44 };

  if (points.length === 0) {
    return (
      <ChartFrame
        eyebrow="Fixtures"
        title={playerName ? `${playerName} — when do the fixtures turn?` : "When do the fixtures turn?"}
        ariaLabel={ariaLabel ?? "Slope chart of opponent xG conceded per 90 across the run, lower is easier"}
      >
        <ChartEmpty>No fixtures scheduled yet.</ChartEmpty>
      </ChartFrame>
    );
  }

  const xs = points.map((p) => p.gw);
  const x = scaleLinear()
    .domain([Math.min(...xs), Math.max(...xs)])
    .range([M.left, W - M.right]);
  const lo = Math.min(...points.map((p) => p.xgc), leagueMean ?? Infinity);
  const hi = Math.max(...points.map((p) => p.xgc), leagueMean ?? -Infinity);
  const pad = (hi - lo) * 0.15 || 0.2;
  const y = scaleLinear().domain([lo - pad, hi + pad]).range([H - M.bottom, M.top]);

  const segments = points.slice(1).map((p, i) => ({
    from: points[i],
    to: p,
    easing: p.xgc < points[i].xgc,
  }));

  const table: ChartTable = {
    headers: ["GW", "Opp xGC/90", "vs prev"],
    rows: points.map((p, i) => [
      p.gw,
      p.xgc.toFixed(2),
      i === 0 ? "—" : `${p.xgc <= points[i - 1].xgc ? "▼" : "▲"} ${Math.abs(p.xgc - points[i - 1].xgc).toFixed(2)}`,
    ]),
  };

  return (
    <ChartFrame
      eyebrow="Fixtures"
      title={playerName ? `${playerName} — when do the fixtures turn?` : "When do the fixtures turn?"}
      ariaLabel={ariaLabel ?? `Slope chart of opponent xG conceded per 90 across gameweeks ${Math.min(...xs)}–${Math.max(...xs)}, lower is easier`}
      table={table}
      legend={
        <ChartLegend
          items={[
            { name: "Easing", colorVar: "var(--surge)" },
            { name: "Hardening", colorVar: "var(--flare)" },
            ...(leagueMean != null ? [{ name: "League mean", colorVar: "var(--line-hi)", dashed: true }] : []),
          ]}
        />
      }
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {leagueMean != null && (
          <>
            <line x1={M.left} x2={W - M.right} y1={y(leagueMean)} y2={y(leagueMean)} stroke="var(--line-hi)" strokeWidth="1" strokeDasharray="4 5" />
            <text x={W - M.right + 4} y={y(leagueMean) + 3} fontSize="9" className="fill-(--ink-lo)">
              mean
            </text>
          </>
        )}

        {/* gridlines + GW axis */}
        {points.map((p) => (
          <g key={p.gw}>
            <line x1={x(p.gw)} x2={x(p.gw)} y1={M.top} y2={H - M.bottom} stroke="var(--grid)" strokeWidth="1" opacity="0.6" />
            <text x={x(p.gw)} y={H - M.bottom + 16} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
              GW{p.gw}
            </text>
          </g>
        ))}
        {[lo, hi].map((t) => (
          <text key={t} x={M.left - 8} y={y(t) + 3} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">
            {t.toFixed(1)}
          </text>
        ))}

        {/* slope segments coloured by direction */}
        {segments.map((s) => (
          <line
            key={`${s.from.gw}-${s.to.gw}`}
            x1={x(s.from.gw)} y1={y(s.from.xgc)}
            x2={x(s.to.gw)} y2={y(s.to.xgc)}
            stroke={s.easing ? "var(--surge)" : "var(--flare)"}
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.9"
          >
            <title>{`GW${s.from.gw}→${s.to.gw}: ${s.from.xgc.toFixed(2)} → ${s.to.xgc.toFixed(2)}`}</title>
          </line>
        ))}

        {/* value dots */}
        {points.map((p) => (
          <circle key={`d${p.gw}`} cx={x(p.gw)} cy={y(p.xgc)} r="4.5" fill="var(--bg-raised)" stroke="var(--ink-mid)" strokeWidth="2">
            <title>{`GW${p.gw} — opp xGC/90 ${p.xgc.toFixed(2)}`}</title>
          </circle>
        ))}

        {/* end label — the figure */}
        <text
          x={x(points[points.length - 1]?.gw ?? 0) + 8}
          y={y(points[points.length - 1]?.xgc ?? 0) + 4}
          fontSize="13"
          className="fig-num fill-(--ink-hi)"
        >
          {(points[points.length - 1]?.xgc ?? 0).toFixed(2)}
        </text>
      </svg>
    </ChartFrame>
  );
}
