"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { line, curveMonotoneX } from "d3-shape";

const W = 96;
const H = 28;

/** 12-point sparkline; history de-emphasised, current period in your slot. */
export function Sparkline({ values, ariaLabel }: { values: number[]; ariaLabel: string }) {
  if (values.length < 2) return <svg width={W} height={H} role="img" aria-label={ariaLabel} />;
  const x = scaleLinear().domain([0, values.length - 1]).range([2, W - 2]);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const y = scaleLinear().domain([lo, hi]).range([H - 4, 4]);

  const gen = line<number>()
    .x((_, i) => x(i))
    .y((v) => y(v))
    .curve(curveMonotoneX);

  const cut = Math.max(1, values.length - 3);
  const hist = values.slice(0, cut + 1);
  const recent = values.slice(cut);

  return (
    <svg width={W} height={H} role="img" aria-label={ariaLabel}>
      <path d={gen(hist) ?? undefined} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} strokeLinecap="round" opacity={0.55} />
      {/* current period — the volt identity mark */}
      <path d={gen(recent.map((v, i) => ({ v, i: i + cut })).map((p) => p.v)) ?? undefined} fill="none" stroke="var(--volt)" strokeWidth={2} strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.5} fill="var(--volt)" />
    </svg>
  );
}
