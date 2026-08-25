"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { clubOf } from "@/config/clubs";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Est } from "@/components/gaffer/Est";
import { PlayerAvatar, AvatarToggle, useAvatarMode } from "@/components/gaffer/PlayerAvatar";
import {
  bonusEfficiency,
  bonusRate,
  defaultMinutesFloor,
  per90,
  rankBoard,
  type PerfPlayer,
} from "@/lib/engines/performance";

export interface BonusRow {
  element: number;
  threes: number;
  twos: number;
  ones: number;
  total: number;
  appearances: number;
  bps: number;
}

export interface BonusBoardData {
  currentGw: number;
  players: PerfPlayer[];
  /** The 3·2·1 split for the window that was actually read. */
  window: { gws: number[]; rows: BonusRow[] };
}

const POS_SHORT: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
const POS_TABS: { key: number | null; label: string }[] = [
  { key: null, label: "All" },
  { key: 1, label: "GK" },
  { key: 2, label: "DEF" },
  { key: 3, label: "MID" },
  { key: 4, label: "FWD" },
];

type Frame = "season" | "window";
type Sort = "total" | "threes" | "rate" | "efficiency";

const EFFICIENCY_METHOD =
  "Season BPS divided by bonus points taken. Lower is better: it means a player converts his performances into the 1·2·3 rather than piling up BPS in matches somebody else tops.";

/**
 * The bonus board.
 *
 * Bonus is the most misunderstood scoring lane in the game: people chase BPS,
 * but BPS only pays when you finish top three in your own match. So this board
 * shows both — what was actually taken, and how much BPS it cost to take it.
 */
export function BonusBoard({ data }: { data: BonusBoardData }) {
  const [frame, setFrame] = React.useState<Frame>("season");
  const [sort, setSort] = React.useState<Sort>("total");
  const [pos, setPos] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  const [avatar, setAvatar] = useAvatarMode();
  const floor = React.useMemo(() => defaultMinutesFloor(data.players), [data.players]);

  const byElement = React.useMemo(
    () => new Map(data.window.rows.map((r) => [r.element, r])),
    [data.window.rows],
  );

  // In the window frame a player's bonus is what he took in those weeks; in
  // the season frame it is the bootstrap total. Everything else is unchanged.
  const players: PerfPlayer[] = React.useMemo(() => {
    if (frame === "season") return data.players;
    return data.players.map((p) => {
      const w = byElement.get(p.id);
      return w ? { ...p, bonus: w.total, bps: w.bps } : { ...p, bonus: 0, bps: 0 };
    });
  }, [frame, data.players, byElement]);

  const score = React.useCallback(
    (p: PerfPlayer) => {
      switch (sort) {
        case "threes":
          return byElement.get(p.id)?.threes ?? 0;
        case "rate":
          return bonusRate(p);
        case "efficiency":
          // Ascending is handled below; unbonused players sort last.
          return bonusEfficiency(p) ?? Number.POSITIVE_INFINITY;
        default:
          return p.bonus;
      }
    },
    [sort, byElement],
  );

  const board = React.useMemo(
    () =>
      rankBoard(players, {
        minMinutes: sort === "rate" || sort === "efficiency" ? floor : 0,
        score,
        ascending: sort === "efficiency",
        limit: 20,
        pos,
        search,
      }),
    [players, score, sort, pos, search, floor],
  );

  const windowLabel =
    data.window.gws.length > 0
      ? data.window.gws.length === 1
        ? `GW${data.window.gws[0]}`
        : `GW${data.window.gws[0]}–${data.window.gws[data.window.gws.length - 1]}`
      : "recent";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Timeframe" className="flex gap-1 rounded-md glass-edge p-1">
          {(
            [
              { id: "season", label: "Season" },
              { id: "window", label: windowLabel },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFrame(f.id)}
              disabled={f.id === "window" && data.window.gws.length === 0}
              aria-pressed={frame === f.id}
              className={cn(
                "skewed rounded-sm px-3 py-1.5 text-2xs uppercase-label transition-colors dur-instant disabled:cursor-not-allowed disabled:opacity-40",
                frame === f.id ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
              )}
            >
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        <div role="group" aria-label="Position" className="flex gap-1 rounded-md glass-edge p-1">
          {POS_TABS.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setPos(t.key)}
              aria-pressed={pos === t.key}
              className={cn(
                "skewed rounded-sm px-2.5 py-1.5 text-2xs uppercase-label transition-colors dur-instant",
                pos === t.key ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
              )}
            >
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <label className="min-w-[150px]">
          <span className="sr-only">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-9 w-full rounded-md bg-sunk card-ring px-2 text-xs text-ink-hi focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
          >
            <option value="total">Bonus taken</option>
            <option value="threes">Threes taken</option>
            <option value="rate">Bonus per 90</option>
            <option value="efficiency">BPS per bonus (lowest)</option>
          </select>
        </label>

        <label className="min-w-[150px] flex-1">
          <span className="sr-only">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a player or club"
            className="h-9 w-full rounded-md bg-sunk card-ring px-3 text-xs text-ink-hi placeholder:text-ink-lo focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
          />
        </label>

        <AvatarToggle mode={avatar} onChange={setAvatar} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BonusSplit rows={board.rows} byElement={byElement} windowLabel={windowLabel} />
        <BpsConversion rows={board.rows} />
      </div>

      <div className="overflow-hidden rounded-lg bg-surface-1 card-ring">
        <table className="w-full text-sm num-tabular">
          <thead>
            <tr className="border-b border-hairline text-left text-2xs uppercase tracking-wide text-ink-3">
              <th className="w-10 py-2 pl-3 font-semibold">#</th>
              <th className="py-2 font-semibold">Player</th>
              <th className="hidden py-2 font-semibold sm:table-cell">Club</th>
              <th className="py-2 pr-2 text-right font-semibold">Min</th>
              <th className="hidden py-2 pr-2 text-right font-semibold md:table-cell">3s</th>
              <th className="hidden py-2 pr-2 text-right font-semibold md:table-cell">2s</th>
              <th className="hidden py-2 pr-2 text-right font-semibold md:table-cell">1s</th>
              <th className="py-2 pr-2 text-right font-semibold">Per 90</th>
              <th className="hidden py-2 pr-2 text-right font-semibold sm:table-cell">BPS each</th>
              <th className="py-2 pr-3 text-right font-semibold">Bonus</th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((p, i) => {
              const w = byElement.get(p.id);
              const eff = bonusEfficiency(p);
              return (
                <tr key={p.id} className="border-b border-hairline last:border-0">
                  <td className="py-2 pl-3 text-ink-lo">{i + 1}</td>
                  <td className="py-2">
                    <span className="flex items-center gap-2.5">
                      <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-sm bg-surface-2">
                        <PlayerAvatar photo={p.photo} teamId={p.teamId} mode={avatar} className="h-8 w-8 object-cover object-top" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink-hi">{p.name}</span>
                        <span className="block text-2xs text-ink-lo">
                          {POS_SHORT[p.pos]} · £{(p.cost / 10).toFixed(1)}m
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="hidden py-2 text-xs text-ink-mid sm:table-cell">{clubOf(p.teamId).code}</td>
                  <td className="py-2 pr-2 text-right text-xs text-ink-mid">{p.minutes}</td>
                  <td className="hidden py-2 pr-2 text-right text-xs text-bonus md:table-cell">{w?.threes ?? "—"}</td>
                  <td className="hidden py-2 pr-2 text-right text-xs text-ink-mid md:table-cell">{w?.twos ?? "—"}</td>
                  <td className="hidden py-2 pr-2 text-right text-xs text-ink-lo md:table-cell">{w?.ones ?? "—"}</td>
                  <td className="py-2 pr-2 text-right text-xs text-ink-mid">{bonusRate(p).toFixed(2)}</td>
                  <td className="hidden py-2 pr-2 text-right text-xs text-ink-mid sm:table-cell">
                    {eff == null ? "—" : eff.toFixed(0)}
                  </td>
                  <td className="py-2 pr-3 text-right font-bold text-bonus">{p.bonus}</td>
                </tr>
              );
            })}
            {board.rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-sm text-ink-lo">
                  Nothing clears those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-2xs leading-relaxed text-ink-lo">
        The 3·2·1 columns come from reading each gameweek&apos;s feed, so they cover {windowLabel} only —
        FPL publishes a season bonus total but not the split. &quot;BPS each&quot; is{" "}
        <Est method={EFFICIENCY_METHOD}>the BPS spent per bonus point taken</Est>; lower means a
        player wins his match&apos;s bonus rather than collecting BPS behind somebody else.
      </p>
    </div>
  );
}

/** Stacked 3·2·1 — the shape of how a player earns his bonus. */
function BonusSplit({
  rows,
  byElement,
  windowLabel,
}: {
  rows: PerfPlayer[];
  byElement: Map<number, BonusRow>;
  windowLabel: string;
}) {
  const top = rows
    .map((p) => ({ p, w: byElement.get(p.id) }))
    .filter((r): r is { p: PerfPlayer; w: BonusRow } => r.w != null && r.w.total > 0)
    .sort((a, b) => b.w.total - a.w.total)
    .slice(0, 10);

  if (top.length === 0) {
    return (
      <ChartFrame eyebrow="Split" title="How the bonus was earned" ariaLabel="Bonus split by three, two and one">
        <p className="py-10 text-center text-sm text-ink-lo">
          No bonus recorded in {windowLabel} yet.
        </p>
      </ChartFrame>
    );
  }

  const W = 560;
  const rowH = 26;
  const H = top.length * rowH + 52;
  const M = { top: 10, right: 36, bottom: 30, left: 104 };
  const max = Math.max(1, ...top.map((r) => r.w.total));
  const scale = (v: number) => ((W - M.left - M.right) * v) / max;

  const bands = [
    { key: "threes" as const, label: "3 pts", fill: "var(--bonus)" },
    { key: "twos" as const, label: "2 pts", fill: "color-mix(in oklab, var(--bonus) 62%, var(--bg-sunk))" },
    { key: "ones" as const, label: "1 pt", fill: "color-mix(in oklab, var(--bonus) 32%, var(--bg-sunk))" },
  ];

  return (
    <ChartFrame
      eyebrow="Split"
      title={`How the bonus was earned — ${windowLabel}`}
      ariaLabel="Bonus points split into threes, twos and ones"
      caption="A tall stack of threes is a player who dominates his matches; a wide stack of ones is one who is always around the podium."
      table={{
        headers: ["Player", "3s", "2s", "1s", "Total"],
        rows: top.map((r) => [r.p.name, r.w.threes, r.w.twos, r.w.ones, r.w.total]),
      }}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {top.map((r, i) => {
          const y = M.top + i * rowH;
          let acc = 0;
          return (
            <g key={r.p.id}>
              <text x={M.left - 10} y={y + 16} textAnchor="end" fontSize="10" className="fill-(--ink-mid)">
                {r.p.name}
              </text>
              {bands.map((b) => {
                const n = r.w[b.key] * (b.key === "threes" ? 3 : b.key === "twos" ? 2 : 1);
                const x0 = M.left + scale(acc);
                acc += n;
                if (n === 0) return null;
                return (
                  <rect key={b.key} x={x0} y={y + 5} width={Math.max(1, scale(n))} height={16} rx="2" fill={b.fill}>
                    <title>{`${r.p.name}: ${r.w[b.key]} × ${b.label}`}</title>
                  </rect>
                );
              })}
              <text x={M.left + scale(r.w.total) + 6} y={y + 17} fontSize="10" fontWeight="700" className="fill-(--ink-hi)">
                {r.w.total}
              </text>
            </g>
          );
        })}
        {bands.map((b, i) => (
          <g key={`k-${b.key}`}>
            <rect x={M.left + i * 74} y={H - 20} width={10} height={10} rx="2" fill={b.fill} />
            <text x={M.left + i * 74 + 15} y={H - 11} fontSize="10" className="fill-(--ink-lo)">
              {b.label}
            </text>
          </g>
        ))}
      </svg>
    </ChartFrame>
  );
}

/** BPS against bonus — the conversion plot. */
function BpsConversion({ rows }: { rows: PerfPlayer[] }) {
  const pts = rows.filter((p) => p.bps > 0);
  if (pts.length < 3) {
    return (
      <ChartFrame eyebrow="Conversion" title="BPS against bonus taken" ariaLabel="BPS against bonus taken">
        <p className="py-10 text-center text-sm text-ink-lo">Not enough minutes on the board yet.</p>
      </ChartFrame>
    );
  }

  const W = 560;
  const H = 300;
  const M = { top: 16, right: 18, bottom: 40, left: 46 };
  const maxBps = Math.max(...pts.map((p) => p.bps)) * 1.06;
  const maxBonus = Math.max(1, ...pts.map((p) => p.bonus)) * 1.1;
  const sx = (v: number) => M.left + ((W - M.left - M.right) * v) / maxBps;
  const sy = (v: number) => H - M.bottom - ((H - M.top - M.bottom) * v) / maxBonus;

  // The population's own conversion line — bonus per BPS across everyone shown.
  const totalBps = pts.reduce((s, p) => s + p.bps, 0);
  const totalBonus = pts.reduce((s, p) => s + p.bonus, 0);
  const slope = totalBps > 0 ? totalBonus / totalBps : 0;

  const named = [...pts].sort((a, b) => b.bonus - a.bonus).slice(0, 6);

  return (
    <ChartFrame
      eyebrow="Conversion"
      title="BPS against bonus taken"
      ariaLabel="Bonus points taken against BPS accumulated"
      caption="Above the line is a player converting BPS into bonus better than the field; below it is one collecting BPS he never cashes."
      table={{
        headers: ["Player", "BPS", "Bonus"],
        rows: named.map((p) => [p.name, p.bps, p.bonus]),
      }}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={M.left} y1={H - M.bottom} x2={W - M.right} y2={H - M.bottom} stroke="var(--axis)" strokeWidth="1" />
        <line x1={M.left} y1={M.top} x2={M.left} y2={H - M.bottom} stroke="var(--axis)" strokeWidth="1" />
        <line
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(maxBps)}
          y2={sy(Math.min(maxBonus, maxBps * slope))}
          stroke="var(--ink-lo)"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
        {pts.map((p) => (
          <circle
            key={p.id}
            cx={sx(p.bps)}
            cy={sy(p.bonus)}
            r={p.bonus > p.bps * slope ? 4.5 : 3.5}
            fill={p.bonus >= p.bps * slope ? "var(--bonus)" : "var(--line-hi)"}
            opacity={0.8}
          >
            <title>{`${p.name}: ${p.bps} BPS → ${p.bonus} bonus`}</title>
          </circle>
        ))}
        {named.map((p) => (
          <text key={`n-${p.id}`} x={sx(p.bps) + 7} y={sy(p.bonus) - 5} fontSize="9" className="fill-(--ink-hi)">
            {p.name}
          </text>
        ))}
        <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
          BPS accumulated
        </text>
        <text x={-(H / 2)} y={12} transform="rotate(-90)" textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
          Bonus taken
        </text>
      </svg>
    </ChartFrame>
  );
}

export { per90 };
