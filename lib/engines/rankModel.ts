export interface RankCurvePoint {
  rank: number;
  total: number;
}

export interface RankCurve {
  points: RankCurvePoint[];
  population: number;
}

export function buildRankCurve(samples: { rank: number; total: number }[]): RankCurve {
  const points = samples
    .filter((s) => Number.isFinite(s.rank) && Number.isFinite(s.total) && s.total >= 0)
    .sort((a, b) => a.rank - b.rank);
  const deduped: RankCurvePoint[] = [];
  for (const p of points) {
    const prev = deduped[deduped.length - 1];
    if (!prev || p.total < prev.total) deduped.push(p);
  }
  // DECISION: linear interpolation on log10(rank) — with ~120 log-spaced samples
  // this is within sampling noise of PCHIP while staying strictly monotone.
  return { points: deduped, population: points.length };
}

const log = (n: number) => Math.log10(Math.max(1, n));

export function rankForTotal(curve: RankCurve, total: number): number {
  const pts = curve.points;
  if (pts.length === 0) return 0;
  if (total >= pts[0].total) return pts[0].rank;

  for (let i = 1; i < pts.length; i++) {
    const hi = pts[i];
    const lo = pts[i - 1];
    if (total >= hi.total) {
      const t = (total - hi.total) / (lo.total - hi.total);
      const logRank = log(hi.rank) + t * (log(lo.rank) - log(hi.rank));
      return Math.round(Math.pow(10, logRank));
    }
  }
  return pts[pts.length - 1].rank;
}

/** Ranks gained per extra point at this total — central difference over ±2, floored at 1. */
export function ranksPerPoint(curve: RankCurve, total: number): number {
  const hi = rankForTotal(curve, total + 2);
  const lo = rankForTotal(curve, total - 2);
  return Math.max(1, (lo - hi) / 4);
}

export interface LiveRankInput {
  curve: RankCurve;
  yourPreTotal: number;
  yourLiveGwScore: number;
  fieldLiveAverage: number;
  fieldLiveSd: number;
  minutesRemainingFraction: number;
}

export function liveRank(input: LiveRankInput): { rank: number; confidence: "high" | "medium" | "low" } {
  const excess = input.yourLiveGwScore - input.fieldLiveAverage;
  const spreadAdj = 1 + Math.min(0.35, input.fieldLiveSd / 40);
  const adjusted = rankForTotal(input.curve, input.yourPreTotal + excess / spreadAdj);
  const frac = input.minutesRemainingFraction;
  const confidence = frac < 0.15 ? "high" : frac < 0.5 ? "medium" : "low";
  return { rank: adjusted, confidence };
}
