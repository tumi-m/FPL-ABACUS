"use client";

import * as React from "react";
import { bandOf } from "@/lib/engines/playerPercentiles";
import type { PlayerRadar as RadarData } from "@/lib/engines/playerRadar";
import { cn } from "@/lib/ui/cn";

/**
 * The card radar — a football game's attribute web, over FPL's own numbers.
 *
 * Every point is a percentile inside the player's own position, which is the
 * only normalisation that makes one axis comparable to another: 0.21 xA and
 * 4.8 DEFCON share no unit and cannot sit on one shape until both are "where
 * he ranks". It also means the shape is read the same way everywhere —
 * outward is better on every spoke, including the ones where a low raw
 * number is the good one.
 *
 * ── Drawn flat
 *
 * The style guide's one rule is that the skew, the gloss and the bevel are
 * for chrome and never for data. So the web is square to the page, the labels
 * are upright, and the only thing that leans is nothing. A radar is the most
 * tempting chart in the app to tilt and it is the one that can least afford
 * it: an area comparison is already hard to read honestly, and rotating it
 * would put the axes at different apparent lengths.
 *
 * ── Series colour, not accent
 *
 * `--series-1`, not `--volt`. Volt means *you*, *live* and *the primary
 * action* everywhere else in the app; borrowing it for a data mark would make
 * a chart look like a button and teach the accent a second meaning.
 *
 * ── Honest about area
 *
 * The polygon's area grows with the square of the radius, so a player 40%
 * better on every axis draws a shape roughly twice as big. That flatters the
 * strong and buries the weak, which is exactly why the percentile is printed
 * beside every label rather than left to the eye.
 */

/*
 * A square viewBox with room for the labels outside the web.
 *
 * The web is 76 from centre and the labels sit at 1.3 of that, so the
 * furthest ink is 99 from a centre at 110 — comfortably inside 220 even with
 * a four-character code anchored outward.
 */
const SIZE = 220;
const CENTRE = SIZE / 2;
const RADIUS = 76;
/** The rings, as fractions of the radius. Quartiles read without a legend. */
const RINGS = [0.25, 0.5, 0.75, 1];

const BAND_STROKE: Record<string, string> = {
  elite: "text-surge",
  strong: "text-volt",
  average: "text-amber",
  poor: "text-flare",
};

/** Polar to cartesian, with 0 at twelve o'clock so the first axis is on top. */
function point(index: number, count: number, fraction: number) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CENTRE + Math.cos(angle) * RADIUS * fraction,
    y: CENTRE + Math.sin(angle) * RADIUS * fraction,
  };
}

function polygon(count: number, fractions: number[]): string {
  return fractions
    .map((f, i) => {
      const p = point(i, count, f);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");
}

export function PlayerRadar({ radar, className }: { radar: RadarData; className?: string }) {
  const n = radar.axes.length;
  const shape = polygon(
    n,
    radar.axes.map((a) => Math.max(0.02, a.percentile / 100)),
  );

  return (
    <div className={cn("flex flex-col items-center gap-3 sm:flex-row sm:items-start", className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={`Attribute web. ${radar.axes
          .map((a) => `${a.label} ${a.percentile} out of 100`)
          .join(". ")}. Ranked against ${radar.cohortSize} players in the same position.`}
        className="shrink-0"
      >
        {/* The web: rings first, then spokes, then the shape on top. */}
        {RINGS.map((r) => (
          <polygon
            key={r}
            points={polygon(n, Array.from({ length: n }, () => r))}
            className="fill-none stroke-line"
            strokeWidth={1}
          />
        ))}
        {radar.axes.map((a, i) => {
          const outer = point(i, n, 1);
          return (
            <line
              key={a.key}
              x1={CENTRE}
              y1={CENTRE}
              x2={outer.x}
              y2={outer.y}
              className="stroke-line"
              strokeWidth={1}
            />
          );
        })}

        <polygon
          points={shape}
          className="fill-series-1/25 stroke-series-1"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {radar.axes.map((a, i) => {
          const p = point(i, n, Math.max(0.02, a.percentile / 100));
          return <circle key={a.key} cx={p.x} cy={p.y} r={2.5} className="fill-series-1" />;
        })}

        {/* Labels sit outside the web, anchored so they never overhang it. */}
        {radar.axes.map((a, i) => {
          const p = point(i, n, 1.28);
          const anchor = p.x > CENTRE + 4 ? "start" : p.x < CENTRE - 4 ? "end" : "middle";
          return (
            <text
              key={a.key}
              x={p.x}
              y={p.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-ink-lo text-[8px] uppercase"
              style={{ letterSpacing: "0.08em" }}
            >
              {a.short}
            </text>
          );
        })}
      </svg>

      {/*
        * The numbers beside the shape, not instead of it.
        *
        * A polygon's area goes with the square of its radius, so the eye
        * over-rewards a good shape and under-reads a poor one. The list is
        * what makes the chart checkable — and it carries the raw figure too,
        * so a percentile can always be traced back to the football.
        */}
      <ul className="w-full min-w-0 space-y-1">
        {radar.axes.map((a) => {
          const band = bandOf(a.percentile);
          return (
            <li key={a.key} className="flex items-baseline gap-2 text-2xs" title={a.hint}>
              <span className="min-w-[5.5rem] text-ink-mid">{a.label}</span>
              <span className={cn("num-tabular font-semibold", BAND_STROKE[band])}>
                {a.percentile}
              </span>
              <span className="ml-auto num-tabular text-ink-lo">{a.display}</span>
            </li>
          );
        })}
        <li className="border-t border-line pt-1.5 text-2xs text-ink-lo">
          Percentile against {radar.cohortSize} in his position · overall{" "}
          <span className="num-tabular text-ink-mid">{radar.overall}</span>
        </li>
      </ul>
    </div>
  );
}
