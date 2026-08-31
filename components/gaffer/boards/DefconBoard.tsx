"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { clubOf } from "@/config/clubs";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Est } from "@/components/gaffer/Est";
import { PlayerAvatar, AvatarToggle, useAvatarMode } from "@/components/gaffer/PlayerAvatar";
import {
  cardRate,
  defaultMinutesFloor,
  defconHitsEstimate,
  defconThreshold,
  hasDefconLane,
  per90,
  rankBoard,
  type PerfPlayer,
} from "@/lib/engines/performance";

export interface DefconRow {
  element: number;
  defcon: number;
  hits: number;
  appearances: number;
  minutes: number;
  tackles: number;
  recoveries: number;
  cbi: number;
  yellowCards: number;
  redCards: number;
}

export interface DefconBoardData {
  currentGw: number;
  players: PerfPlayer[];
  window: { gws: number[]; rows: DefconRow[] };
}

const POS_SHORT: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
const POS_TABS: { key: number | null; label: string }[] = [
  { key: null, label: "All" },
  { key: 2, label: "DEF" },
  { key: 3, label: "MID" },
  { key: 4, label: "FWD" },
];

type Sort = "total" | "per90" | "hits" | "points" | "cards" | "cardRate";

/** Two points every time a player clears his position's line in a match. */
const DEFCON_POINTS = 2;

const HITS_METHOD =
  "Counted from each gameweek's own feed — the number of matches in the window where the player actually cleared his position's threshold, not the season total divided by it.";
const ESTIMATE_METHOD =
  "The season total divided by the threshold, capped at appearances. FPL publishes the total but not the per-match series, so this is an upper bound on hits rather than a measured count.";

/**
 * DEFCON monsters.
 *
 * Defensive contributions became a scoring lane in 2025/26: ten for a
 * defender, twelve for everyone else, two points when you clear it. The number
 * that matters is not the season total — it is how often a player crosses the
 * line, because contributions below it score nothing at all.
 */
export function DefconBoard({ data }: { data: DefconBoardData }) {
  const [sort, setSort] = React.useState<Sort>("per90");
  const [pos, setPos] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  // Scaled to how much football has been played, so gameweek one is not blank.
  const [minMinutes, setMinMinutes] = React.useState(() => defaultMinutesFloor(data.players));
  const [avatar, setAvatar] = useAvatarMode();

  const byElement = React.useMemo(
    () => new Map(data.window.rows.map((r) => [r.element, r])),
    [data.window.rows],
  );
  const measured = data.window.gws.length > 0;

  const score = React.useCallback(
    (p: PerfPlayer) => {
      switch (sort) {
        case "total":
          return p.defcon;
        case "hits":
          return measured ? (byElement.get(p.id)?.hits ?? 0) : defconHitsEstimate(p);
        case "points":
          return (measured ? (byElement.get(p.id)?.hits ?? 0) : defconHitsEstimate(p)) * DEFCON_POINTS;
        case "cards":
          return p.yellowCards + p.redCards;
        case "cardRate":
          return cardRate(p);
        default:
          return per90(p.defcon, p.minutes);
      }
    },
    [sort, byElement, measured],
  );

  const board = React.useMemo(
    () =>
      rankBoard(data.players, {
        minMinutes,
        score,
        limit: 20,
        pos,
        search,
      }),
    [data.players, minMinutes, score, pos, search],
  );

  const windowLabel =
    data.window.gws.length > 0
      ? data.window.gws.length === 1
        ? `GW${data.window.gws[0]}`
        : `GW${data.window.gws[0]}–${data.window.gws[data.window.gws.length - 1]}`
      : "the season";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-[170px]">
          <span className="sr-only">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-9 w-full rounded-md bg-sunk card-ring px-2 text-xs text-ink-hi focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
          >
            <option value="per90">Contributions per 90</option>
            <option value="total">Contributions (season)</option>
            <option value="hits">Times over the threshold</option>
            <option value="points">Points from the lane</option>
            <option value="cards">Bookings</option>
            <option value="cardRate">Bookings per 90</option>
          </select>
        </label>

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

      <label className="flex flex-wrap items-center gap-3 text-2xs text-ink-lo">
        <span className="upper-label">Minutes floor</span>
        <input
          type="range"
          min={0}
          max={2000}
          step={90}
          value={minMinutes}
          onChange={(e) => setMinMinutes(Number(e.target.value))}
          className="h-1 w-40 accent-[var(--volt)]"
          aria-label="Minimum minutes played"
        />
        <span className="fig-num text-sm text-ink-hi">{minMinutes}&apos;</span>
        <span>{board.eligible} players qualify</span>
      </label>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ContributionMix rows={board.rows} />
        <RateAgainstThreshold rows={board.rows} byElement={byElement} measured={measured} />
      </div>

      <div className="overflow-hidden rounded-lg bg-surface-1 card-ring">
        <table className="w-full text-sm num-tabular">
          <thead>
            <tr className="border-b border-hairline text-left text-2xs uppercase tracking-wide text-ink-3">
              <th className="w-10 py-2 pl-3 font-semibold">#</th>
              <th className="py-2 font-semibold">Player</th>
              <th className="hidden py-2 font-semibold sm:table-cell">Club</th>
              <th className="py-2 pr-2 text-right font-semibold">Min</th>
              <th className="hidden py-2 pr-2 text-right font-semibold md:table-cell">Tck</th>
              <th className="hidden py-2 pr-2 text-right font-semibold md:table-cell">CBI</th>
              <th className="hidden py-2 pr-2 text-right font-semibold md:table-cell">Rec</th>
              <th className="py-2 pr-2 text-right font-semibold">Per 90</th>
              <th className="py-2 pr-2 text-right font-semibold">Cleared</th>
              <th className="py-2 pr-2 text-right font-semibold">Pts</th>
              <th className="hidden py-2 pr-2 text-right font-semibold sm:table-cell">Cards</th>
              <th className="py-2 pr-3 text-right font-semibold">DEFCON</th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((p, i) => {
              const w = byElement.get(p.id);
              const hits = measured ? (w?.hits ?? 0) : defconHitsEstimate(p);
              const rate = per90(p.defcon, p.minutes);
              const thr = defconThreshold(p.pos);
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
                          {/* A keeper's threshold is 99, the engine's way of
                              saying the lane does not apply to him — printing
                              "needs 99" would be worse than the "needs 12" it
                              replaced. */}
                          {POS_SHORT[p.pos]} · {hasDefconLane(p.pos) ? `needs ${thr}` : "no lane"}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="hidden py-2 text-xs text-ink-mid sm:table-cell">{clubOf(p.teamId).code}</td>
                  <td className="py-2 pr-2 text-right text-xs text-ink-mid">{p.minutes}</td>
                  <td className="hidden py-2 pr-2 text-right text-xs text-ink-lo md:table-cell">{p.tackles}</td>
                  <td className="hidden py-2 pr-2 text-right text-xs text-ink-lo md:table-cell">{p.cbi}</td>
                  <td className="hidden py-2 pr-2 text-right text-xs text-ink-lo md:table-cell">{p.recoveries}</td>
                  <td
                    className={cn(
                      "py-2 pr-2 text-right text-xs font-semibold",
                      hasDefconLane(p.pos) && rate >= thr
                        ? "text-[var(--defcon-hit)]"
                        : "text-[var(--defcon)]",
                    )}
                  >
                    {rate.toFixed(1)}
                  </td>
                  <td className="py-2 pr-2 text-right text-xs text-ink-mid">{hits}</td>
                  {/*
                   * What the lane actually paid.
                   *
                   * The board ranked by contributions and by times cleared but
                   * never showed the points, which is the only figure that
                   * ends up on a scoreboard — and the two do not track each
                   * other: a season total twice somebody else's is worth
                   * nothing if it never once crossed the line in a match.
                   */}
                  <td
                    className={cn(
                      "py-2 pr-2 text-right text-xs font-semibold num-tabular",
                      hits > 0 ? "text-[var(--defcon-hit)]" : "text-ink-lo",
                    )}
                    title={`${hits} × ${DEFCON_POINTS} points`}
                  >
                    {hits * DEFCON_POINTS}
                  </td>
                  <td className="hidden py-2 pr-2 text-right text-xs sm:table-cell">
                    <span className={p.redCards > 0 ? "text-flare" : "text-amber"}>
                      {p.yellowCards}
                      {p.redCards > 0 ? ` · ${p.redCards}R` : ""}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right font-bold text-[var(--defcon)]">{p.defcon}</td>
                </tr>
              );
            })}
            {board.rows.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-sm text-ink-lo">
                  Nothing clears those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-2xs leading-relaxed text-ink-lo">
        Defenders score two points at ten defensive contributions, everyone else at twelve —
        anything below the line scores nothing, which is why the rate matters more than the total.
        &quot;Cleared&quot; is{" "}
        {measured ? (
          <span title={HITS_METHOD} className="border-b border-dotted border-hairline-strong">
            the matches in {windowLabel} where the threshold was actually cleared
          </span>
        ) : (
          <Est method={ESTIMATE_METHOD}>an upper bound on threshold crossings</Est>
        )}
        . Tck · CBI · Rec are tackles, clearances/blocks/interceptions and recoveries — the three
        things DEFCON counts.
      </p>
    </div>
  );
}

/** What a player's defensive work is actually made of. */
function ContributionMix({ rows }: { rows: PerfPlayer[] }) {
  const top = rows.filter((p) => p.defcon > 0).slice(0, 10);
  if (top.length === 0) {
    return (
      <ChartFrame eyebrow="Mix" title="What the work is made of" ariaLabel="Defensive contribution mix">
        <p className="py-10 text-center text-sm text-ink-lo">No contributions recorded yet.</p>
      </ChartFrame>
    );
  }

  const W = 560;
  const rowH = 26;
  const H = top.length * rowH + 52;
  const M = { top: 10, right: 40, bottom: 30, left: 104 };
  const max = Math.max(1, ...top.map((p) => p.tackles + p.cbi + p.recoveries));
  const scale = (v: number) => ((W - M.left - M.right) * v) / max;

  const bands = [
    { key: "tackles" as const, label: "Tackles", fill: "var(--defcon)" },
    { key: "cbi" as const, label: "Clearances, blocks, interceptions", fill: "color-mix(in oklab, var(--defcon) 62%, var(--bg-sunk))" },
    { key: "recoveries" as const, label: "Recoveries", fill: "color-mix(in oklab, var(--defcon) 32%, var(--bg-sunk))" },
  ];

  return (
    <ChartFrame
      eyebrow="Mix"
      title="What the work is made of"
      ariaLabel="Tackles, clearances and recoveries making up each player's defensive contributions"
      caption="Recovery-heavy players are usually deep midfielders; tackle-and-block heavy ones are centre-backs and full-backs."
      table={{
        headers: ["Player", "Tackles", "CBI", "Recoveries"],
        rows: top.map((p) => [p.name, p.tackles, p.cbi, p.recoveries]),
      }}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {top.map((p, i) => {
          const y = M.top + i * rowH;
          let acc = 0;
          const total = p.tackles + p.cbi + p.recoveries;
          return (
            <g key={p.id}>
              <text x={M.left - 10} y={y + 16} textAnchor="end" fontSize="10" className="fill-(--ink-mid)">
                {p.name}
              </text>
              {bands.map((b) => {
                const n = p[b.key];
                const x0 = M.left + scale(acc);
                acc += n;
                if (n === 0) return null;
                return (
                  <rect key={b.key} x={x0} y={y + 5} width={Math.max(1, scale(n))} height={16} rx="2" fill={b.fill}>
                    <title>{`${p.name}: ${n} ${b.label.toLowerCase()}`}</title>
                  </rect>
                );
              })}
              <text x={M.left + scale(total) + 6} y={y + 17} fontSize="10" fontWeight="700" className="fill-(--ink-hi)">
                {total}
              </text>
            </g>
          );
        })}
        {bands.map((b, i) => (
          <g key={`k-${b.key}`}>
            <rect x={M.left + i * 132} y={H - 20} width={10} height={10} rx="2" fill={b.fill} />
            <text x={M.left + i * 132 + 15} y={H - 11} fontSize="9" className="fill-(--ink-lo)">
              {b.key === "cbi" ? "CBI" : b.label}
            </text>
          </g>
        ))}
      </svg>
    </ChartFrame>
  );
}

/** Per-90 rate against the line each position has to clear. */
function RateAgainstThreshold({
  rows,
  byElement,
  measured,
}: {
  rows: PerfPlayer[];
  byElement: Map<number, DefconRow>;
  measured: boolean;
}) {
  const top = rows.filter((p) => p.minutes > 0).slice(0, 14);
  if (top.length === 0) {
    return (
      <ChartFrame eyebrow="Rate" title="Against the line" ariaLabel="Contribution rate against the scoring threshold">
        <p className="py-10 text-center text-sm text-ink-lo">Nobody clears the minutes floor yet.</p>
      </ChartFrame>
    );
  }

  const W = 560;
  const rowH = 24;
  const H = top.length * rowH + 48;
  const M = { top: 12, right: 52, bottom: 28, left: 104 };
  const max = Math.max(14, ...top.map((p) => per90(p.defcon, p.minutes))) * 1.06;
  const scale = (v: number) => ((W - M.left - M.right) * v) / max;

  return (
    <ChartFrame
      eyebrow="Rate"
      title="Against the line"
      ariaLabel="Each player's contributions per ninety against the threshold his position must clear"
      caption="The dashes are the scoring line — ten for defenders, twelve for everyone else. A bar past its own dash is a player who scores this lane most weeks."
      table={{
        headers: ["Player", "Per 90", "Threshold", measured ? "Cleared" : "Cleared (est)"],
        rows: top.map((p) => [
          p.name,
          per90(p.defcon, p.minutes).toFixed(1),
          defconThreshold(p.pos),
          measured ? (byElement.get(p.id)?.hits ?? 0) : defconHitsEstimate(p),
        ]),
      }}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {top.map((p, i) => {
          const y = M.top + i * rowH;
          const rate = per90(p.defcon, p.minutes);
          const thr = defconThreshold(p.pos);
          const over = rate >= thr;
          return (
            <g key={p.id}>
              <text x={M.left - 10} y={y + 15} textAnchor="end" fontSize="10" className="fill-(--ink-mid)">
                {p.name}
              </text>
              <rect
                x={M.left}
                y={y + 4}
                width={Math.max(2, scale(rate))}
                height={15}
                rx="3"
                fill={over ? "var(--defcon-hit)" : "var(--defcon)"}
                opacity={over ? 1 : 0.75}
              >
                <title>{`${p.name}: ${rate.toFixed(1)} per 90 against a threshold of ${thr}`}</title>
              </rect>
              {/* the line this player has to clear */}
              <line
                x1={M.left + scale(thr)}
                x2={M.left + scale(thr)}
                y1={y + 1}
                y2={y + 22}
                stroke="var(--ink-lo)"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <text
                x={M.left + Math.max(2, scale(rate)) + 6}
                y={y + 16}
                fontSize="10"
                fontWeight="700"
                className={over ? "fill-[var(--defcon-hit)]" : "fill-(--ink-mid)"}
              >
                {rate.toFixed(1)}
              </text>
            </g>
          );
        })}
        <text x={M.left} y={H - 8} fontSize="10" className="fill-(--ink-lo)">
          Defensive contributions per 90 · dashes mark the two-point line
        </text>
      </svg>
    </ChartFrame>
  );
}
