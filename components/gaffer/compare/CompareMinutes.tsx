"use client";

import * as React from "react";
import { Est } from "@/components/gaffer/Est";
import { MINUTES_METHOD, MINUTES_THIN_LABEL } from "@/lib/engines/minutes";

interface MinutesRow {
  id: number;
  pStart: number | null;
  p60: number | null;
  reliable: boolean;
  note: string;
}

/**
 * Minutes certainty for the compared players (v10 D2) — the same batched
 * fetch the peek sheet and the planner suggestions make, one call for the
 * ids on the table. A projection is worth nothing on a player who does not
 * start, so the xPts chart above reads with this row beside it.
 */
export function CompareMinutes({ ids, names }: { ids: number[]; names: Map<number, string> }) {
  // The csv string is the dep, not the array — same ids in any order
  // re-render without refetching, changed ids refetch.
  const key = ids.join(",");
  const [rows, setRows] = React.useState<Map<number, MinutesRow> | null>(null);

  React.useEffect(() => {
    const list = key
      .split(",")
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (list.length === 0) return;
    let alive = true;
    setRows(null);
    fetch(`/api/gaffer/minutes?players=${key}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { players: MinutesRow[] }) => {
        if (!alive) return;
        setRows(new Map(data.players.map((p) => [p.id, p])));
      })
      .catch(() => {
        if (alive) setRows(new Map());
      });
    return () => {
      alive = false;
    };
  }, [key]);

  return (
    <section aria-label="Minutes certainty" className="overflow-x-auto rounded-lg bg-surface-1 card-ring p-4 md:p-5">
      <h2 className="mb-1 text-2xs font-semibold uppercase tracking-wide text-ink-3">Will they start?</h2>
      <table className="w-full min-w-[560px] text-sm num-tabular">
        <thead>
          <tr className="border-b border-hairline text-left text-2xs uppercase tracking-wide text-ink-3">
            <th className="py-1.5 pr-2 font-semibold">Player</th>
            <th className="px-2 py-1.5 text-right font-semibold">P(start)</th>
            <th className="py-1.5 pl-2 text-right font-semibold">P(60+)</th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const r = rows?.get(id);
            const speaks = r != null && r.reliable && r.pStart != null;
            return (
              <tr key={id} className="border-b border-hairline last:border-0">
                <td className="py-2 pr-2 text-xs font-medium text-ink-hi">{names.get(id) ?? `#${id}`}</td>
                {r == null ? (
                  <td colSpan={2} className="px-2 py-2 text-right text-xs text-ink-lo">
                    Reading history…
                  </td>
                ) : speaks ? (
                  <>
                    <td className="px-2 py-2 text-right text-xs text-ink-hi">
                      <Est method={MINUTES_METHOD}>{`${Math.round(r.pStart! * 100)}%`}</Est>
                    </td>
                    <td className="py-2 pl-2 text-right text-xs text-ink-mid">
                      {r.p60 != null ? (
                        <Est method={`${MINUTES_METHOD} Conditioned on starting.`}>{`${Math.round(r.p60 * 100)}%`}</Est>
                      ) : (
                        "—"
                      )}
                    </td>
                  </>
                ) : (
                  <td colSpan={2} className="px-2 py-2 text-right text-xs text-ink-lo">
                    — {MINUTES_THIN_LABEL} · {r.note}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
