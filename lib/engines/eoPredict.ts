/**
 * eoPredict — deadline effective ownership, predicted (v10 D3).
 *
 * "Who is everyone going to own by Friday?" The current ownership figure
 * answers who owns him now; the transfers since — velocity — say where it
 * is going; a news spike says attention just arrived. This model combines
 * the three into a deadline EO with a confidence band, and refuses (grey
 * "—" with the reason) when snapshot coverage is too thin to read velocity
 * from — the same gate and the same honesty as the price model in
 * lib/engines/price.ts, which reads the same snapshots.
 *
 * What this is NOT: a fitted regression. There is no stored history of
 * predicted-vs-actual deadline EO to calibrate against, so the coefficients
 * are stated heuristics, not estimates — and the band is sized to say so.
 * A point estimate with no error bars is the competition's habit, not ours.
 *
 * Pure functions only — composition happens on the server.
 */
import { velocitySeries, type PriceSnapshot } from "@/lib/engines/price";

export interface EoPredictInput {
  element: number;
  /** FPL-published ownership now — the anchor everything adjusts. */
  ownedNow: number;
  /** Stored hourly transfer snapshots, oldest first. */
  snapshots: PriceSnapshot[];
  /** Recent news items tagging this player — attention arriving. */
  newsTags: number;
  /** Hours until the deadline; zero or less means it has passed. */
  hoursToDeadline: number;
  /** Total managers in the game (bootstrap total_players) — the denominator
      that turns transfer counts into ownership points. */
  totalManagers: number;
}

export interface EoPrediction {
  element: number;
  /** Predicted EO at the deadline, in percent. Equals ownedNow when the
      model refuses — the only honest number left — with covered=false. */
  predicted: number;
  /** Confidence band, in percent. Wide on purpose: the coefficients are
      stated, not fitted. */
  low: number;
  high: number;
  /** False when snapshot coverage is too thin for velocity — the UI shows
      "—" with `reason`, never a dressed-up zero. */
  covered: boolean;
  /** True when covered but the read is fragile — the UI mutes the figure
      and names the reason beside it. */
  thin: boolean;
  /** Stated reason when covered=false or thin=true, null otherwise. */
  reason: string | null;
}

/** The same coverage gate as the price model: fewer than two snapshots is
    no velocity at all, not a quiet one. */
export const EO_MIN_SNAPSHOTS = 2;
/** Below this many snapshots, or this short a span, the read is fragile. */
export const EO_THIN_SNAPSHOTS = 4;
export const EO_THIN_SPAN_HOURS = 12;

/** Ownership points per tagged news item, capped — attention moves transfers,
    but a rumour is not a readout. Stated, not fitted. */
export const EO_NEWS_PP = 0.05;
export const EO_NEWS_CAP = 6;

/** Band sizing, in ownership points. Base doubt, plus velocity doubt, plus
    a widening per day of horizon — further out is less certain, stated. */
const BAND_BASE_PP = 0.3;
const BAND_PER_10K_DAILY_NET_PP = 0.2;
const BAND_PER_DAY_HORIZON_PP = 0.1;

export const EO_PREDICT_METHOD =
  "Deadline EO from transfer velocity over the trailing day, projected over the hours left and turned into ownership points against the game's manager count, plus a capped bump per recent news tag. Coefficients stated, not fitted — the band is the honest part.";

const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function predictDeadlineEO(input: EoPredictInput): EoPrediction {
  const { element, ownedNow, newsTags, hoursToDeadline, totalManagers } = input;
  const snapshots = [...input.snapshots].sort(
    (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime(),
  );

  if (snapshots.length < EO_MIN_SNAPSHOTS) {
    return {
      element,
      predicted: round1(ownedNow),
      low: round1(ownedNow),
      high: round1(ownedNow),
      covered: false,
      thin: false,
      reason: "No stored snapshot history for this player yet — the hourly ingest has not covered him.",
    };
  }

  // Trailing-day net transfers — the same window the price model reads, so
  // the two boards can never disagree about which way the traffic runs.
  const deltas = velocitySeries(snapshots, snapshots[snapshots.length - 1]!.capturedAt);
  const dailyNet = deltas.reduce((s, d) => s + d, 0);

  const daysLeft = Math.max(0, hoursToDeadline / 24);
  // Projected transfers before the deadline, as ownership points: the count
  // over the manager base, times a hundred. 50k net a day for three days at
  // eleven million managers is about a point and a third — the right order.
  const velocityDelta =
    totalManagers > 0 ? ((dailyNet * daysLeft) / totalManagers) * 100 : 0;
  const newsBump = Math.min(Math.max(0, newsTags), EO_NEWS_CAP) * EO_NEWS_PP;

  const predicted = round1(clamp(ownedNow + velocityDelta + newsBump, 0, 100));

  const spanHours =
    (snapshots[snapshots.length - 1]!.capturedAt.getTime() - snapshots[0]!.capturedAt.getTime()) / 3_600_000;
  const thin = snapshots.length < EO_THIN_SNAPSHOTS || spanHours < EO_THIN_SPAN_HOURS;

  const halfWidth =
    BAND_BASE_PP +
    (Math.abs(dailyNet) / 10_000) * BAND_PER_10K_DAILY_NET_PP +
    daysLeft * BAND_PER_DAY_HORIZON_PP +
    (thin ? BAND_BASE_PP : 0);

  return {
    element,
    predicted,
    low: round1(clamp(predicted - halfWidth, 0, 100)),
    high: round1(clamp(predicted + halfWidth, 0, 100)),
    covered: true,
    thin,
    reason: thin
      ? `Only ${snapshots.length} snapshots over ${Math.max(1, Math.round(spanHours))}h — the velocity read is fragile, so the band is wide.`
      : null,
  };
}
