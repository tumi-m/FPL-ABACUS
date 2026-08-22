"use client";

import * as React from "react";
import { ChartFrame, type ChartTable } from "@/components/charts/ChartFrame";

export interface HeatCell {
  value: number;
  text: string;
  title?: string;
}
export interface HeatRow {
  label: string;
  cells: HeatCell[];
}

const LO = [0xc7, 0xdf, 0xf5];
const HI = [0x14, 0x36, 0x5c];

function ramp(t: number): string {
  const r = Math.round(LO[0] + (HI[0] - LO[0]) * t);
  const g = Math.round(LO[1] + (HI[1] - LO[1]) * t);
  const b = Math.round(LO[2] + (HI[2] - LO[2]) * t);
  return `rgb(${r},${g},${b})`;
}

function cellInk(bg: string): string {
  const [r, g, b] = bg.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
  const lum =
    0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
  return lum > 0.35 ? "var(--ink-1)" : "var(--ink-on-dark)";
}

const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** FDR-style heat grid; sequential single-hue ramp, ink chosen per-cell by luminance. */
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
                  const t = Math.min(1, Math.max(0, (cell.value - 1) / 4));
                  const bg = ramp(t);
                  return (
                    <td
                      key={i}
                      title={cell.title ?? `${row.label} GW${i + 1}: ${cell.text}`}
                      className="h-8 min-w-[36px] rounded-[6px] text-center text-xs font-semibold num-tabular"
                      style={{ background: bg, color: cellInk(bg) }}
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
