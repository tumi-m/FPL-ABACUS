"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { clubOf } from "@/config/clubs";
import { PlayerAvatar, useAvatarMode } from "@/components/gaffer/PlayerAvatar";
import { Est } from "@/components/gaffer/Est";
import {
  ActualVsExpectedScatter,
  DeltaBars,
  type DeltaRow,
} from "@/components/gaffer/field/PerformanceCharts";
import {
  bonusRate,
  cardRate,
  creation,
  defaultMinutesFloor,
  defconHitsEstimate,
  defending,
  finishing,
  involvement,
  per90,
  positionalDelta,
  rankBoard,
  valuePerMillion,
  type PerfPlayer,
} from "@/lib/engines/performance";

/** One gameweek's live line for a player, when the frame is a single week. */
export interface TopRow {
  element: number;
  webName: string;
  pos: number;
  teamId: number;
  photo: string;
  minutes: number;
  xg: number;
  xa: number;
  xgc: number;
  points: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  bonus: number;
  bps: number;
  defcon: number;
  yellowCards: number;
  redCards: number;
}

export interface TopPerformersData {
  currentGw: number;
  /** This gameweek (live feed) — empty for historical views. */
  gw: TopRow[];
  /** The season so far, carrying everything the engineered views need. */
  season: PerfPlayer[];
}

type Frame = "gw" | "season";
type Board = "actual" | "expected" | "engineered";

/**
 * Metrics, grouped the way a manager thinks about them.
 *
 * `asc` marks the ones where fewest is the achievement — goals conceded and
 * cards — so the board sorts the right way round without a second control.
 * `posDefault` lets a position filter pick a sensible headline metric.
 */
interface Metric {
  id: string;
  label: string;
  hint: string;
  group: Board;
  asc?: boolean;
  /** Per-90 metrics need a minutes floor to mean anything. */
  rate?: boolean;
  value: (p: PerfPlayer) => number;
  format?: (v: number) => string;
}

const int = (v: number) => String(Math.round(v));
const two = (v: number) => v.toFixed(2);
const one = (v: number) => v.toFixed(1);

const METRICS: Metric[] = [
  // ── what actually happened ──
  { id: "points", label: "Points", hint: "FPL points scored", group: "actual", value: (p) => p.points, format: int },
  { id: "goals", label: "Goals", hint: "Goals scored", group: "actual", value: (p) => p.goals, format: int },
  { id: "assists", label: "Assists", hint: "Assists", group: "actual", value: (p) => p.assists, format: int },
  { id: "ga", label: "G+A", hint: "Goals and assists combined", group: "actual", value: (p) => p.goals + p.assists, format: int },
  { id: "cs", label: "Clean sheets", hint: "Clean sheets kept — the defender and keeper currency", group: "actual", value: (p) => p.cleanSheets, format: int },
  { id: "saves", label: "Saves", hint: "Saves made — keepers score a point every three", group: "actual", value: (p) => p.saves, format: int },
  { id: "bonus", label: "Bonus", hint: "Bonus points taken across the season", group: "actual", value: (p) => p.bonus, format: int },
  { id: "defcon", label: "DEFCON", hint: "Defensive contributions — tackles, interceptions, clearances, blocks and recoveries", group: "actual", value: (p) => p.defcon, format: int },
  { id: "conceded", label: "Conceded", hint: "Goals conceded while on the pitch — fewest is best", group: "actual", asc: true, value: (p) => p.goalsConceded, format: int },
  { id: "cards", label: "Cards", hint: "Yellows plus reds — fewest is best", group: "actual", asc: true, value: (p) => p.yellowCards + p.redCards, format: int },
  { id: "ga90", label: "G+A per 90", hint: "Goal involvement rate", group: "actual", rate: true, value: (p) => per90(p.goals + p.assists, p.minutes), format: two },
  { id: "value", label: "Points per £m", hint: "Season points against today's price", group: "actual", rate: true, value: valuePerMillion, format: one },

  // ── what the chances were worth ──
  { id: "xg", label: "xG", hint: "Expected goals", group: "expected", value: (p) => p.xg, format: two },
  { id: "xa", label: "xA", hint: "Expected assists", group: "expected", value: (p) => p.xa, format: two },
  { id: "xgi", label: "xGI", hint: "Expected goal involvements", group: "expected", value: (p) => p.xgi, format: two },
  { id: "xgc", label: "xGC", hint: "Expected goals conceded — fewest is best for keepers and defenders", group: "expected", asc: true, value: (p) => p.xgc, format: two },
  { id: "xgi90", label: "xGI per 90", hint: "Expected involvement rate", group: "expected", rate: true, value: (p) => per90(p.xgi, p.minutes), format: two },
  { id: "bonus90", label: "Bonus per 90", hint: "How often a performance turns into the 1·2·3", group: "expected", rate: true, value: bonusRate, format: two },

  // ── the gap between them ──
  { id: "d-finishing", label: "Finishing", hint: "Goals minus expected goals, shrunk for minutes", group: "engineered", value: (p) => finishing(p).index, format: one },
  { id: "d-creation", label: "Creation", hint: "Assists minus expected assists, shrunk for minutes", group: "engineered", value: (p) => creation(p).index, format: one },
  { id: "d-involvement", label: "Involvement", hint: "Goals and assists against expected involvement", group: "engineered", value: (p) => involvement(p).index, format: one },
  { id: "d-defending", label: "Shutouts", hint: "Clean sheets against the shutouts the fixtures were worth", group: "engineered", value: (p) => defending(p).index, format: one },
  { id: "d-position", label: "By position", hint: "Each player judged on the metric his position is paid for", group: "engineered", value: (p) => positionalDelta(p).delta.index, format: one },
];

const BOARDS: { id: Board; label: string; blurb: string }[] = [
  { id: "actual", label: "Actual", blurb: "What has already happened — real goals, assists, clean sheets and cards." },
  { id: "expected", label: "Expected", blurb: "What the chances were worth, straight from the Opta-fed model FPL publishes." },
  { id: "engineered", label: "Over / under", blurb: "The gap between the two — who is beating their chances and who is leaving them behind." },
];

const POS_TABS: { key: number | null; label: string }[] = [
  { key: null, label: "All" },
  { key: 1, label: "GK" },
  { key: 2, label: "DEF" },
  { key: 3, label: "MID" },
  { key: 4, label: "FWD" },
];
const POS_SHORT: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

/** Sensible headline metric when a position filter is chosen. */
const POS_DEFAULT: Record<number, string> = { 1: "saves", 2: "cs", 3: "ga", 4: "goals" };

/**
 * Top performers.
 *
 * Three boards over one dataset: what happened, what the chances were worth,
 * and the gap. The third is the one nobody else shows, so it gets the charts.
 */
export function TopPerformers({ data }: { data: TopPerformersData }) {
  const [board, setBoard] = React.useState<Board>("actual");
  const [metricId, setMetricId] = React.useState<string>("points");
  const [frame, setFrame] = React.useState<Frame>(data.gw.length > 0 ? "gw" : "season");
  const [pos, setPos] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  // Scaled to how much football has been played, so gameweek one is not blank.
  const [minMinutes, setMinMinutes] = React.useState(() => defaultMinutesFloor(data.season));
  const [avatar] = useAvatarMode();

  const metrics = METRICS.filter((m) => m.group === board);
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];

  // Changing board keeps you on a metric that exists in it.
  React.useEffect(() => {
    if (!METRICS.some((m) => m.id === metricId && m.group === board)) {
      setMetricId(METRICS.find((m) => m.group === board)!.id);
    }
  }, [board, metricId]);

  // The engineered board is a season read — a single week is far too short a
  // sample to call anybody an overperformer.
  React.useEffect(() => {
    if (board === "engineered") setFrame("season");
  }, [board]);

  const source: PerfPlayer[] = React.useMemo(
    () => (frame === "season" ? data.season : data.gw.map(gwToPerf)),
    [frame, data],
  );

  // Rate metrics need a floor; counting metrics do not, so a two-game wonder
  // still shows up on "goals" where he genuinely belongs.
  const floor = frame === "gw" ? 0 : metric.rate || board === "engineered" ? minMinutes : 0;

  const board_ = React.useMemo(
    () =>
      rankBoard(source, {
        minMinutes: floor,
        score: metric.value,
        ascending: metric.asc,
        limit: 15,
        pos,
        search,
      }),
    [source, floor, metric, pos, search],
  );

  const deltaRows: DeltaRow[] = React.useMemo(() => {
    if (board !== "engineered") return [];
    const pool = source.filter(
      (p) => p.minutes >= minMinutes && (pos == null || p.pos === pos),
    );
    return pool.map((p) => {
      const chosen =
        metricId === "d-finishing"
          ? { label: "Goals vs expected", delta: finishing(p) }
          : metricId === "d-creation"
            ? { label: "Assists vs expected", delta: creation(p) }
            : metricId === "d-involvement"
              ? { label: "G+A vs expected", delta: involvement(p) }
              : metricId === "d-defending"
                ? { label: "Clean sheets vs expected", delta: defending(p) }
                : positionalDelta(p);
      return { player: p, delta: chosen.delta, label: chosen.label };
    });
  }, [board, source, minMinutes, pos, metricId]);

  const axis = AXIS_FOR[metricId] ?? { x: "Expected", y: "Actual", title: "Actual against expected" };

  return (
    <section aria-label="Top performers board" className="space-y-3">
      {/* which question you are asking */}
      <div role="group" aria-label="Board" className="flex flex-wrap gap-1 rounded-md card-ring p-1">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBoard(b.id)}
            aria-pressed={board === b.id}
            title={b.blurb}
            className={cn(
              "skewed rounded-sm px-3 py-1.5 text-xs uppercase-label transition-colors dur-instant",
              board === b.id ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
            )}
          >
            <span>{b.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-[150px] flex-1">
          <span className="sr-only">Metric</span>
          <select
            aria-label="Metric"
            value={metric.id}
            onChange={(e) => setMetricId(e.target.value)}
            className="h-9 w-full rounded-md bg-sunk card-ring px-2 text-xs text-ink-hi focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
          >
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <div role="group" aria-label="Position" className="flex gap-1 rounded-md card-ring p-1">
          {POS_TABS.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => {
                setPos(t.key);
                if (t.key != null && board === "actual") setMetricId(POS_DEFAULT[t.key]);
              }}
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

        <div role="group" aria-label="Timeframe" className="flex gap-1 rounded-md card-ring p-1">
          {(["gw", "season"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrame(f)}
              disabled={(f === "gw" && data.gw.length === 0) || (f === "gw" && board === "engineered")}
              aria-pressed={frame === f}
              title={
                f === "gw" && board === "engineered"
                  ? "One gameweek is far too small a sample to call anyone an overperformer"
                  : undefined
              }
              className={cn(
                "skewed rounded-sm px-3 py-1.5 text-2xs uppercase-label transition-colors dur-instant disabled:cursor-not-allowed disabled:opacity-40",
                frame === f ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
              )}
            >
              <span>{f === "gw" ? `GW${data.currentGw}` : "Season"}</span>
            </button>
          ))}
        </div>

        <label className="min-w-[140px] flex-1">
          <span className="sr-only">Search players</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a player or club"
            className="h-9 w-full rounded-md bg-sunk card-ring px-3 text-xs text-ink-hi placeholder:text-ink-lo focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
          />
        </label>
      </div>

      {floor > 0 && (
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
          <span>{board_.eligible} players qualify</span>
        </label>
      )}

      <div className="overflow-hidden rounded-lg bg-surface-1 card-ring">
        <table className="w-full text-sm num-tabular">
          <thead>
            <tr className="border-b border-hairline text-left text-2xs uppercase tracking-wide text-ink-3">
              <th className="w-10 py-2 pl-3 font-semibold">#</th>
              <th className="py-2 font-semibold">Player</th>
              <th className="hidden py-2 font-semibold sm:table-cell">Club</th>
              <th className="py-2 pr-2 text-right font-semibold">Min</th>
              {board === "engineered" && (
                <>
                  <th className="hidden py-2 pr-2 text-right font-semibold sm:table-cell">Actual</th>
                  <th className="hidden py-2 pr-2 text-right font-semibold sm:table-cell">Expected</th>
                </>
              )}
              <th className="py-2 pr-3 text-right font-semibold">{metric.label}</th>
            </tr>
          </thead>
          <tbody>
            {board_.rows.map((r, i) => {
              const v = metric.value(r);
              const d = board === "engineered" ? deltaFor(metricId, r) : null;
              return (
                <tr key={r.id} className="border-b border-hairline last:border-0">
                  <td className="py-2 pl-3 text-ink-lo">{i + 1}</td>
                  <td className="py-2">
                    <span className="flex items-center gap-2.5">
                      <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-sm bg-surface-2">
                        <PlayerAvatar
                          photo={r.photo}
                          teamId={r.teamId}
                          mode={avatar}
                          className="h-8 w-8 object-cover object-top"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink-hi">{r.name}</span>
                        <span className="block text-2xs text-ink-lo">
                          {POS_SHORT[r.pos] ?? "?"} · £{(r.cost / 10).toFixed(1)}m
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="hidden py-2 text-xs text-ink-mid sm:table-cell">{clubOf(r.teamId).code}</td>
                  <td className="py-2 pr-2 text-right text-xs text-ink-mid">{r.minutes}</td>
                  {board === "engineered" && d && (
                    <>
                      <td className="hidden py-2 pr-2 text-right text-xs text-ink-mid sm:table-cell">{d.actual}</td>
                      <td className="hidden py-2 pr-2 text-right text-xs text-ink-lo sm:table-cell">{d.expected}</td>
                    </>
                  )}
                  <td
                    className={cn(
                      "py-2 pr-3 text-right font-bold",
                      board === "engineered"
                        ? v > 0.75
                          ? "text-surge"
                          : v < -0.75
                            ? "text-flare"
                            : "text-ink-mid"
                        : metric.asc
                          ? "text-surge"
                          : "text-ink-hi",
                    )}
                  >
                    {board === "engineered" && v > 0 ? "+" : ""}
                    {(metric.format ?? two)(v)}
                  </td>
                </tr>
              );
            })}
            {board_.rows.length === 0 && (
              <tr>
                <td colSpan={board === "engineered" ? 7 : 5} className="py-8 text-center text-sm text-ink-lo">
                  Nothing clears those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-2xs leading-relaxed text-ink-lo">
        {metric.hint}
        {frame === "gw" ? " — this gameweek's live feed." : " — season totals from the FPL feed."}
        {board === "engineered" && (
          <>
            {" "}
            Gaps are <Est method="Actual minus expected, shrunk toward zero by minutes played so a short sample cannot top the board.">shrunk for minutes</Est>.
          </>
        )}
      </p>

      {/* the engineered board earns its charts */}
      {board === "engineered" && deltaRows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 pt-1 lg:grid-cols-2">
          <ActualVsExpectedScatter
            rows={deltaRows}
            xLabel={axis.x}
            yLabel={axis.y}
            title={axis.title}
          />
          <DeltaBars rows={deltaRows} title="Biggest gaps in either direction" />
        </div>
      )}
    </section>
  );
}

const AXIS_FOR: Record<string, { x: string; y: string; title: string }> = {
  "d-finishing": { x: "Expected goals", y: "Goals scored", title: "Finishing — goals against xG" },
  "d-creation": { x: "Expected assists", y: "Assists", title: "Creation — assists against xA" },
  "d-involvement": { x: "Expected involvements", y: "Goals + assists", title: "Involvement — G+A against xGI" },
  "d-defending": { x: "Expected clean sheets", y: "Clean sheets", title: "Shutouts — clean sheets against expectation" },
  "d-position": { x: "Expected", y: "Actual", title: "Each player on the metric his position is paid for" },
};

function deltaFor(metricId: string, p: PerfPlayer) {
  switch (metricId) {
    case "d-finishing":
      return finishing(p);
    case "d-creation":
      return creation(p);
    case "d-involvement":
      return involvement(p);
    case "d-defending":
      return defending(p);
    default:
      return positionalDelta(p).delta;
  }
}

/** A single gameweek's live line, shaped like a season row so one table serves both. */
function gwToPerf(r: TopRow): PerfPlayer {
  return {
    id: r.element,
    name: r.webName,
    pos: r.pos,
    teamId: r.teamId,
    code: clubOf(r.teamId).code,
    photo: r.photo,
    cost: 0,
    minutes: r.minutes,
    starts: r.minutes >= 60 ? 1 : 0,
    points: r.points,
    goals: r.goals,
    assists: r.assists,
    cleanSheets: r.cleanSheets,
    goalsConceded: 0,
    saves: r.saves,
    bonus: r.bonus,
    bps: r.bps,
    defcon: r.defcon,
    tackles: 0,
    recoveries: 0,
    cbi: 0,
    yellowCards: r.yellowCards,
    redCards: r.redCards,
    xg: r.xg,
    xa: r.xa,
    xgi: r.xg + r.xa,
    xgc: r.xgc,
    owned: 0,
  };
}

export { cardRate, defconHitsEstimate };
