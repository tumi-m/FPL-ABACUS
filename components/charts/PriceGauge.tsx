"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { area, curveMonotoneX } from "d3-shape";
import { ChartFrame, type ChartTable } from "@/components/charts/ChartFrame";

/**
 * PriceGauge — UI doc §6. Semi-circular pressure gauge to ~220k with today's
 * velocity as a 24h sparkline underneath. Price movement lives in amber;
 * the trigger zone burns toward flare. One hero figure: rise probability.
 */
export function PriceGauge({
  playerName,
  netTransfers,
  target = 220_000,
  riseProbability,
  velocity24h,
  ariaLabel,
}: {
  playerName?: string;
  /** Current cumulative transfer pressure. */
  netTransfers: number;
  /** Pressure historically associated with a price rise. */
  target?: number;
  /** Modelled probability of a rise tonight, 0..1 (estimate). */
  riseProbability: number;
  /** Net transfers sampled across the last 24 hours. */
  velocity24h: number[];
  ariaLabel?: string;
}) {
  const W = 560;
  const H = 230;
  const CX = W / 2;
  const CY = H - 52;
  const R = 140;

  const START = (Math.PI / 180) * 210;
  const SWEEP = (Math.PI / 180) * 240;
  const TRIG_T = 0.78;

  const pointAt = (t: number) => {
    const a = START + SWEEP * Math.min(1, Math.max(0, t));
    return [CX + R * Math.cos(a), CY - R * Math.sin(a)] as const;
  };
  const arcPath = (from: number, to: number, radius = R) => {
    const [x1, y1] = pointAt(from);
    const [x2, y2] = pointAt(to);
    const large = SWEEP * (to - from) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };

  const frac = Math.max(0, Math.min(1, netTransfers / target));
  const [needleX, needleY] = pointAt(frac);

  // 24h velocity sparkline
  const VL = { left: 18, right: 18, top: 10, bottom: 14 };
  const V_TOP = CY + 16;
  const V_H = 44;
  const V_BOTTOM = V_TOP + V_H;
  const vx = scaleLinear().domain([0, Math.max(1, velocity24h.length - 1)]).range([VL.left, W - VL.right]);
  const vy = scaleLinear()
    .domain([Math.min(...velocity24h, 0), Math.max(...velocity24h, 1)])
    .range([V_BOTTOM, V_TOP]);
  const vLineGen = area<number>()
    .x((_, i) => vx(i))
    .y1((v) => vy(v))
    .curve(curveMonotoneX);

  const table: ChartTable = {
    headers: ["Measure", "Value"],
    rows: [
      [playerName ?? "Player", "—"],
      ["Net transfers", netTransfers.toLocaleString("en-GB")],
      [`Pressure to rise (~${(target / 1000).toFixed(0)}k)`, `${Math.round(frac * 100)}%`],
      ["Rise probability (est.)", `${Math.round(riseProbability * 100)}%`],
    ],
  };

  return (
    <ChartFrame
      eyebrow="Price"
      title={playerName ? `${playerName} — will he rise tonight?` : "Will he rise tonight?"}
      ariaLabel={ariaLabel ?? `Gauge of transfer pressure toward a price rise with 24-hour velocity sparkline`}
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* track */}
        <path d={arcPath(0, 1)} fill="none" stroke="var(--surface-3)" strokeWidth="12" strokeLinecap="round" />
        {/* trigger zone — amber burns to flare */}
        <path d={arcPath(TRIG_T, 1)} fill="none" stroke="var(--flare)" strokeWidth="12" strokeLinecap="round" opacity="0.55" />
        {/* pressure arc */}
        <path
          d={arcPath(0, Math.max(frac, 0.001))}
          fill="none"
          stroke={frac >= TRIG_T ? "var(--flare)" : "var(--amber)"}
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* target tick */}
        {(() => {
          const a = START + SWEEP * TRIG_T;
          const ix = CX + (R - 14) * Math.cos(a);
          const iy = CY - (R - 14) * Math.sin(a);
          const [tx, ty] = pointAt(TRIG_T);
          return <line x1={ix} y1={iy} x2={tx} y2={ty} stroke="var(--ink-hi)" strokeWidth="2" />;
        })()}
        {/* needle — the single identity mark */}
        <line x1={CX} y1={CY} x2={needleX} y2={needleY} stroke="var(--ink-hi)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="5" fill="var(--bg-raised)" stroke="var(--ink-hi)" strokeWidth="2" />

        {/* hero figure — rise probability */}
        <text
          x={CX} y={CY - 46}
          textAnchor="middle" fontSize="40"
          className="fig-num"
          style={{ fill: frac >= TRIG_T ? "var(--flare)" : "var(--amber)" }}
        >
          {Math.round(riseProbability * 100)}%
        </text>
        <text x={CX} y={CY - 28} textAnchor="middle" fontSize="9" letterSpacing="1.5" className="fill-(--ink-lo)">
          EST. RISE TONIGHT
        </text>

        {/* 24h velocity */}
        <path d={(vLineGen(velocity24h) ?? undefined) as string} fill="none" stroke="var(--amber)" strokeWidth="2" opacity="0.9" />
        <line x1={VL.left} x2={W - VL.right} y1={V_BOTTOM} y2={V_BOTTOM} stroke="var(--grid)" strokeWidth="1" />
        <text x={VL.left} y={V_BOTTOM + 11} fontSize="9" letterSpacing="1.5" className="fill-(--ink-lo)">
          24H VELOCITY · NET TRANSFERS/DAY
        </text>
        <text x={W - VL.right} y={V_BOTTOM + 11} textAnchor="end" fontSize="10" className="fig-num fill-(--ink-mid)">
          {netTransfers.toLocaleString("en-GB")}
        </text>
      </svg>
    </ChartFrame>
  );
}
