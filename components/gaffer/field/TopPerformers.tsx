"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { PlayerPhoto } from "@/components/gaffer/PlayerPhoto";
import { clubOf } from "@/config/clubs";

export interface TopRow {
  element: number;
  webName: string;
  pos: number;
  teamId: number;
  photo: string;
  minutes: number;
  /** Metric values for this timeframe. */
  xg: number;
  xa: number;
  xgc: number;
  points: number;
}

export interface TopPerformersData {
  currentGw: number;
  /** This gameweek (live feed) — empty for historical views. */
  gw: TopRow[];
  /** The season so far (bootstrap totals). */
  season: TopRow[];
}

type Metric = "xg" | "xa" | "xgc" | "points";
const METRICS: { id: Metric; label: string; hint: string; asc?: boolean }[] = [
  { id: "xg", label: "xG", hint: "Expected goals" },
  { id: "xa", label: "xA", hint: "Expected assists" },
  { id: "xgc", label: "xGC", hint: "Expected goals conceded — fewest is best for keepers and defenders", asc: true },
  { id: "points", label: "Points", hint: "FPL points" },
];
const POS_SHORT: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

/**
 * Top performers — the market's form board next to the pitch: highest xG, xA
 * and fewest expected concessions, this gameweek or the season so far.
 * Numbers straight from the FPL feed and our shrunk per-90s; no projections.
 */
export function TopPerformers({ data }: { data: TopPerformersData }) {
  const [metric, setMetric] = React.useState<Metric>("xg");
  const [frame, setFrame] = React.useState<"gw" | "season">(data.gw.length > 0 ? "gw" : "season");
  const meta = METRICS.find((m) => m.id === metric)!;
  const rows = React.useMemo(() => {
    const src = frame === "gw" ? data.gw : data.season;
    return [...src]
      .sort((a, b) => (meta.asc ? a[metric] - b[metric] : b[metric] - a[metric]))
      .slice(0, 10);
  }, [data, frame, metric, meta.asc]);

  const fmt = (v: number) => (metric === "points" ? String(v) : v.toFixed(2));

  return (
    <section aria-label="Top performers board" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Metric" className="flex gap-1 rounded-md card-ring p-1">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetric(m.id)}
              aria-pressed={metric === m.id}
              title={m.hint}
              className={cn(
                "skewed rounded-sm px-3 py-1.5 text-xs uppercase-label transition-colors dur-instant",
                metric === m.id ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Timeframe" className="flex gap-1 rounded-md card-ring p-1">
          {(["gw", "season"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrame(f)}
              disabled={f === "gw" && data.gw.length === 0}
              aria-pressed={frame === f}
              className={cn(
                "skewed rounded-sm px-3 py-1.5 text-xs uppercase-label transition-colors dur-instant disabled:cursor-not-allowed disabled:opacity-40",
                frame === f ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
              )}
            >
              {f === "gw" ? `GW${data.currentGw}` : "Season"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-surface-1 card-ring">
        <table className="w-full text-sm num-tabular">
          <thead>
            <tr className="border-b border-hairline text-left text-2xs uppercase tracking-wide text-ink-3">
              <th className="w-10 py-2 pl-3 font-semibold">#</th>
              <th className="py-2 font-semibold">Player</th>
              <th className="hidden py-2 font-semibold sm:table-cell">Club</th>
              <th className="py-2 pr-2 text-right font-semibold">Min</th>
              <th className="py-2 pr-3 text-right font-semibold">{meta.label}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.element} className="border-b border-hairline last:border-0">
                <td className="py-2 pl-3 text-ink-lo">{i + 1}</td>
                <td className="py-2">
                  <span className="flex items-center gap-2.5">
                    <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-sm bg-surface-2">
                      {r.photo ? (
                        <PlayerPhoto photo={r.photo} teamId={r.teamId} className="h-8 w-8 object-cover object-top" />
                      ) : (
                        <span className="grid h-8 w-8 place-items-center text-2xs font-bold text-ink-mid">
                          {r.webName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-hi">{r.webName}</span>
                      <span className="block text-2xs text-ink-lo">{POS_SHORT[r.pos] ?? "?"}</span>
                    </span>
                  </span>
                </td>
                <td className="hidden py-2 text-xs text-ink-mid sm:table-cell">{clubOf(r.teamId).code}</td>
                <td className="py-2 pr-2 text-right text-xs text-ink-mid">{r.minutes}</td>
                <td className={cn("py-2 pr-3 text-right font-bold", meta.asc ? "text-surge" : "text-ink-hi")}>
                  {fmt(r[metric])}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-ink-lo">
                  Nothing to rank yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-2xs leading-relaxed text-ink-lo">
        {meta.hint}
        {frame === "gw" ? " — live gameweek feed." : " — season totals from the FPL feed."}
      </p>
    </section>
  );
}
