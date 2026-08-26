"use client";

import * as React from "react";
import { CrestBadge } from "@/components/gaffer/CrestBadge";
import { cn } from "@/lib/ui/cn";
import { spread } from "@/lib/engines/teamStats";
import type { TeamStatRow } from "@/lib/engines/teamStats";

/**
 * One sortable club table, driven by a column spec.
 *
 * Six of these on a page means the table itself has to be the thing that is
 * written once. A spec per column — how to read the row, how to print it, and
 * which of three treatments it gets — keeps each board to a dozen lines and
 * keeps the sorting, the sticky club column and the bar scaling identical
 * across all of them.
 *
 * Three treatments, because a column of numbers is doing one of three jobs:
 *
 *   plain    a count. Nothing behind it.
 *   diverge  a gap between what happened and what was expected. It gets a bar
 *            growing out of the centre — surge for over, flare for under —
 *            scaled to the widest gap in that column, so the shape of the
 *            whole league is readable in one pass without reading a digit.
 *   heat     a magnitude where more is better. A bar growing from the left,
 *            scaled to the column maximum.
 *
 * The club column stays put while the rest scrolls sideways, which is the only
 * way a fifteen-column table works on a phone: a number you cannot attribute
 * to a club is not a number.
 */

export type Tone = "plain" | "diverge" | "heat";

export interface StatColumn {
  key: string;
  label: string;
  /** Long form for the header tooltip and the screen-reader label. */
  title: string;
  read: (r: TeamStatRow) => number;
  format?: (v: number) => string;
  tone?: Tone;
  /** Which column group this sits under, if the table has them. */
  group?: string;
}

const oneDp = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "—");
const whole = (v: number) => (Number.isFinite(v) ? String(Math.round(v)) : "—");
const signed = (v: number) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1));

export const FMT = { oneDp, whole, signed };

export function StatTable({
  eyebrow,
  title,
  blurb,
  rows,
  columns,
  defaultSort,
  /** Clubs you own a player from — marked, never filtered. */
  owned,
  footnote,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  rows: TeamStatRow[];
  columns: StatColumn[];
  defaultSort: string;
  owned?: Set<number>;
  footnote?: string;
}) {
  const [sortKey, setSortKey] = React.useState(defaultSort);
  const [asc, setAsc] = React.useState(false);

  const sorted = React.useMemo(() => {
    const col = columns.find((c) => c.key === sortKey) ?? columns[0];
    return [...rows].sort((a, b) => {
      const d = col.read(a) - col.read(b);
      return (asc ? d : -d) || a.short.localeCompare(b.short);
    });
  }, [rows, columns, sortKey, asc]);

  /**
   * One scale per column across the whole league, computed once rather than
   * per cell — a mark that rescaled row by row would say nothing.
   *
   * The two treatments need different scales. A gap is measured from zero,
   * because zero is where it stops meaning anything, so its bar takes the
   * widest swing either way. A magnitude is measured from the bottom of the
   * league: twenty clubs whose expected goals per match run 6.5 to 11.1 are a
   * real spread, and scaling that from zero paints the whole column one shade
   * and throws the spread away.
   */
  const scales = React.useMemo(() => {
    const m = new Map<string, { max: number; min: number }>();
    for (const c of columns) {
      if (!c.tone || c.tone === "plain") continue;
      const values = rows.map(c.read).filter((v) => Number.isFinite(v));
      m.set(
        c.key,
        c.tone === "diverge"
          ? { max: spread(values), min: 0 }
          : { max: Math.max(...values, 0), min: Math.min(...values, 0) },
      );
    }
    return m;
  }, [rows, columns]);

  const groups = React.useMemo(() => {
    if (!columns.some((c) => c.group)) return null;
    const out: { label: string; span: number }[] = [];
    for (const c of columns) {
      const label = c.group ?? "";
      const last = out[out.length - 1];
      if (last && last.label === label) last.span += 1;
      else out.push({ label, span: 1 });
    }
    return out;
  }, [columns]);

  const toggle = (key: string) => {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
  };

  return (
    <section aria-label={title} className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="upper-label text-2xs text-ink-lo">{eyebrow}</p>
          <h2 className="text-base font-medium tracking-tight text-ink-hi">{title}</h2>
        </div>
        <p className="max-w-[56ch] text-xs leading-relaxed text-ink-lo">{blurb}</p>
      </div>

      <div className="overflow-x-auto rounded-lg bg-surface-1 card-ring">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            {title}. {blurb} Sortable by any column.
          </caption>

          <thead>
            {groups && (
              <tr>
                <th className="sticky left-0 z-20 bg-surface-1" />
                {groups.map((g, i) => (
                  <th
                    key={`${g.label}-${i}`}
                    colSpan={g.span}
                    scope="colgroup"
                    className="border-b border-hairline px-2 pt-2 pb-1 text-center upper-label text-[9px] text-ink-lo"
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 border-b border-hairline bg-surface-1 px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-ink-3"
              >
                Club
              </th>
              {columns.map((c) => {
                const active = c.key === sortKey;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    /* aria-sort belongs to the column header, not to the
                       control inside it — a button has no sort state. */
                    aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
                    className="border-b border-hairline p-0"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      title={c.title}
                      aria-label={`Sort by ${c.title}`}
                      className={cn(
                        "flex w-full items-center justify-end gap-1 whitespace-nowrap px-2 py-2 text-2xs font-semibold uppercase tracking-wide transition-colors dur-instant hover:text-ink-hi",
                        active ? "text-volt" : "text-ink-3",
                      )}
                    >
                      <span>{c.label}</span>
                      <span aria-hidden className="text-[8px] leading-none">
                        {active ? (asc ? "▲" : "▼") : "⇅"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sorted.map((r) => (
              <tr key={r.teamId} className="border-b border-hairline last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface-1 px-3 py-1.5 text-left font-normal"
                >
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <CrestBadge teamId={r.teamId} size={17} />
                    <span className="text-xs font-medium text-ink-hi">{r.short}</span>
                    {owned?.has(r.teamId) && (
                      <span
                        aria-label="you own a player here"
                        title="You own a player from this club"
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-volt"
                      />
                    )}
                  </span>
                </th>
                {columns.map((c) => (
                  <Cell key={c.key} column={c} row={r} scale={scales.get(c.key)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {footnote && <p className="text-2xs leading-relaxed text-ink-lo">{footnote}</p>}
    </section>
  );
}

function Cell({
  column,
  row,
  scale,
}: {
  column: StatColumn;
  row: TeamStatRow;
  scale?: { max: number; min: number };
}) {
  const v = column.read(row);
  const text = (column.format ?? whole)(v);
  const tone = column.tone ?? "plain";

  if (tone === "plain") {
    return (
      <td className="px-2 py-1.5 text-right text-xs text-ink-mid num-tabular">{text}</td>
    );
  }

  /* Two different jobs, two different marks.

     A gap gets a bar from the centre line, because the sign is the point and a
     bar either side of a shared origin is the only shape that shows twenty
     signs at once. It is a band rather than a block: a full-height fill turns
     a dense table into a bar chart with numbers stuck on it.

     A magnitude gets a tint instead, its strength scaled by the value. There
     is no origin to grow from, so a hard-edged bar would only draw an edge
     where the data has none, and a wash reads as heat without competing with
     the figure sitting on it. */
  const max = scale?.max ?? 0;

  if (tone === "heat") {
    const min = scale?.min ?? 0;
    const span = max - min;
    const pct = span > 0 ? Math.min(1, Math.max(0, (v - min) / span)) : 0;
    return (
      <td
        className="px-2 py-1.5 text-right text-xs text-ink-mid num-tabular"
        style={{
          /* a floor, so the bottom of the league is still visibly part of the
             column rather than a hole in it */
          background: `color-mix(in oklab, var(--volt) ${(3 + pct * 25).toFixed(1)}%, transparent)`,
        }}
      >
        {text}
      </td>
    );
  }

  const pct = max > 0 ? Math.min(1, Math.abs(v) / max) : 0;
  const positive = v >= 0;
  return (
    <td className="relative px-2 py-1.5 text-right text-xs num-tabular">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-[7px] w-1/2 rounded-[2px]"
        style={{
          [positive ? "left" : "right"]: "50%",
          background: positive
            ? "color-mix(in oklab, var(--surge) 42%, transparent)"
            : "color-mix(in oklab, var(--flare) 42%, transparent)",
          transform: `scaleX(${pct.toFixed(3)})`,
          transformOrigin: positive ? "left" : "right",
        }}
      />
      <span className="relative text-ink-hi">{text}</span>
    </td>
  );
}
