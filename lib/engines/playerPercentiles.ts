import type { ElementLite } from "@/lib/fpl/bootstrapLite";

/**
 * A player's season read against his position's peers.
 *
 * The comparison is the point. "0.21 expected assists" means nothing on its own
 * — it is good for a centre-half and thin for a playmaker — so every figure is
 * ranked against players in the same position who have played enough football
 * to be worth comparing to. A bar without a cohort behind it is decoration.
 *
 * What this deliberately does NOT contain: line-breaking passes, pass
 * completion, long balls, crosses, chances created. Those come from Opta's
 * feed, which FPL does not publish and we do not buy. Inventing them from what
 * we do have would produce numbers that look authoritative and are made up.
 * Everything below is a figure FPL publishes, or an arithmetic combination of
 * figures FPL publishes.
 */

/** ratePer90 is a per-90 figure shown as a percentage — see the clean-sheet note. */
export type StatUnit = "per90" | "season" | "percent" | "ratePer90";

export interface StatDef {
  key: string;
  label: string;
  unit: StatUnit;
  /** Season total, before any per-90 conversion. Null when it does not apply. */
  total: (p: ElementLite) => number | null;
  /**
   * A high number is a bad thing — cards, goals conceded. The percentile is
   * inverted for these, so a full bar always means "good" and the panel can be
   * read at a glance without checking each label for its polarity.
   */
  lowerIsBetter?: boolean;
  decimals: number;
  hint: string;
  /** Which positions the row makes sense for. Empty means all. */
  positions?: number[];
}

export interface StatRow {
  key: string;
  label: string;
  value: number | null;
  display: string;
  /** 0–100 against the cohort, already inverted where lower is better. */
  percentile: number | null;
  hint: string;
  lowerIsBetter: boolean;
}

export interface StatGroup {
  title: string;
  rows: StatRow[];
}

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

/**
 * Where a value sits in a cohort, 0–100.
 *
 * Ties share a rank — the midpoint of the tied block — so twenty players on
 * zero assists all read the same, rather than one of them arbitrarily
 * outranking the other nineteen because of array order.
 */
export function percentileOf(value: number, pool: number[]): number | null {
  if (pool.length < MIN_COHORT) return null;
  let below = 0;
  let equal = 0;
  for (const v of pool) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return round(((below + equal / 2) / pool.length) * 100, 0);
}

/** Below this there is no cohort worth ranking against, and a bar would lie. */
export const MIN_COHORT = 5;

const per90 = (total: number, minutes: number): number | null =>
  minutes > 0 ? (total / minutes) * 90 : null;

export const STAT_GROUPS: { title: string; stats: StatDef[] }[] = [
  {
    title: "Attack",
    stats: [
      { key: "goals", label: "Goals", unit: "per90", decimals: 2, total: (p) => p.goals_scored, hint: "Goals per 90 minutes" },
      { key: "xg", label: "Expected goals", unit: "per90", decimals: 2, total: (p) => p.xgTotal, hint: "The chances he gets, per 90 — what an average finisher would score from them" },
      { key: "threat", label: "Threat", unit: "per90", decimals: 1, total: (p) => p.threat, hint: "FPL's own index of shot volume and quality, per 90" },
    ],
  },
  {
    title: "Creation",
    stats: [
      { key: "assists", label: "Assists", unit: "per90", decimals: 2, total: (p) => p.assists, hint: "Assists per 90 minutes" },
      { key: "xa", label: "Expected assists", unit: "per90", decimals: 2, total: (p) => p.xaTotal, hint: "The chances he creates, per 90 — what an average finisher would score from them" },
      { key: "creativity", label: "Creativity", unit: "per90", decimals: 1, total: (p) => p.creativity, hint: "FPL's own index of chance creation, per 90. The nearest public figure to 'chances created'" },
      { key: "xgi", label: "xGI", unit: "per90", decimals: 2, total: (p) => p.xgiTotal, hint: "Expected goals and assists together, per 90" },
    ],
  },
  {
    title: "Defence",
    stats: [
      { key: "defcon", label: "DEFCON", unit: "per90", decimals: 1, total: (p) => p.defcon, hint: "The stat FPL scores from: tackles, interceptions, clearances, blocks — and recoveries for a midfielder" },
      { key: "tackles", label: "Tackles", unit: "per90", decimals: 1, total: (p) => p.tackles, hint: "Tackles per 90" },
      { key: "cbi", label: "Clearances & blocks", unit: "per90", decimals: 1, total: (p) => p.cbi, hint: "Clearances, blocks and interceptions per 90" },
      { key: "recoveries", label: "Recoveries", unit: "per90", decimals: 1, total: (p) => p.recoveries, hint: "Ball recoveries per 90" },
          /*
       * Per ninety played, not per start.
       *
       * `cleanSheets / starts` looked right and is not: a clean sheet is
       * credited for sixty minutes, which a substitute can reach without
       * starting, so the ratio can exceed one — and then a genuine 100% ranks
       * *below* the impossible figures above it. Minutes are the honest
       * denominator, always defined, and the reading is the same one a person
       * wants: the share of a full match's worth of football that ended clean.
       */
      { key: "cleanSheets", label: "Clean sheets", unit: "ratePer90", decimals: 0, positions: [1, 2, 3], total: (p) => p.cleanSheets, hint: "Clean sheets per 90 minutes played, as a percentage — 40% is two clean sheets in five matches' worth of football" },
      { key: "conceded", label: "Goals conceded", unit: "per90", decimals: 2, lowerIsBetter: true, positions: [1, 2], total: (p) => p.goalsConceded, hint: "Goals conceded per 90 while he was on. Lower is better, so the bar is inverted" },
      { key: "saves", label: "Saves", unit: "per90", decimals: 1, positions: [1], total: (p) => p.saves, hint: "Saves per 90. Three saves score a point" },
    ],
  },
  {
    title: "Returns and risk",
    stats: [
      { key: "bonus", label: "Bonus", unit: "per90", decimals: 2, total: (p) => p.bonus, hint: "Bonus points per 90" },
      { key: "bps", label: "BPS", unit: "per90", decimals: 1, total: (p) => p.bps, hint: "Raw BPS per 90 — the score the 1·2·3 is awarded from" },
      { key: "points", label: "Points", unit: "per90", decimals: 2, total: (p) => p.total_points, hint: "FPL points per 90" },
      { key: "perMillion", label: "Points per £m", unit: "season", decimals: 1, total: (p) => (p.now_cost > 0 ? p.total_points / (p.now_cost / 10) : null), hint: "Season points divided by his price today" },
      { key: "cards", label: "Cards", unit: "per90", decimals: 2, lowerIsBetter: true, total: (p) => p.yellowCards + p.redCards, hint: "Bookings per 90. Lower is better, so the bar is inverted" },
    ],
  },
];

/** The figure a row shows, before ranking. Null when it cannot be computed. */
function valueOf(def: StatDef, p: ElementLite): number | null {
  const total = def.total(p);
  if (total == null) return null;
  if (def.unit === "per90") return per90(total, p.minutes);
  if (def.unit === "ratePer90") {
    const r = per90(total, p.minutes);
    return r == null ? null : r * 100;
  }
  return total;
}

export interface BuildInput {
  player: ElementLite;
  /** Everyone, including the player himself. Filtered internally. */
  all: ElementLite[];
  /** Ignore anyone under this many minutes — they have no comparable season. */
  minMinutes: number;
}

export interface PercentileRead {
  groups: StatGroup[];
  /** How many players the bars are ranked against. */
  cohortSize: number;
  minMinutes: number;
}

/**
 * Build the panel.
 *
 * The cohort is same-position and minutes-filtered, and the player is included
 * in it — ranking somebody against a pool he is absent from can put him above
 * the hundredth percentile, which is not a thing.
 */
export function buildPercentiles({ player, all, minMinutes }: BuildInput): PercentileRead {
  const cohort = all.filter(
    (p) => p.element_type === player.element_type && p.minutes >= minMinutes && p.status !== "u",
  );
  const withSelf = cohort.some((p) => p.id === player.id) ? cohort : [...cohort, player];

  const groups: StatGroup[] = [];
  for (const g of STAT_GROUPS) {
    const rows: StatRow[] = [];
    for (const def of g.stats) {
      if (def.positions && !def.positions.includes(player.element_type)) continue;
      const value = valueOf(def, player);
      if (value == null) continue;

      const pool = withSelf
        .map((p) => valueOf(def, p))
        .filter((v): v is number => v != null);
      const raw = percentileOf(value, pool);
      const percentile = raw == null ? null : def.lowerIsBetter ? 100 - raw : raw;

      rows.push({
        key: def.key,
        label: def.label,
        value: round(value, def.decimals),
        display:
          def.unit === "percent" || def.unit === "ratePer90"
            ? `${round(value, def.decimals).toFixed(def.decimals)}%`
            : round(value, def.decimals).toFixed(def.decimals),
        percentile,
        hint: def.hint,
        lowerIsBetter: def.lowerIsBetter === true,
      });
    }
    if (rows.length > 0) groups.push({ title: g.title, rows });
  }

  return { groups, cohortSize: withSelf.length, minMinutes };
}

/** Four bands, so the colour and the word always agree. */
export type Band = "elite" | "strong" | "average" | "poor";

export function bandOf(percentile: number): Band {
  if (percentile >= 80) return "elite";
  if (percentile >= 55) return "strong";
  if (percentile >= 30) return "average";
  return "poor";
}
