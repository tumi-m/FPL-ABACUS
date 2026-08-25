"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { Est } from "@/components/gaffer/Est";
import { PlayerAvatar, useAvatarMode } from "@/components/gaffer/PlayerAvatar";
import { POS_LABEL, priceOutlook, type PlannerPlayer } from "@/lib/engines/planner";
import type { PlannerClub } from "@/lib/engines/planner";

const PAGE = 15;
const METHOD =
  "Net transfers this gameweek against the ~180k net moves a price change typically takes. FPL never publishes the real threshold, so this is a modelled estimate, not a promise.";

type Lens = "rises" | "falls" | "mine";

/**
 * Price watch — who is closest to a rise or a fall tonight.
 *
 * The figure is deliberately labelled as an estimate: FPL keeps the real
 * threshold private, so this reads the public net-transfer traffic against a
 * modelled one. A player whose price already moved this gameweek is called
 * out, because a second move in the same week is rare.
 */
export function PriceWatch({
  players,
  clubs,
  ownedIds,
}: {
  players: PlannerPlayer[];
  clubs: PlannerClub[];
  ownedIds: Set<number>;
}) {
  const [lens, setLens] = React.useState<Lens>("rises");
  const [search, setSearch] = React.useState("");
  const [pos, setPos] = React.useState<number | null>(null);
  const [team, setTeam] = React.useState<number | null>(null);
  const [shown, setShown] = React.useState(PAGE);
  const [avatar] = useAvatarMode();

  React.useEffect(() => setShown(PAGE), [lens, search, pos, team]);

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const scored = players
      .filter((p) => (pos == null || p.pos === pos))
      .filter((p) => (team == null || p.team === team))
      .filter((p) => (lens === "mine" ? ownedIds.has(p.id) : true))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      .map((p) => ({ p, o: priceOutlook(p) }));
    if (lens === "falls") {
      return scored.filter((r) => r.o.progress < 0).sort((a, b) => a.o.progress - b.o.progress);
    }
    if (lens === "mine") {
      return scored.sort((a, b) => Math.abs(b.o.progress) - Math.abs(a.o.progress));
    }
    return scored.filter((r) => r.o.progress > 0).sort((a, b) => b.o.progress - a.o.progress);
  }, [players, lens, search, pos, team, ownedIds]);

  const movedToday = React.useMemo(
    () => ({
      rises: players.filter((p) => p.costChangeEvent > 0).length,
      falls: players.filter((p) => p.costChangeEvent < 0).length,
    }),
    [players],
  );

  const visible = rows.slice(0, shown);

  return (
    <section aria-label="Price watch" className="space-y-3 rounded-lg bg-raised card-ring p-3 md:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="fig-num text-lg leading-none text-ink-hi">Price watch</h2>
          <p className="mt-1 text-2xs text-ink-lo">
            Modelled from live transfer traffic — every figure is an estimate
          </p>
        </div>
        <dl className="flex gap-4">
          <div>
            <dt className="upper-label text-2xs text-ink-lo">Rises this GW</dt>
            <dd className="fig-num text-lg leading-none text-surge">{movedToday.rises}</dd>
          </div>
          <div>
            <dt className="upper-label text-2xs text-ink-lo">Falls this GW</dt>
            <dd className="fig-num text-lg leading-none text-flare">{movedToday.falls}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap gap-2">
        <div role="group" aria-label="Price direction" className="flex gap-1 rounded-md card-ring p-1">
          {(
            [
              { key: "rises", label: "Rising" },
              { key: "falls", label: "Falling" },
              { key: "mine", label: "My squad" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={lens === t.key}
              onClick={() => setLens(t.key)}
              className={cn(
                "skewed rounded-sm px-3 py-1.5 text-2xs uppercase-label transition-colors dur-instant",
                lens === t.key ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
              )}
            >
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div role="group" aria-label="Position filter" className="flex gap-1 rounded-md card-ring p-1">
          {[null, 1, 2, 3, 4].map((k) => (
            <button
              key={k ?? "all"}
              type="button"
              aria-pressed={pos === k}
              onClick={() => setPos(k)}
              className={cn(
                "skewed rounded-sm px-2.5 py-1.5 text-2xs uppercase-label transition-colors dur-instant",
                pos === k ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
              )}
            >
              <span>{k == null ? "All" : POS_LABEL[k]}</span>
            </button>
          ))}
        </div>
        <label className="min-w-[150px]">
          <span className="sr-only">Filter by club</span>
          <select
            value={team ?? ""}
            onChange={(e) => setTeam(e.target.value === "" ? null : Number(e.target.value))}
            className="h-11 w-full rounded-md bg-sunk card-ring px-2 text-xs text-ink-hi focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
          >
            <option value="">All clubs</option>
            {[...clubs]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label className="min-w-[180px] flex-1">
          <span className="sr-only">Search price watch</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a player"
            className="h-11 w-full rounded-md bg-sunk card-ring px-3 text-sm text-ink-hi placeholder:text-ink-lo focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-lo">
          {lens === "mine"
            ? "None of your fifteen are near a move right now."
            : "No player is moving that way at the moment."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse text-xs num-tabular">
            <thead>
              <tr className="border-b border-hairline text-left">
                <th className="py-2 pr-2 text-2xs font-semibold uppercase tracking-wide text-ink-3">
                  Player
                </th>
                <th className="w-24 px-2 py-2 text-right text-2xs font-semibold uppercase tracking-wide text-ink-3">
                  Price
                </th>
                <th className="w-40 px-2 py-2 text-2xs font-semibold uppercase tracking-wide text-ink-3">
                  Outlook
                </th>
                <th className="w-40 py-2 pl-2 text-2xs font-semibold uppercase tracking-wide text-ink-3">
                  Progress
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ p, o }) => {
                const pct = Math.round(Math.abs(o.progress) * 100);
                const tone = o.direction === "up" ? "var(--surge)" : o.direction === "down" ? "var(--flare)" : "var(--line-hi)";
                return (
                  <tr key={p.id} className="border-b border-hairline last:border-0">
                    <td className="py-1.5 pr-2">
                      <span className="flex items-center gap-2">
                        <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-sm bg-surface-2">
                          <PlayerAvatar photo={p.photo} teamId={p.team} mode={avatar} className="h-8 w-8 object-cover object-top" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-ink-hi">{p.name}</span>
                          <span className="block truncate text-[10px] leading-tight text-ink-lo">
                            {p.code} · {POS_LABEL[p.pos]} · {(p.netTransfers >= 0 ? "+" : "−") +
                              Math.abs(p.netTransfers).toLocaleString("en-GB")} net
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-ink-mid">
                      £{(p.cost / 10).toFixed(1)}
                      {p.costChangeStart !== 0 && (
                        <span
                          className={cn("ml-1 text-[10px]", p.costChangeStart > 0 ? "text-surge" : "text-flare")}
                          title="Moved since the season opened"
                        >
                          {p.costChangeStart > 0 ? "▲" : "▼"}
                          {Math.abs(p.costChangeStart / 10).toFixed(1)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={cn(
                          "skewed inline-block rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          o.movedThisGw && "opacity-70",
                        )}
                        style={{ background: `color-mix(in oklab, ${tone} 18%, transparent)`, color: tone }}
                      >
                        <span>{o.label}</span>
                      </span>
                    </td>
                    <td className="py-1.5 pl-2">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="block h-1.5 w-16 overflow-hidden rounded-full bg-sunk"
                        >
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.min(100, pct)}%`, background: tone }}
                          />
                        </span>
                        <Est method={METHOD}>{`${pct}%`}</Est>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > visible.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="inline-flex h-11 w-full items-center justify-center rounded-md card-ring text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
        >
          Show {Math.min(PAGE, rows.length - visible.length)} more
        </button>
      )}

      <p className="text-2xs leading-relaxed text-ink-lo">
        FPL keeps its real price algorithm private. This reads the public net-transfer traffic
        against a modelled threshold, so treat it as a lean, not a guarantee — and remember a player
        who already moved this gameweek rarely moves twice.
      </p>
    </section>
  );
}
