"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { PlayerPhoto } from "@/components/gaffer/PlayerPhoto";
import {
  POS_LABEL,
  SORTS,
  filterMarket,
  heatCuts,
  heatIndex,
  windowPoints,
  type PlannerPlayer,
  type SortKey,
} from "@/lib/engines/planner";
import type { PlannerClub, PlannerGw, TickerCell } from "@/lib/engines/planner";

const PAGE = 40;
const WINDOWS = [1, 3, 5, 6];
const POS_TABS: { key: number | null; label: string }[] = [
  { key: null, label: "All" },
  { key: 1, label: "GK" },
  { key: 2, label: "DEF" },
  { key: 3, label: "MID" },
  { key: 4, label: "FWD" },
];

/**
 * The market — every selectable player, filtered the way a manager actually
 * shops: by position, by what is left in the bank, by name, by the run ahead.
 *
 * Each row shows the projection gameweek by gameweek so you can see *where*
 * the points come from, not just a total. Rows you cannot legally take are
 * kept on screen and greyed with the reason, never silently dropped.
 */
export function MarketPanel({
  players,
  gws,
  clubs,
  ownedIds,
  budgetTenths,
  outPlayer,
  onPick,
  reasonFor,
  fixtureFor,
}: {
  players: PlannerPlayer[];
  gws: PlannerGw[];
  clubs: PlannerClub[];
  ownedIds: Set<number>;
  /** Sell price of the player on the block plus the bank, in tenths. */
  budgetTenths: number | null;
  outPlayer: PlannerPlayer | null;
  onPick: (id: number) => void;
  reasonFor: (id: number) => string | null;
  fixtureFor: (teamId: number, gw: number) => TickerCell[];
}) {
  const [search, setSearch] = React.useState("");
  const [pos, setPos] = React.useState<number | null>(null);
  const [team, setTeam] = React.useState<number | null>(null);
  const [sort, setSort] = React.useState<SortKey>("projected");
  const [affordable, setAffordable] = React.useState(true);
  const [maxCost, setMaxCost] = React.useState<number>(150);
  const [shown, setShown] = React.useState(PAGE);
  // The market keeps its own horizon: the pitch figure answers "this week",
  // the shortlist answers "over the run", and they are different questions.
  const [weeks, setWeeks] = React.useState(() => Math.min(3, Math.max(1, gws.length)));

  // Choosing who leaves narrows the market to legal replacements on its own —
  // the position filter follows the pick rather than fighting it.
  React.useEffect(() => {
    if (outPlayer) setPos(outPlayer.pos);
    setShown(PAGE);
  }, [outPlayer]);

  React.useEffect(() => setShown(PAGE), [search, pos, team, sort, affordable, maxCost, weeks]);

  const priceCeiling = React.useMemo(
    () => Math.max(...players.map((p) => p.cost), 150),
    [players],
  );

  const rows = React.useMemo(
    () =>
      filterMarket(players, {
        search,
        pos,
        team,
        maxCost: maxCost >= priceCeiling ? null : maxCost,
        affordableWithin: affordable && budgetTenths != null ? budgetTenths : null,
        sort,
        weeks,
        exclude: ownedIds,
      }),
    [players, search, pos, team, maxCost, priceCeiling, affordable, budgetTenths, sort, weeks, ownedIds],
  );

  const visible = rows.slice(0, shown);
  const cuts = React.useMemo(
    () => heatCuts(visible.flatMap((p) => p.horizon.slice(0, weeks))),
    [visible, weeks],
  );

  return (
    <section
      aria-label="Player market"
      className="flex min-h-0 flex-col gap-3 rounded-lg bg-raised card-ring p-3 md:p-4 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100dvh-6rem)]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="upper-label text-2xs text-ink-lo">
          {outPlayer ? `Replacing ${outPlayer.name}` : "The market"}
        </h2>
        <span className="text-2xs text-ink-lo num-tabular">
          {rows.length.toLocaleString("en-GB")} available
        </span>
      </div>

      {/* search */}
      <label className="block">
        <span className="sr-only">Search by player or club</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a player or club code"
          className="h-11 w-full rounded-md bg-sunk card-ring px-3 text-sm text-ink-hi placeholder:text-ink-lo focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
        />
      </label>

      {/* position */}
      <div role="group" aria-label="Position" className="flex gap-1 rounded-md card-ring p-1">
        {POS_TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            aria-pressed={pos === t.key}
            onClick={() => setPos(t.key)}
            className={cn(
              "skewed flex-1 rounded-sm px-2 py-1.5 text-2xs uppercase-label transition-colors dur-instant",
              pos === t.key
                ? "bg-volt text-on-accent"
                : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
            )}
          >
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* the shortlist's own horizon */}
      <div className="flex items-center justify-between gap-2">
        <span className="upper-label text-2xs text-ink-lo">Ranked over</span>
        <div role="group" aria-label="Market window" className="flex gap-1 rounded-md card-ring p-1">
          {WINDOWS.filter((n) => n <= gws.length).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={weeks === n}
              onClick={() => setWeeks(n)}
              className={cn(
                "skewed rounded-sm px-2.5 py-1.5 text-2xs uppercase-label transition-colors dur-instant",
                weeks === n ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
              )}
            >
              <span>{n} GW</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block upper-label text-2xs text-ink-lo">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-11 w-full rounded-md bg-sunk card-ring px-2 text-xs text-ink-hi focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block upper-label text-2xs text-ink-lo">Club</span>
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
      </div>

      {/* price ceiling */}
      <label className="block">
        <span className="mb-1 flex items-baseline justify-between upper-label text-2xs text-ink-lo">
          <span>Max price</span>
          <span className="fig-num text-sm text-ink-hi">
            {maxCost >= priceCeiling ? "any" : `£${(maxCost / 10).toFixed(1)}m`}
          </span>
        </span>
        <input
          type="range"
          min={38}
          max={priceCeiling}
          step={1}
          value={maxCost}
          onChange={(e) => setMaxCost(Number(e.target.value))}
          className="w-full accent-[var(--volt)]"
          aria-label="Maximum price"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-ink-mid">
        <input
          type="checkbox"
          checked={affordable}
          onChange={(e) => setAffordable(e.target.checked)}
          disabled={budgetTenths == null}
          className="h-4 w-4 accent-[var(--volt)]"
        />
        <span>
          Affordable only
          {budgetTenths != null && (
            <span className="ml-1 text-ink-lo num-tabular">
              (£{(budgetTenths / 10).toFixed(1)}m)
            </span>
          )}
          {budgetTenths == null && <span className="ml-1 text-ink-lo">— pick who leaves first</span>}
        </span>
      </label>

      {/* the table */}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overflow-x-auto px-1">
        {visible.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-lo">
            Nothing matches those filters. Widen the price or clear the search.
          </p>
        ) : (
          <table className="w-full border-collapse text-xs num-tabular">
            <thead className="sticky top-0 z-10 bg-raised">
              <tr className="border-b border-hairline text-left">
                <th className="py-1.5 pr-2 text-2xs font-semibold uppercase tracking-wide text-ink-3">
                  Player
                </th>
                <th className="px-1 py-1.5 text-right text-2xs font-semibold uppercase tracking-wide text-ink-3">
                  £
                </th>
                {gws.slice(0, weeks).map((g) => (
                  <th
                    key={g.id}
                    title={g.deadline ? `Deadline ${g.deadline}` : undefined}
                    className="hidden px-1 py-1.5 text-center text-2xs font-semibold uppercase tracking-wide text-ink-3 sm:table-cell"
                  >
                    {g.id}
                  </th>
                ))}
                <th className="pl-1 py-1.5 text-right text-2xs font-semibold uppercase tracking-wide text-ink-3">
                  {weeks} GW
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <MarketRow
                  key={p.id}
                  player={p}
                  gws={gws.slice(0, weeks)}
                  weeks={weeks}
                  cuts={cuts}
                  reason={outPlayer ? reasonFor(p.id) : null}
                  armed={outPlayer != null}
                  onPick={onPick}
                  fixtureFor={fixtureFor}
                />
              ))}
            </tbody>
          </table>
        )}

        {rows.length > visible.length && (
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-md card-ring text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
          >
            Show {Math.min(PAGE, rows.length - visible.length)} more
          </button>
        )}
      </div>
    </section>
  );
}

function MarketRow({
  player: p,
  gws,
  weeks,
  cuts,
  reason,
  armed,
  onPick,
  fixtureFor,
}: {
  player: PlannerPlayer;
  gws: PlannerGw[];
  weeks: number;
  cuts: number[];
  reason: string | null;
  armed: boolean;
  onPick: (id: number) => void;
  fixtureFor: (teamId: number, gw: number) => TickerCell[];
}) {
  const blocked = reason != null;
  const total = windowPoints(p.horizon, weeks);
  return (
    <tr
      className={cn(
        "border-b border-hairline last:border-0 transition-colors dur-instant",
        blocked ? "opacity-45" : "hover:bg-surface-3/60",
      )}
    >
      <td className="py-1.5 pr-2">
        <button
          type="button"
          disabled={blocked || !armed}
          onClick={() => onPick(p.id)}
          title={reason ?? (armed ? `Bring in ${p.name}` : "Pick who leaves first")}
          className="flex w-full items-center gap-2 text-left disabled:cursor-not-allowed"
        >
          <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-sm bg-surface-2">
            <PlayerPhoto photo={p.photo} teamId={p.team} className="h-8 w-8 object-cover object-top" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1">
              <span className="truncate text-xs font-semibold text-ink-hi">{p.name}</span>
              {p.status !== "a" && (
                <span
                  title={p.news || "Availability doubt"}
                  aria-label="Availability doubt"
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: p.status === "d" ? "var(--amber)" : "var(--flare)" }}
                />
              )}
            </span>
            <span className="block truncate text-[10px] leading-tight text-ink-lo">
              {p.code} · {POS_LABEL[p.pos]} · {p.owned.toFixed(1)}% owned
              {blocked ? ` · ${reason}` : ""}
            </span>
          </span>
        </button>
      </td>
      <td className="px-1 py-1.5 text-right text-ink-mid">£{(p.cost / 10).toFixed(1)}</td>
      {gws.map((g, i) => {
        const v = p.horizon[i] ?? 0;
        const fxs = fixtureFor(p.team, g.id);
        const step = heatIndex(v, cuts);
        return (
          <td key={g.id} className="hidden px-0.5 py-1 text-center sm:table-cell">
            <span
              title={
                fxs.length === 0
                  ? `GW${g.id} · no fixture`
                  : `GW${g.id} · ${fxs.map((f) => `${f.opp} (${f.home ? "H" : "A"})`).join(", ")}`
              }
              className="block rounded-[3px] px-1 py-0.5 text-[10px] font-semibold"
              style={{
                background:
                  fxs.length === 0
                    ? "color-mix(in oklab, var(--bg-sunk) 88%, var(--flare))"
                    : `color-mix(in oklab, var(--heat-${step}) 22%, transparent)`,
                color: fxs.length === 0 ? "var(--ink-lo)" : "var(--ink-hi)",
              }}
            >
              {fxs.length === 0 ? "—" : v.toFixed(1)}
            </span>
          </td>
        );
      })}
      <td className="pl-1 py-1.5 text-right">
        <span className="fig-num text-sm text-ink-hi">{total.toFixed(1)}</span>
      </td>
    </tr>
  );
}
