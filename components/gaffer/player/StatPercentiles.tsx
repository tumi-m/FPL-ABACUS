"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { bandOf, type PercentileRead, type StatRow } from "@/lib/engines/playerPercentiles";

/**
 * Every figure against the players it should be judged beside.
 *
 * A bar here is a percentile within the player's own position, not a share of
 * some maximum — which is the only reading that makes "0.21 xA" mean anything,
 * since that is a fine number for a centre-half and a thin one for a
 * playmaker.
 *
 * The percentile is printed on every row as well as drawn. That is not
 * decoration: the four band colours are a status palette, and a status palette
 * has to carry a label rather than lean on hue alone — the amber and red steps
 * sit at ΔE 7.9 for a deuteranope, which is legible only with the number
 * beside them.
 */

const BAND_FILL: Record<string, string> = {
  elite: "var(--surge)",
  strong: "var(--volt)",
  average: "var(--amber)",
  poor: "var(--flare)",
};

const BAND_TEXT: Record<string, string> = {
  elite: "text-surge",
  strong: "text-volt",
  average: "text-amber",
  poor: "text-flare",
};

const BAND_WORD: Record<string, string> = {
  elite: "top of his position",
  strong: "above the middle",
  average: "around the middle",
  poor: "bottom of his position",
};

/** "Compared with other DEFs" reads like a spreadsheet; this reads like English. */
const POSITION_NOUN: Record<number, string> = {
  1: "goalkeeper",
  2: "defender",
  3: "midfielder",
  4: "forward",
};

export function StatPercentiles({ read, pos }: { read: PercentileRead; pos: number }) {
  const position = POSITION_NOUN[pos] ?? "player";
  const [open, setOpen] = React.useState(false);
  if (read.groups.length === 0) return null;

  const ranked = read.groups[0].rows.some((r) => r.percentile != null);

  return (
    <section aria-label="Compared with his position" className="rounded-lg bg-surface-1 card-ring p-4 md:p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xs font-semibold uppercase tracking-wide text-ink-3">
          Compared with other {position}s
        </h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-pressed={open}
          className="skewed h-7 shrink-0 rounded-sm bg-raised px-2.5 text-2xs uppercase-label text-ink-lo transition-colors dur-instant hover:text-ink-hi"
        >
          <span>{open ? "Bars" : "Table"}</span>
        </button>
      </div>
      <p className="mb-3 text-2xs leading-relaxed text-ink-lo">
        {ranked ? (
          <>
            Each bar is where he ranks among the {read.cohortSize} {position}s with at least{" "}
            {read.minMinutes} minutes. Per 90 unless the row says otherwise.
          </>
        ) : (
          <>
            Too few {position}s have played enough for a ranking to mean anything yet, so the
            figures are shown without one.
          </>
        )}
      </p>

      {open ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm num-tabular">
            <thead>
              <tr className="border-b border-hairline text-left text-2xs uppercase tracking-wide text-ink-3">
                <th className="py-1.5 pr-2 font-semibold">Stat</th>
                <th className="py-1.5 px-2 text-right font-semibold">Value</th>
                <th className="py-1.5 pl-2 text-right font-semibold">Percentile</th>
              </tr>
            </thead>
            <tbody>
              {read.groups.flatMap((g) => g.rows).map((r) => (
                <tr key={r.key} className="border-b border-hairline last:border-0">
                  <td className="py-1.5 pr-2 text-ink-2">{r.label}</td>
                  <td className="px-2 text-right text-ink-1">{r.display}</td>
                  <td className="pl-2 text-right text-ink-3">
                    {r.percentile == null ? "—" : `${r.percentile}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {read.groups.map((g) => (
            <div key={g.title}>
              <h3 className="mb-1.5 upper-label text-2xs text-ink-lo">{g.title}</h3>
              <ul className="space-y-1">
                {g.rows.map((r) => (
                  <Row key={r.key} row={r} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Row({ row }: { row: StatRow }) {
  const band = row.percentile == null ? null : bandOf(row.percentile);
  return (
    <li
      className="flex items-center gap-2 rounded-sm px-1 py-1 odd:bg-surface-2/40"
      title={
        row.hint +
        (row.percentile != null && band
          ? ` — ${row.percentile}th percentile, ${BAND_WORD[band]}`
          : "")
      }
    >
      <span className="min-w-0 flex-1 truncate text-xs text-ink-2">{row.label}</span>
      <span className="w-12 shrink-0 text-right text-xs font-semibold text-ink-hi num-tabular">
        {row.display}
      </span>
      {/* the track is recessive; the fill is the only saturated thing in the row */}
      <span className="relative h-2 w-[42%] shrink-0 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        {row.percentile != null && (
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${Math.max(2, row.percentile)}%`, background: BAND_FILL[bandOf(row.percentile)] }}
          />
        )}
      </span>
      <span
        className={cn(
          "w-7 shrink-0 text-right text-[10px] font-semibold num-tabular",
          band ? BAND_TEXT[band] : "text-ink-lo",
        )}
      >
        {row.percentile == null ? "—" : row.percentile}
      </span>
    </li>
  );
}
