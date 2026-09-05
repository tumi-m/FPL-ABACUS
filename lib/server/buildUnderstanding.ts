import "server-only";

/**
 * Server composition for /field/understanding (v10 D1).
 *
 * Three tested engines, finally with a screen: the season ledger
 * (shapleyLedger), the season's luck channels (processVsOutcome), and the
 * true-form ribbon (trueForm). The data all exists upstream and is cached:
 *
 *   the entry history        — one read — carries every week's score, bench
 *                              points, hit cost and chips;
 *   each week's live feed    — one cached read per settled week — carries
 *                              the squad's actual stat lines for that week;
 *   each squad player's
 *   element-summary          — one cached read per player, fifteen total —
 *                              carries the per-match xG/xA the ribbon needs.
 *
 * Weeks read are capped (UNDERSTANDING_MAX_GWS) so a late-season page stays
 * inside its request budget, and every failure degrades to an honest empty
 * per week rather than failing the page — a week whose feed did not answer
 * is dropped from the ledger, never counted as a zero.
 */
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getHistory, getLive, getElementSummary, getPicks } from "@/lib/fpl/endpoints";
import { parseScoring } from "@/lib/engines/scoring";
import { ledgerDecisions, seasonLuck, formSeries, type GwLine } from "@/lib/engines/seasonUnderstanding";
import { shapleyLedger } from "@/lib/quant/understanding";
import { trueForm } from "@/lib/quant/estimators";
import { mapPool } from "@/lib/server/mapPool";
import type { Pos } from "@/lib/engines/types";

/** The most gameweeks the ledger will read. A full season costs 38 cached
    live-feed reads; the cap exists for the endpoint's request budget, not
    the cache. */
export const UNDERSTANDING_MAX_GWS = 12;

/** How many squad players get a ribbon. The most-owned first. */
export const RIBBON_LIMIT = 6;

export interface UnderstandingData {
  currentGw: number;
  /** The gameweeks actually read, oldest first. */
  gws: number[];
  /** Shapley attribution over the decision kinds. */
  ledger: {
    lines: { key: string; value: number; se: number }[];
    total: number;
    orderings: number;
  };
  luck: {
    finishingLuck: number;
    creationLuck: number;
    fieldLuck: number;
    advice: string[];
  };
  /** Per-player Kalman ribbons, most-owned first. */
  ribbons: {
    element: number;
    name: string;
    pos: number;
    points: { round: number; ability: number; sd: number }[];
    current: { ability: number; sd: number };
    /** False under the filter's minimum history — the UI refuses to speak. */
    reliable: boolean;
  }[];
  /** Weeks whose live feed did not answer — dropped, never zeroed. */
  missedWeeks: number[];
}

export async function buildUnderstanding(entryId: number): Promise<UnderstandingData> {
  const boot = await getBootstrapLite();
  const currentGw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);

  const [historyRes, picksRes] = await Promise.allSettled([
    getHistory(entryId),
    getPicks(entryId, currentGw, true),
  ]);

  if (historyRes.status !== "fulfilled") throw new Error("history-unavailable");
  const history = historyRes.value;

  const scoring = parseScoring(boot.scoring);

  // Only settled weeks: strictly before the current gameweek. A live week's
  // published average_entry_score is a partial figure (GW3 mid-week reads 7),
  // and its live feed is not final — counting either would price luck against
  // numbers FPL has not finished publishing.
  const settled = history.current.filter((c) => c.event < currentGw);
  const wanted = settled.slice(-UNDERSTANDING_MAX_GWS);

  // The field average per week is FPL's own published figure —
  // `average_entry_score` on the event — so each week's field luck is that
  // week's score against that week's published average, never one average
  // smeared across all of them.
  const avgByGw = new Map(boot.events.map((e) => [e.id, e.average_entry_score]));

  // One live feed per week, bounded concurrency, failures dropped.
  type WeekFeed = {
    c: (typeof wanted)[number];
    live: Awaited<ReturnType<typeof getLive>> | null;
  };
  const weekFeeds = await mapPool(
    wanted,
    4,
    async (c): Promise<WeekFeed> => ({ c, live: await getLive(c.event) }),
    (c): WeekFeed => ({ c, live: null }),
  );

  const lines: GwLine[] = [];
  const missedWeeks: number[] = [];
  for (const { c, live } of weekFeeds) {
    if (!live) {
      missedWeeks.push(c.event);
      continue;
    }
    // This week's picks are not in the history payload — FPL publishes only
    // the current week's. The picks endpoint is cached per week, so reading
    // past weeks is one upstream call each, same as the live feed.
    const picks = await getPicks(entryId, c.event, true).catch(() => null);
    if (!picks) {
      missedWeeks.push(c.event);
      continue;
    }
    const statsByElement = new Map<number, (typeof live.elements)[number]["stats"]>(
      live.elements.map((el) => [el.id, el.stats]),
    );
    const posOf = (element: number): Pos =>
      (boot.elements[element]?.element_type ?? 3) as Pos;

    const pickedStats = picks.picks
      .filter((p) => p.position <= 11)
      .map((p) => {
        const s = statsByElement.get(p.element);
        return {
          element: p.element,
          pos: posOf(p.element),
          multiplier: p.multiplier,
          minutes: s?.minutes ?? 0,
          points: s?.total_points ?? 0,
          goals: s?.goals_scored ?? 0,
          assists: s?.assists ?? 0,
          xg: s?.expected_goals ?? 0,
          xa: s?.expected_assists ?? 0,
          bonus: s?.bonus ?? 0,
          bps: s?.bps ?? 0,
        };
      });

    lines.push({
      gw: c.event,
      points: c.points,
      benchPoints: c.points_on_bench,
      transfersCost: c.event_transfers_cost,
      chip: history.chips.find((ch) => ch.event === c.event)?.name ?? null,
      pickedStats,
      fieldAvg: avgByGw.get(c.event) ?? null,
    });
  }

  const shapley = shapleyLedger(ledgerDecisions(lines), { orderings: 400, seed: 2026 });
  const luck = seasonLuck(lines, scoring);

  // True-form ribbons for the current squad — the players the manager owns
  // now, not the ones a past week's picks carried.
  const squadIds =
    picksRes.status === "fulfilled"
      ? picksRes.value.picks.slice(0, RIBBON_LIMIT).map((p) => p.element)
      : [];

  const ribbonRaw = await mapPool(
    squadIds,
    4,
    async (element) => {
      const [summary, bootNow] = await Promise.all([getElementSummary(element), getBootstrapLite()]);
      const el = bootNow.elements[element];
      const recent = [...summary.history].sort((a, b) => a.round - b.round).slice(-12);
      if (recent.length < 4 || !el) return null;
      const series = formSeries(recent);
      const state = trueForm(series);
      return {
        element,
        name: el.web_name,
        pos: el.element_type,
        points: state.filtered.map((f, i) => ({
          round: recent[i]!.round,
          ability: Number(f.ability.toFixed(3)),
          sd: Number(f.sd.toFixed(3)),
        })),
        current: {
          ability: Number(state.ability.toFixed(3)),
          sd: Number(Math.sqrt(state.variance).toFixed(3)),
        },
        reliable: true,
      };
    },
    () => null,
  );

  const ribbons = ribbonRaw.filter((r): r is NonNullable<typeof r> => r != null);

  return {
    currentGw,
    gws: lines.map((l) => l.gw),
    ledger: {
      lines: [...shapley.attributions.entries()]
        .map(([key, value]) => ({ key, value, se: shapley.standardErrors.get(key) ?? 0 }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
      total: shapley.totalAttributed,
      orderings: shapley.orderings,
    },
    luck: {
      finishingLuck: luck.finishingLuck,
      creationLuck: luck.creationLuck,
      fieldLuck: luck.fieldLuck,
      advice: adviceFor(luck),
    },
    ribbons,
    missedWeeks,
  };
}

/** The advice lines, mirroring processVsOutcome's thresholds without
    importing it — this page's channels differ (no bonus, no minutes), so the
    advice is shaped here from the same thresholds rather than forced through
    an engine whose zeroed channels would say nothing. */
function adviceFor(luck: { finishingLuck: number; creationLuck: number; fieldLuck: number }): string[] {
  const advice: string[] = [];
  if (Math.abs(luck.finishingLuck) > 12) {
    advice.push(
      luck.finishingLuck < 0
        ? "Finishing has run cold against the chances all season — historically reverts; judge the players, not the points."
        : "Finishing has run hot against the chances — bank the form sceptically; it regresses.",
    );
  }
  if (Math.abs(luck.creationLuck) > 12) {
    advice.push(
      luck.creationLuck < 0
        ? "Creation is behind its expectation — the chances are being made and missed. That is the cheaper side to own."
        : "Creation is ahead of its expectation — the assists are coming from somewhere real.",
    );
  }
  if (Math.abs(luck.fieldLuck) > 25) {
    advice.push(
      luck.fieldLuck < 0
        ? "You have trailed the field average across these weeks — that is a process question, not variance."
        : "You have beaten the field average across these weeks — sustain it by the same process, not the same luck.",
    );
  }
  return advice;
}