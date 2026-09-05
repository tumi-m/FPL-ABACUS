"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";

export interface ChartTable {
  headers: string[];
  rows: (string | number)[][];
}

export function ChartFrame({
  eyebrow,
  title,
  ariaLabel,
  legend,
  table,
  caption,
  children,
  className,
}: {
  eyebrow?: string;
  title?: string;
  ariaLabel: string;
  legend?: React.ReactNode;
  table?: ChartTable;
  caption?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = React.useState(false);

  return (
    <figure className={cn("rounded-lg bg-surface-1 card-lift p-4 md:p-5", className)}>
      {(eyebrow || title || table) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {eyebrow && (
              <div className="upper-label text-2xs text-ink-lo">{eyebrow}</div>
            )}
            {title && <div className="text-sm font-medium text-ink-1">{title}</div>}
          </div>
          {table && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              aria-pressed={showTable}
              className="skewed h-7 shrink-0 rounded-sm bg-raised px-2.5 text-2xs uppercase-label text-ink-lo transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
            >
              <span>{showTable ? "Chart" : "Table"}</span>
            </button>
          )}
        </div>
      )}
      {legend && <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">{legend}</div>}

      {showTable && table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm num-tabular">
            <thead>
              <tr className="border-b border-hairline text-left">
                {table.headers.map((h) => (
                  <th key={h} className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i} className="border-b border-hairline last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-1.5 text-ink-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}

      <figcaption className="sr-only">{caption ?? ariaLabel}</figcaption>
    </figure>
  );
}

export interface LegendItem {
  name: string;
  colorVar: string;
  dashed?: boolean;
}

/**
 * The one empty state every chart renders (v10 D4).
 *
 * Sixteen charts built at different times said "nothing here" sixteen ways
 * — py-8 against py-10, three different wordings for the same minute floor.
 * A chart with no data renders its frame (eyebrow, title, table toggle stay
 * put so the layout does not jump when data arrives) with this inside it.
 */
export function ChartEmpty({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-ink-lo">{children}</p>;
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <>
      {items.map((item) => (
        <span key={item.name} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <span
            aria-hidden
            className="inline-block h-[3px] w-4 rounded-full"
            style={{ background: item.colorVar, opacity: item.dashed ? 0.6 : 1 }}
          />
          {item.name}
        </span>
      ))}
    </>
  );
}
