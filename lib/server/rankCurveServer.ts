import "server-only";
import { cached } from "@/lib/cache/swr";
import { getStandings } from "@/lib/fpl/endpoints";
import { buildRankCurve, type RankCurve } from "@/lib/engines/rankModel";

/** The cohort mini-league — one constant; the rival-name resolver reads it too. */
export const COHORT_LEAGUE_ID = 314;
const LEAGUE_314 = COHORT_LEAGUE_ID;
/** Kept modest to stay a good citizen; log-spacing keeps coverage across the field. */
const PAGE_BUDGET = 24;
/**
 * Pages in flight at once.
 *
 * These used to go one at a time with a 120ms sleep between them: twenty-seven
 * round trips in series, which on a cold cache is ten to twenty seconds of a
 * user staring at a skeleton. Four at a time is still polite to the upstream —
 * it is fewer concurrent requests than a browser opens to load one page — and
 * turns the wait into seven waves instead of twenty-seven.
 */
const CONCURRENCY = 4;

export interface RankCurveBundle {
  curve: RankCurve | null;
  fieldAvg: number;
  fieldSd: number;
  sampleSize: number;
}

export const getRankCurveBundle = (gw: number) =>
  cached<RankCurveBundle>(`gaffer:rankcurve:${gw}`, "rankCurve", async () => {
    try {
      const pages = logSpacedPages(PAGE_BUDGET);
      const samples: { rank: number; total: number }[] = [];
      const eventTotals: number[] = [];

      for (let i = 0; i < pages.length; i += CONCURRENCY) {
        const batch = pages.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(batch.map((page) => getStandings(LEAGUE_314, page)));
        for (const res of results) {
          // a single page failing must not kill the curve
          if (res.status !== "fulfilled") continue;
          for (const r of res.value.standings.results) {
            samples.push({ rank: r.rank, total: r.total });
            eventTotals.push(r.event_total ?? 0);
          }
        }
      }

      if (samples.length < 10) {
        return { curve: null, fieldAvg: mean(eventTotals), fieldSd: sd(eventTotals), sampleSize: samples.length };
      }

      return {
        curve: buildRankCurve(samples),
        fieldAvg: Math.round(mean(eventTotals)),
        fieldSd: Math.round(sd(eventTotals)),
        sampleSize: samples.length,
      };
    } catch {
      return { curve: null, fieldAvg: 0, fieldSd: 0, sampleSize: 0 };
    }
  });

/** Dense at the head (where users live), log-spaced out to ~9M managers. */
function logSpacedPages(count: number): number[] {
  const MAX_PAGE = 180_000;
  const set = new Set<number>([1, 2, 3]);
  for (let i = 1; i <= count; i++) {
    set.add(Math.min(MAX_PAGE, Math.max(1, Math.round(Math.pow(MAX_PAGE, i / count)))));
  }
  return [...set].sort((a, b) => a - b);
}

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}
