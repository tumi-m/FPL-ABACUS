"use client";

import * as React from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { ChartFrame, ChartLegend, type ChartTable } from "@/components/charts/ChartFrame";

export interface DefconMatch {
  /** Short opponent or round label. */
  label: string;
  /** DEFCON events accumulated in that match. */
  defcon: number;
}

/**
 * DefconRate — UI doc §6. Per-match DEFCON columns against the bonus
 * threshold as a dashed lumen rule; hits above it fill cyan, misses sit in
 * --line-hi. Answers "does he actually hit 10?".
 */
export function DefconRate({
  matches,
  threshold = 10,
  playerName,
  ariaLabel,
}: {
  matches: DefconMatch[];
  threshold?: number;
  playerName?: string;
  ariaLabel?: string;
}) {
  const W = 560;
  const H = 260;
  const M = { top: 26, right: 14, bottom: 34, left: 34 };

  const max = Math.max(threshold + 1, ...matches.map((m) => m.defcon)) * 1.12;
  const x = scaleBand<string>()
    .domain(matches.map((m) => m.label))
    .range([M.left, W - M.right])
    .padding(0.28);
  const y = scaleLinear().domain([0, max]).range([H - M.bottom, M.top]);

  const table: ChartTable = {
    headers: ["Match", "DEFCON", `vs ${threshold}`],
    rows: matches.map((m) => [
      m.label,
      m.defcon,
      m.defcon >= threshold ? "bonus hit" : `−${threshold - m.defcon}`,
    ]),
  };

  return (
    <ChartFrame
      eyebrow="Defcon"
      title={playerName ? `${playerName} — does he actually hit ${threshold}?` : `Does he actually hit ${threshold}?`}
      ariaLabel={ariaLabel ?? `Column chart of DEFCON events per match against the ${threshold}-point bonus threshold`}
      table={table}
      legend={
        <ChartLegend
          items={[
            { name: "Threshold met", colorVar: "var(--seq-550)" },
            { name: "Below threshold", colorVar: "var(--line-hi)" },
          ]}
        />
      }
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* lumen threshold rule */}
        <line
          x1={M.left} x2={W - M.right} y1={y(threshold)} y2={y(threshold)}
          stroke="var(--ice)" strokeWidth="1.5" strokeDasharray="5 5"
        />
        <text
          x={W - M.right} y={y(threshold) - 7} textAnchor="end"
          fontSize="10" letterSpacing="1.5" className="fill-(--ice)"
        >
          BONUS THRESHOLD {threshold}
        </text>

        {y.ticks(4).filter((t) => t > 0 && t < threshold).map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
            <text x={M.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">
              {t}
            </text>
          </g>
        ))}

        {matches.map((m) => {
          const hit = m.defcon >= threshold;
          const top = y(Math.max(m.defcon, 0));
          return (
            <g key={m.label}>
              <rect
                x={x(m.label)} y={top} width={x.bandwidth()}
                height={Math.max(2, H - M.bottom - top)}
                rx="3" fill={hit ? "var(--seq-550)" : "var(--line-hi)"}
                opacity={hit ? 0.95 : 0.75}
              >
                <title>{`${m.label} — ${m.defcon} DEFCON${hit ? ", bonus hit" : ""}`}</title>
              </rect>
              {hit && (
                <text
                  x={(x(m.label) ?? 0) + x.bandwidth() / 2} y={top - 6}
                  textAnchor="middle" fontSize="11" className="fig-num fill-(--ink-hi)"
                >
                  {m.defcon}
                </text>
              )}
              <text
                x={(x(m.label) ?? 0) + x.bandwidth() / 2} y={H - M.bottom + 15}
                textAnchor="middle" fontSize="10" className="fill-(--ink-mid)"
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}
