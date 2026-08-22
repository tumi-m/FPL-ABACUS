"use client";

import * as React from "react";
import { ChartFrame, type ChartTable } from "@/components/charts/ChartFrame";

export interface HeatCell {
  /** 1 (hard) … 6 (easy) — maps straight onto the fixture heat ramp. */
  value: number;
  text: string;
  title?: string;
}
export interface HeatRow {
  label: string;
  cells: HeatCell[];
}

const HEAT_TOKENS = [
  "var(--heat-1)",
  "var(--heat-2)",
  "var(--heat-3)",
  "var(--heat-4)",
  "var(--heat-5)",
  "var(--heat-6)",
] as const;

/** Ink per heat step: steps 1–3 are deep blues, 4–6 light teals/greens. */
const HEAT_INK = ["dark", "dark", "dark", "light", "light", "light"] as const;

/** FDR-style heat grid — the fixture heat ramp, blue→green, never red→green. */
export function HeatGrid({ rows, ariaLabel }: { rows: HeatRow[]; ariaLabel: string }) {
  const table: ChartTable = {
    headers: ["Team", ...rows[0]?.cells.map((_, i) => `GW${i + 1}`) ?? []],
    rows: rows.map((r) => [r.label, ...r.cells.map((c) => c.text)]),
  };

  return (
    <ChartFrame eyebrow="Fixtures" title="Difficulty ticker" ariaLabel={ariaLabel} table={table}>
      <div className="overflow-x-auto">
        <table role="img" className="w-full min-w-[480px] border-separate" style={{ borderSpacing: 2 }}>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="pr-2 text-right text-xs font-medium text-ink-2 whitespace-nowrap">{row.label}</td>
                {row.cells.map((cell, i) => {
                  const idx = Math.min(5, Math.max(0, Math.round(cell.value) - 1));
                  const bg = HEAT_TOKENS[idx];
                  return (
                    <td
                      key={i}
                      title={cell.title ?? `${row.label} GW${i + 1}: ${cell.text}`}
                      className="h-8 min-w-[36px] rounded-[6px] text-center text-xs fig-num"
                      style={{ background: bg, color: HEAT_INK[idx] === "dark" ? "var(--ink-on-dark)" : "var(--ink-fixed-dark)" }}
                    >
                      {cell.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  );
}
