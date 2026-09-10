/**
 * career — the seasons before this one, and what can honestly be said about them.
 *
 * FPL's `/entry/{id}/history/` returns a `past` array of exactly three fields
 * per season: the name, the total, the final overall rank. No squads, no
 * transfers, no chip timing, no per-gameweek breakdown — all of that is
 * discarded at the rollover and cannot be fetched back at any price.
 *
 * That bounds this engine hard, and the boundary is worth stating because the
 * obvious feature request is "what can I learn from last season". A lesson
 * needs a cause. Only outcomes survive, so this reports the record — how you
 * did, and whether you are getting better — and does not pretend to explain
 * it. Anything that claimed to would be inventing the reason.
 *
 * Rank, not points, is the axis for every comparison. Points totals drift
 * with scoring-rule changes and with how generous a season's fixtures were;
 * a rank is a position against everyone who played the same season, which is
 * the only thing that means the same in 2023/24 as in 2025/26.
 */

export interface PastSeason {
  season_name: string;
  total_points: number;
  rank: number;
}

export interface SeasonRecord {
  season: string;
  points: number;
  rank: number;
  /**
   * Rank change from the season before it — negative is an improvement,
   * because a smaller rank is a better one. Null for the earliest on record.
   */
  rankDelta: number | null;
  pointsDelta: number | null;
  /** Total over a 38-gameweek season. See the caveat on `assumesFullSeason`. */
  pointsPerGw: number;
}

export interface CareerReport {
  /** Oldest first, so the list reads as a career rather than a leaderboard. */
  seasons: SeasonRecord[];
  best: SeasonRecord | null;
  worst: SeasonRecord | null;
  /**
   * The direction of travel, by rank.
   *
   * Only claimed with three seasons or more. Two points make a line through
   * anything, and calling one better year "improving" is the kind of reading
   * that sounds insightful and predicts nothing. With two the app states the
   * movement and stops there.
   */
  trend: "improving" | "declining" | "steady" | "too-few";
  /** Median rank across the record — a fairer centre than the mean when one
   *  season was a disaster. */
  medianRank: number | null;
  /**
   * A per-gameweek total assumes the manager played all 38. Somebody who
   * joined in December has a small total and a poor rank for a reason this
   * data cannot show, so the figure is flagged rather than quietly wrong.
   */
  assumesFullSeason: true;
}

const GWS_PER_SEASON = 38;
/** Below this many seasons, a direction of travel is a story, not a finding. */
export const TREND_MIN_SEASONS = 3;
/** Rank moves smaller than this are noise at the top of a nine-million field. */
export const STEADY_BAND = 0.1;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Season names sort lexically in FPL's own format ("2023/24" < "2024/25"),
 * which is the same as chronological order. Relying on the array's order
 * would trust an upstream that has never promised one.
 */
function chronological(past: PastSeason[]): PastSeason[] {
  return [...past].sort((a, b) => a.season_name.localeCompare(b.season_name));
}

export function buildCareer(past: PastSeason[]): CareerReport {
  const ordered = chronological(past).filter(
    (s) => Number.isFinite(s.total_points) && Number.isFinite(s.rank) && s.rank > 0,
  );

  const seasons: SeasonRecord[] = ordered.map((s, i) => {
    const prev = i > 0 ? ordered[i - 1] : null;
    return {
      season: s.season_name,
      points: s.total_points,
      rank: s.rank,
      rankDelta: prev ? s.rank - prev.rank : null,
      pointsDelta: prev ? s.total_points - prev.total_points : null,
      pointsPerGw: round1(s.total_points / GWS_PER_SEASON),
    };
  });

  if (seasons.length === 0) {
    return { seasons, best: null, worst: null, trend: "too-few", medianRank: null, assumesFullSeason: true };
  }

  const byRank = [...seasons].sort((a, b) => a.rank - b.rank);
  const best = byRank[0];
  const worst = byRank[byRank.length - 1];

  const ranks = seasons.map((s) => s.rank).sort((a, b) => a - b);
  const mid = Math.floor(ranks.length / 2);
  const medianRank =
    ranks.length % 2 === 1 ? ranks[mid] : Math.round((ranks[mid - 1] + ranks[mid]) / 2);

  return { seasons, best, worst, trend: trendOf(seasons), medianRank, assumesFullSeason: true };
}

function trendOf(seasons: SeasonRecord[]): CareerReport["trend"] {
  if (seasons.length < TREND_MIN_SEASONS) return "too-few";
  const first = seasons[0].rank;
  const last = seasons[seasons.length - 1].rank;
  // Proportional, not absolute: 200,000 places is a transformation at the top
  // of the table and a rounding error at the bottom of it.
  const change = (last - first) / first;
  if (Math.abs(change) < STEADY_BAND) return "steady";
  return change < 0 ? "improving" : "declining";
}

/**
 * This season's pace against the record.
 *
 * Compared per gameweek rather than on totals, because eight gameweeks into a
 * season a total says only that the season is young. Returned as null until
 * there is enough of it to mean anything — the first two weeks of a season
 * are variance with a scoreboard attached.
 */
export const PACE_MIN_GWS = 5;

export interface CareerPace {
  pointsPerGw: number;
  gwsPlayed: number;
  /** Against the best season on record, per gameweek. */
  vsBest: number;
  /** Against the median season on record, per gameweek. */
  vsMedian: number;
}

export function careerPace(
  report: CareerReport,
  thisSeason: { points: number; gwsPlayed: number },
): CareerPace | null {
  if (report.seasons.length === 0) return null;
  if (thisSeason.gwsPlayed < PACE_MIN_GWS) return null;

  const rate = thisSeason.points / thisSeason.gwsPlayed;
  const rates = report.seasons.map((s) => s.pointsPerGw).sort((a, b) => a - b);
  const bestRate = Math.max(...rates);
  const mid = Math.floor(rates.length / 2);
  const medianRate =
    rates.length % 2 === 1 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2;

  return {
    pointsPerGw: round1(rate),
    gwsPlayed: thisSeason.gwsPlayed,
    vsBest: round1(rate - bestRate),
    vsMedian: round1(rate - medianRate),
  };
}
