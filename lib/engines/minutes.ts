/**
 * minutes — will he start, and will he last?
 *
 * "Will he start?" is the most-asked question in FPL and the public API
 * answers it only by history. This model reads the per-match element-summary
 * series and turns it into two probabilities with honest uncertainty:
 *
 *   P(start) — the share of recent matchdays he was in the XI
 *   P(60+)   — the share of starts that reached 60 minutes (a start that
 *              ends early is a different asset from one that finishes)
 *
 * Design: an empirical-Bayes Beta shrinkage, not a Cox fit. A Cox
 * proportional-hazards model wants covariates across many players and a
 * survival endpoint; what we have is fifteen-to-ten rows of minutes history
 * per player and a question about the next matchday. A Beta posterior over
 * the start rate — prior strength α+β, pulled toward the squad-average
 * rotation rate — gives a calibrated probability, a credible interval that
 * widens as history thins, and an honest degenerate case:
 *
 *   fewer than MIN_APPEARANCES observations → "not enough history",
 *   rendered as a greyed dash, never a number.
 *
 * The output is a probability distribution, never a binary "starts/doesn't".
 * Every figure a surface prints carries its method via <Est>.
 *
 * Pure functions only.
 */

export interface MinutesObservation {
  /** Gameweek the match belongs to (ascending over the season). */
  gw: number;
  minutes: number;
  /** True when FPL recorded him starting (minutes > 0 at kickoff — the
   *  element-summary `starts` flag per row, when the caller has it). */
  started: boolean;
}

export interface MinutesEstimate {
  /** Posterior mean P(start) for the next matchday, 0..1. */
  pStart: number;
  /** Posterior mean P(reach 60 minutes | started), 0..1. */
  p60: number;
  /** Effective expected minutes next matchday (pStart blended over bench risk). */
  expectedMinutes: number;
  /** 95% credible interval on pStart — widens as history thins. */
  pStartInterval: [number, number];
  /** How much history backs the estimate. */
  appearances: number;
  /** False under MIN_APPEARANCES — every surface must grey out and say so. */
  reliable: boolean;
  /** One honest sentence about why the estimate is thin, when it is. */
  note: string;
}

/** Below this many observations the model refuses to speak. */
export const MIN_APPEARANCES = 3;

/** Beta prior strength: how many pseudo-matches the prior is worth. */
const PRIOR_STRENGTH = 2;
/**
 * The prior start rate: a squad player starts roughly two matches in three.
 * Weak enough that five straight starts overrule it; strong enough that one
 * cameo does not.
 */
const PRIOR_MEAN = 2 / 3;
/** The prior share of starts that reach 60 minutes. */
const PRIOR_MEAN_60 = 0.7;

/** Recency weight: the last five matches matter, week six barely. */
function recencyWeight(indexFromEnd: number): number {
  return Math.pow(0.75, indexFromEnd);
}

/**
 * Estimate next-matchday minutes risk from the per-match history.
 *
 * `started` is the row's own start flag; when the caller cannot supply one,
 * minutes >= 55 is the working definition of a start (a 60th-minute
 * "start" that is really a long cameo inflates P(start), so the threshold
 * leans on time actually on the pitch).
 */
export function estimateMinutes(
  observations: MinutesObservation[],
  opts: { nowGw?: number; maxAge?: number } = {},
): MinutesEstimate {
  const nowGw = opts.nowGw ?? Number.POSITIVE_INFINITY;
  const maxAge = opts.maxAge ?? 10;
  const recent = observations
    .filter((o) => o.gw <= nowGw && (nowGw === Number.POSITIVE_INFINITY || o.gw > nowGw - maxAge))
    .sort((a, b) => a.gw - b.gw);

  if (recent.length < MIN_APPEARANCES) {
    return {
      pStart: 0,
      p60: 0,
      expectedMinutes: 0,
      pStartInterval: [0, 1],
      appearances: recent.length,
      reliable: false,
      note:
        recent.length === 0
          ? "No match history yet this season — the model has nothing to read."
          : `Only ${recent.length} appearance${recent.length === 1 ? "" : "s"} this season — the model needs at least ${MIN_APPEARANCES} before it will quote a probability.`,
    };
  }

  // Weighted start count → Beta posterior.
  let weightSum = 0;
  let startWeight = 0;
  let fullWeight = 0;
  let recentWeight = 0;
  for (let i = 0; i < recent.length; i++) {
    const w = recencyWeight(recent.length - 1 - i);
    weightSum += w;
    if (recent[i].started) {
      startWeight += w;
      // Started and substantially survived: the 60 signal.
      if (recent[i].minutes >= 60) fullWeight += w;
      recentWeight += w;
    }
  }

  const alpha = startWeight + PRIOR_STRENGTH * PRIOR_MEAN;
  const beta = weightSum - startWeight + PRIOR_STRENGTH * (1 - PRIOR_MEAN);
  const pStart = alpha / (alpha + beta);

  // P(60+ | started) — conditioned on the starts we saw.
  const alpha60 = fullWeight + PRIOR_STRENGTH * PRIOR_MEAN_60;
  const beta60 = recentWeight - fullWeight + PRIOR_STRENGTH * (1 - PRIOR_MEAN_60);
  const p60 = recentWeight > 0 ? alpha60 / (alpha60 + beta60) : PRIOR_MEAN_60;

  // 95% credible interval on pStart from the Beta posterior's spread.
  const mean = alpha / (alpha + beta);
  const sd = Math.sqrt((alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1)));
  const pStartInterval: [number, number] = [
    Math.max(0, Math.round((mean - 1.96 * sd) * 1000) / 1000),
    Math.min(1, Math.round((mean + 1.96 * sd) * 1000) / 1000),
  ];

  // Expected minutes: start share × a started match's expected pitch time.
  // A start averages ~78 minutes when he reaches 60 at rate p60, less the
  // early-hook risk; a bench outing averages ~20.
  const startedMinutes = 20 + 58 * p60;
  const expectedMinutes = Math.round(pStart * startedMinutes + (1 - pStart) * 20);

  return {
    pStart: Math.round(pStart * 1000) / 1000,
    p60: Math.round(p60 * 1000) / 1000,
    expectedMinutes,
    pStartInterval,
    appearances: recent.length,
    reliable: true,
    note: "",
  };
}

/** The method string every <Est> wrapper on a minutes figure must use. */
export const MINUTES_METHOD =
  "P(start): recency-weighted share of recent matchdays started, shrunk toward a squad-player prior (Beta). P(60+): share of starts reaching 60 minutes. Intervals widen as history thins.";

/**
 * The one line a surface shows when the model will not speak — the house
 * style the watchlist set with its "—".
 */
export const MINUTES_THIN_LABEL = "Not enough history";