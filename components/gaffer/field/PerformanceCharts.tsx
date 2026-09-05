"use client";

/**
 * The over/underperformance visuals.
 *
 * Two questions, two shapes. "Who is beating their chances?" is a comparison
 * between two numbers per player, which is a scatter against the parity line.
 * "By how much?" is a single signed number per player, which is a diverging
 * bar. Anything else here would be decoration.
 */

import * as React from "react";
import { ChartFrame, ChartEmpty } from "@/components/charts/ChartFrame";
import { Est } from "@/components/gaffer/Est";
import { POS_LABEL } from "@/lib/engines/planner";
import { sampleWeight, verdict, type Delta, type PerfPlayer } from "@/lib/engines/performance";

const SHRINK_METHOD =
  "Actual minus expected over the season, shrunk toward zero by minutes played (half-weight at 900 minutes) so a hot cameo cannot top the board.";

export interface DeltaRow {
  player: PerfPlayer;
  delta: Delta;
  label: string;
}

const toneOf = (index: number) =>
  verdict(index) === "over" ? "var(--surge)" : verdict(index) === "under" ? "var(--flare)" : "var(--line-hi)";

/* ────────────────────────────────────────────────────────────────────────────
   Scatter — actual against expected, with the parity line
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Everyone plotted against the line where actual equals expected.
 *
 * Above the line is a player converting more than the chances were worth;
 * below it is one leaving them behind. Distance from the line is the story,
 * so the axes share a scale and the line is drawn at 45°.
 */
export function ActualVsExpectedScatter({
  rows,
  xLabel,
  yLabel,
  title,
  onSelect,
}: {
  rows: DeltaRow[];
  xLabel: string;
  yLabel: string;
  title: string;
  onSelect?: (element: number) => void;
}) {
  const W = 560;
  const H = 340;
  const M = { top: 16, right: 18, bottom: 40, left: 48 };

  if (rows.length === 0) {
    return (
      <ChartFrame eyebrow="Engineered" title={title} ariaLabel={title}>
        <ChartEmpty>Nobody clears the minutes filter yet.</ChartEmpty>
      </ChartFrame>
    );
  }

  // One shared scale, so the parity line really is 45° and distance from it
  // means the same in both directions.
  const hi = Math.max(1, ...rows.map((r) => Math.max(r.delta.actual, r.delta.expected))) * 1.08;
  const sx = (v: number) => M.left + ((W - M.left - M.right) * v) / hi;
  const sy = (v: number) => H - M.bottom - ((H - M.top - M.bottom) * v) / hi;

  const ticks = niceTicks(hi, 4);
  const named = [...rows].sort((a, b) => Math.abs(b.delta.index) - Math.abs(a.delta.index)).slice(0, 6);
  const namedIds = new Set(named.map((r) => r.player.id));

  const table = {
    headers: ["Player", xLabel, yLabel, "Gap"],
    rows: rows
      .slice()
      .sort((a, b) => b.delta.index - a.delta.index)
      .map((r) => [r.player.name, r.delta.expected, r.delta.actual, r.delta.raw]) as (string | number)[][],
  };

  return (
    <ChartFrame
      eyebrow="Engineered"
      title={title}
      ariaLabel={`${yLabel} against ${xLabel} for every qualifying player`}
      caption="On the line is a player doing exactly what his chances were worth. Above it he is converting more, below it fewer."
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} y1={M.top} x2={sx(t)} y2={H - M.bottom} stroke="var(--grid)" strokeWidth="0.5" />
            <line x1={M.left} y1={sy(t)} x2={W - M.right} y2={sy(t)} stroke="var(--grid)" strokeWidth="0.5" />
            <text x={sx(t)} y={H - M.bottom + 14} textAnchor="middle" fontSize="9" className="fill-(--ink-lo)">
              {t}
            </text>
            <text x={M.left - 6} y={sy(t) + 3} textAnchor="end" fontSize="9" className="fill-(--ink-lo)">
              {t}
            </text>
          </g>
        ))}

        {/* parity */}
        <line
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(hi)}
          y2={sy(hi)}
          stroke="var(--ink-lo)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <text x={sx(hi) - 6} y={sy(hi) + 14} textAnchor="end" fontSize="9" className="fill-(--ink-lo)">
          exactly as expected
        </text>

        {rows.map((r) => {
          const cx = sx(r.delta.expected);
          const cy = sy(r.delta.actual);
          // Confidence shows as size: more minutes, bigger mark.
          const rad = 3 + sampleWeight(r.player.minutes) * 4;
          return (
            <circle
              key={r.player.id}
              cx={cx}
              cy={cy}
              r={rad}
              fill={toneOf(r.delta.index)}
              opacity={namedIds.has(r.player.id) ? 0.95 : 0.5}
              stroke="var(--bg-raised)"
              strokeWidth="1"
              style={onSelect ? { cursor: "pointer" } : undefined}
              onClick={onSelect ? () => onSelect(r.player.id) : undefined}
            >
              <title>{`${r.player.name} (${POS_LABEL[r.player.pos]}, ${r.player.code}) — ${r.delta.actual} actual vs ${r.delta.expected} expected`}</title>
            </circle>
          );
        })}

        {/* only the extremes get a name, or the plot becomes a word cloud */}
        {named.map((r) => (
          <text
            key={`l-${r.player.id}`}
            x={sx(r.delta.expected) + 8}
            y={sy(r.delta.actual) - 6}
            fontSize="9"
            className="fill-(--ink-hi)"
          >
            {r.player.name}
          </text>
        ))}

        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
          {xLabel}
        </text>
        <text
          x={-(H / 2)}
          y={13}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize="10"
          className="fill-(--ink-lo)"
        >
          {yLabel}
        </text>
      </svg>
    </ChartFrame>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Diverging bars — the gap itself, ranked
   ──────────────────────────────────────────────────────────────────────────── */

/** The biggest over- and underperformers, largest gap first. */
export function DeltaBars({
  rows,
  title,
  eyebrow = "Over / under",
  limit = 12,
  onSelect,
}: {
  rows: DeltaRow[];
  title: string;
  eyebrow?: string;
  limit?: number;
  onSelect?: (element: number) => void;
}) {
  const ranked = React.useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.delta.index - a.delta.index);
    const half = Math.max(1, Math.floor(limit / 2));
    const top = sorted.slice(0, half);
    const bottom = sorted.slice(-half).filter((r) => !top.includes(r));
    return [...top, ...bottom];
  }, [rows, limit]);

  if (ranked.length === 0) {
    return (
      <ChartFrame eyebrow={eyebrow} title={title} ariaLabel={title}>
        <ChartEmpty>Nobody clears the minutes filter yet.</ChartEmpty>
      </ChartFrame>
    );
  }

  const W = 560;
  const rowH = 24;
  const H = ranked.length * rowH + 44;
  const M = { top: 12, right: 44, bottom: 26, left: 116 };
  const span = Math.max(0.5, ...ranked.map((r) => Math.abs(r.delta.index)));
  const half = (W - M.left - M.right) / 2;
  const mid = M.left + half;

  const table = {
    headers: ["Player", "Actual", "Expected", "Shrunk gap"],
    rows: ranked.map((r) => [r.player.name, r.delta.actual, r.delta.expected, r.delta.index]) as (
      | string
      | number
    )[][],
  };

  return (
    <ChartFrame
      eyebrow={eyebrow}
      title={title}
      ariaLabel={title}
      caption="Bars are the gap after shrinking for minutes played — a short season pulls a player back toward the line."
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={mid} y1={M.top - 2} x2={mid} y2={H - M.bottom} stroke="var(--axis)" strokeWidth="1" />
        {ranked.map((r, i) => {
          const y = M.top + i * rowH;
          const w = (half * Math.abs(r.delta.index)) / span;
          const over = r.delta.index >= 0;
          return (
            <g
              key={r.player.id}
              style={onSelect ? { cursor: "pointer" } : undefined}
              onClick={onSelect ? () => onSelect(r.player.id) : undefined}
            >
              <text x={M.left - 10} y={y + 15} textAnchor="end" fontSize="10" className="fill-(--ink-mid)">
                {r.player.name}
                <tspan className="fill-(--ink-lo)"> {r.player.code}</tspan>
              </text>
              <rect
                x={over ? mid : mid - w}
                y={y + 4}
                width={Math.max(2, w)}
                height={15}
                rx="3"
                fill={toneOf(r.delta.index)}
              >
                <title>{`${r.player.name}: ${r.delta.actual} against ${r.delta.expected} expected`}</title>
              </rect>
              <text
                x={over ? mid + Math.max(2, w) + 6 : mid - Math.max(2, w) - 6}
                y={y + 16}
                textAnchor={over ? "start" : "end"}
                fontSize="10"
                fontWeight="700"
                className="fill-(--ink-hi)"
              >
                {over ? "+" : "−"}
                {Math.abs(r.delta.index).toFixed(1)}
              </text>
            </g>
          );
        })}
        <text x={M.left - 10} y={H - 8} textAnchor="end" fontSize="10" className="fill-(--flare)">
          leaving chances behind
        </text>
        <text x={mid + 8} y={H - 8} fontSize="10" className="fill-(--surge)">
          beating the chances
        </text>
      </svg>
      <p className="mt-2 text-2xs text-ink-lo">
        Shown as <Est method={SHRINK_METHOD}>a shrunk gap</Est> so minutes are respected.
      </p>
    </ChartFrame>
  );
}

/** Pretty axis ticks that land on round numbers. */
function niceTicks(hi: number, count: number): number[] {
  const step = Math.max(1, Math.ceil(hi / count));
  const out: number[] = [];
  for (let v = 0; v <= hi; v += step) out.push(Math.round(v * 10) / 10);
  return out;
}
