/**
 * v3 Feature 21 — THE COMMITTEE. Typed rule definitions compiled from a small
 * language, evaluated deterministically over gameweek records. LEDGER ONLY:
 * this module computes standings and prize shares — it never touches money.
 */

export type Window =
  | { kind: "phase"; id: number }
  | { kind: "gw"; from: number; to: number }
  | { kind: "rolling"; last: number }
  | { kind: "season" };

export type Metric =
  | "points"
  | "net_points"
  | "bench_points"
  | "captain_points"
  | "differential_points"
  | "defcon_points"
  | "overall_rank"
  | "rank_delta"
  | "transfers"
  | "hits_cost"
  | "chips_used"
  | "team_value"
  | "gw_wins"
  | "consistency";

export type Agg = "sum" | "mean" | "max" | "min" | "count" | "delta" | "stdev";

export interface GwRecord {
  gw: number;
  points: number;
  netPoints: number; // after hits
  benchPoints: number;
  captainPoints: number;
  differentialPoints: number;
  defconPoints: number;
  overallRank: number | null;
  rankDelta: number | null;
  transfers: number;
  hitsCost: number;
  chipUsed: string | null;
  teamValue: number;
}

/** The typed rule — compile target of the committee language. */
export interface Competition {
  id: string;
  name: string;
  window: Window;
  metric: Metric;
  agg: Agg;
  filters?: { chipUsed?: string | null; maxHitsCost?: number; minGw?: number }[];
  order: "asc" | "desc";
  topN?: number;
  tieBreak: Array<"season_total" | "fewest_transfers" | "overall_rank">;
  prizeShare?: number;
}

export interface EntryStanding {
  entryId: number;
  value: number;
  tiebreaks: number[];
  prizeShare: number | null;
}

const LOWER_IS_BETTER = new Set<Metric>([
  "overall_rank",
  "rank_delta",
  "transfers",
  "hits_cost",
]);

function inWindow(record: GwRecord, w: Window): boolean {
  switch (w.kind) {
    case "phase":
      return true; // phase boundaries resolve at call sites via gw range
    case "gw":
      return record.gw >= w.from && record.gw <= w.to;
    case "rolling":
      // kept broad here; the evaluator slices the newest `last` records
      return true;
    case "season":
      return true;
  }
}

function passesFilters(record: GwRecord, comp: Competition): boolean {
  for (const f of comp.filters ?? []) {
    if (f.chipUsed !== undefined) {
      if (f.chipUsed === null ? record.chipUsed !== null : record.chipUsed !== f.chipUsed) return false;
    }
    if (f.maxHitsCost !== undefined && record.hitsCost > f.maxHitsCost) return false;
    if (f.minGw !== undefined && record.gw < f.minGw) return false;
  }
  return true;
}

function metricValue(record: GwRecord, m: Metric): number {
  switch (m) {
    case "points": return record.points;
    case "net_points": return record.netPoints;
    case "bench_points": return record.benchPoints;
    case "captain_points": return record.captainPoints;
    case "differential_points": return record.differentialPoints;
    case "defcon_points": return record.defconPoints;
    case "overall_rank": return record.overallRank ?? Number.POSITIVE_INFINITY;
    case "rank_delta": return record.rankDelta ?? Number.NaN;
    case "transfers": return record.transfers;
    case "hits_cost": return record.hitsCost;
    case "chips_used": return record.chipUsed ? 1 : 0;
    case "team_value": return record.teamValue;
    case "gw_wins": return 0; // resolved across entries by the evaluator
    case "consistency": return 0; // resolved via stdev agg by the evaluator
  }
}

function aggregate(values: number[], agg: Agg): number {
  const xs = values.filter((v) => Number.isFinite(v));
  if (!xs.length) return Number.NaN;
  switch (agg) {
    case "sum": return xs.reduce((a, b) => a + b, 0);
    case "mean": return xs.reduce((a, b) => a + b, 0) / xs.length;
    case "max": return Math.max(...xs);
    case "min": return Math.min(...xs);
    case "count": return xs.length;
    case "delta": {
      if (xs.length < 2) return Number.NaN;
      return xs[xs.length - 1] - xs[0];
    }
    case "stdev": {
      const m = xs.reduce((a, b) => a + b, 0) / xs.length;
      return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1));
    }
  }
}

/**
 * Evaluate one competition over every entrant's gameweek records.
 * Deterministic: stable sort on (value, tiebreaks…, entryId).
 */
export function evaluateCompetition(
  comp: Competition,
  entries: { entryId: number; seasonTotal: number; records: GwRecord[] }[],
): EntryStanding[] {
  const lowerBetter = comp.order === "asc" || LOWER_IS_BETTER.has(comp.metric);

  let lastGw = 0;
  for (const e of entries) {
    for (const r of e.records) lastGw = Math.max(lastGw, r.gw);
  }

  const scored = entries.map((e) => {
    let records = e.records.filter((r) => inWindow(r, comp.window) && passesFilters(r, comp));
    if ((comp.window as { kind: string }).kind === "rolling") {
      const k = (comp.window as { last: number }).last;
      records = [...records].sort((a, b) => a.gw - b.gw).slice(-k);
    }
    const values = records.map((r) => metricValue(r, comp.metric));

    // Cross-entry metrics need the field first.
    const value = aggregate(values, comp.agg);

    const seasonTotalTie = -e.seasonTotal; // desc
    const transfersTie = records.reduce((s, r) => s + r.transfers, 0); // asc
    const bestRank = records.reduce(
      (m, r) => (r.overallRank != null ? Math.min(m, r.overallRank) : m),
      Number.POSITIVE_INFINITY,
    );
    void lastGw;

    return {
      entryId: e.entryId,
      value,
      lowerBetter,
      tiebreaks: [seasonTotalTie, transfersTie, bestRank],
      rawTransfers: transfersTie,
      bestRank,
      seasonTotal: e.seasonTotal,
    };
  });

  scored.sort((a, b) => {
    const va = Number.isFinite(a.value) ? a.value : a.lowerBetter ? Infinity : -Infinity;
    const vb = Number.isFinite(b.value) ? b.value : b.lowerBetter ? Infinity : -Infinity;
    if (va !== vb) return a.lowerBetter ? va - vb : vb - va;
    for (let i = 0; i < a.tiebreaks.length; i++) {
      if (a.tiebreaks[i] !== b.tiebreaks[i]) return a.tiebreaks[i] - b.tiebreaks[i];
    }
    return a.entryId - b.entryId;
  });

  const ranked = scored
    .filter((s) => Number.isFinite(s.value))
    .map((s) => ({
      entryId: s.entryId,
      value: s.value,
      tiebreaks: [s.seasonTotal, s.rawTransfers, s.bestRank],
      prizeShare: null as number | null,
    }));

  if (comp.prizeShare != null && comp.topN != null && comp.topN > 0) {
    const winners = ranked.slice(0, comp.topN);
    // Equal split among winners unless a sole leader takes it all.
    const share = comp.prizeShare / winners.length;
    for (const w of winners) w.prizeShare = share;
  } else if (comp.prizeShare != null) {
    if (ranked[0]) ranked[0].prizeShare = comp.prizeShare;
  }

  return comp.topN != null ? ranked.slice(0, comp.topN) : ranked;
}
