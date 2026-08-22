/**
 * v3 Tier C — better estimates of the player (features 6, 7, 8).
 *
 * 6 TRUE FORM — local-level Kalman filter over per-90 contribution; cameos
 *   discounted by minutes, absences grow uncertainty via process noise only.
 * 7 ROLE RADAR — Bayesian online changepoint detection (Adams–MacKay) on
 *   role streams; hazard H = 1/12; alert when P(run length < 2) > threshold.
 * 8 ENGINE TEMPERATURE — Cox-style proportional hazards score for rotation/
 *   injury risk from load covariates (partial likelihood with Breslow ties).
 */

import { mulberry32 } from "@/lib/engines/simulate";

// ── Feature 6: TRUE FORM ────────────────────────────────────────────────────

export interface FormObservation {
  /** Per-90 contribution rate observed in the match. */
  y90: number | null; // null → did not play
  minutes: number;
}

export interface KalmanState {
  ability: number;
  variance: number;
  filtered: { gwIndex: number; ability: number; sd: number }[];
}

/**
 * y_t = θ_t + ε, θ_{t+1} = θ_t + w — the standard local-level recursion.
 * Observations are shrunk toward 0 by minutes weight (cameos say little);
 * missing matches only add process noise so uncertainty widens during injury.
 */
export function trueForm(
  observations: FormObservation[],
  opts: { processVar?: number; obsVar?: number; prior?: number; priorVar?: number } = {},
): KalmanState {
  const q = opts.processVar ?? 0.02;
  const r = opts.obsVar ?? 0.25;
  let theta = opts.prior ?? 0.15;
  let p = opts.priorVar ?? 0.2;

  const filtered: KalmanState["filtered"] = [];
  observations.forEach((obs, i) => {
    p += q; // predict — uncertainty grows even without a match
    if (obs.y90 != null && obs.minutes > 0) {
      const w = Math.min(1, obs.minutes / 90); // cameo discount
      const rEff = r / Math.max(0.15, w);
      const k = p / (p + rEff);
      theta = theta + k * (obs.y90 - theta);
      p = (1 - k) * p;
    }
    filtered.push({ gwIndex: i, ability: theta, sd: Math.sqrt(p) });
  });

  return { ability: theta, variance: p, filtered };
}

// ── Feature 7: ROLE RADAR ───────────────────────────────────────────────────

export interface BocpdOptions {
  hazard?: number; // constant hazard H = 1/12 per spec
  maxRunLength?: number;
}

export interface BocpdPoint {
  /** Posterior over run lengths, sparse: runLength → probability. */
  runlengths: Map<number, number>;
  /** P(r < 2): the "something just changed" alarm. */
  probChangepoint: number;
  /** MAP estimate of current run length. */
  mapRunLength: number;
}

export function bocpd(
  stream: number[],
  opts: BocpdOptions = {},
): BocpdPoint[] {
  const H = opts.hazard ?? 1 / 12;
  const maxR = opts.maxRunLength ?? 60;
  // Observation noise from the median absolute successive difference —
  // robust to the very jumps we want to detect.
  const scale = Math.max(1e-3, medianAbsDiff(stream));
  // A brand-new run keeps a wide predictive until it accumulates evidence.
  const freshScale = scale * 10;

  let prior = new Map<number, number>([[0, 1]]);
  const out: BocpdPoint[] = [];

  stream.forEach((x, t) => {
    const next = new Map<number, number>();
    const unnormalised: { r: number; grow: number; cp: number }[] = [];
    let normSum = 0;
    for (const [r, pr] of prior) {
      const mean = r === 0 ? recentMean(stream, t, 5) : windowMean(stream, t - r, Math.min(r, t));
      const s = r === 0 ? freshScale : scale;
      const predProb = studentTail(x, mean, s);
      const grow = pr * (1 - H) * predProb;
      const cp = pr * H * predProb;
      unnormalised.push({ r, grow, cp });
      normSum += grow + cp;
    }
    if (normSum <= 0) normSum = 1;

    for (const { r, grow, cp } of unnormalised) {
      next.set(r + 1, (next.get(r + 1) ?? 0) + grow / normSum);
      next.set(0, (next.get(0) ?? 0) + cp / normSum);
    }

    const clipped = new Map<number, number>();
    for (const [r, v] of next) {
      if (r <= maxR && v > 1e-12) clipped.set(r, v);
    }
    prior = clipped;

    const probChangepoint = clipped.get(0) ?? 0;
    let bestR = 0;
    let bestP = -1;
    for (const [r, v] of clipped) {
      if (v > bestP) {
        bestP = v;
        bestR = r;
      }
    }
    out.push({ runlengths: new Map(clipped), probChangepoint, mapRunLength: bestR });
  });

  return out;
}

function medianAbsDiff(xs: number[]): number {
  if (xs.length < 2) return 0.05;
  const diffs: number[] = [];
  for (let i = 1; i < xs.length; i++) diffs.push(Math.abs(xs[i] - xs[i - 1]));
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

function windowMean(xs: number[], start: number, len: number): number {
  const slice = xs.slice(Math.max(0, start), Math.max(0, start + len));
  if (!slice.length) return recentMean(xs, xs.length, 5);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function recentMean(xs: number[], end: number, n: number): number {
  const slice = xs.slice(Math.max(0, end - n), end);
  return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
}

/** Standardised Gaussian-ish density — monotone in |z| is all BOCPD needs here. */
function studentTail(x: number, mean: number, scale: number): number {
  const z = (x - mean) / scale;
  return Math.exp(-0.5 * z * z) / scale;
}

export function changepointAlert(points: BocpdPoint[], threshold = 0.6): number | null {
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    // A live changepoint shows up as posterior mass collapsing onto very
    // short run lengths — not necessarily the exact r=0 cell at one step.
    const shortMass = (p.runlengths.get(0) ?? 0) + (p.runlengths.get(1) ?? 0);
    if (shortMass > threshold || (p.probChangepoint > threshold && p.mapRunLength <= 1)) {
      return i;
    }
  }
  return null;
}

// ── Feature 8: ENGINE TEMPERATURE ───────────────────────────────────────────

export interface LoadObservation {
  covariates: number[]; // e.g. [ew21Load, matches10d, daysSince, euroFlag, age, …]
  /** Event happened within horizon (rotation/injury). */
  event: number;
  /** Weeks observed without event (censoring time). */
  time: number;
}

export interface CoxModel {
  coefficients: number[];
  baselineHazard: number;
}

/** Newton steps on Breslow partial likelihood — small feature dims, fine. */
export function fitCox(data: LoadObservation[], opts: { iters?: number; lr?: number } = {}): CoxModel {
  const k = data[0]?.covariates.length ?? 1;
  let beta = new Array(k).fill(0);
  const iters = opts.iters ?? 40;
  const lr = opts.lr ?? 0.5;

  for (let it = 0; it < iters; it++) {
    const grad = new Array(k).fill(0);
    for (let i = 0; i < data.length; i++) {
      if (!data[i].event) continue;
      // risk set: everyone with time >= event time
      let expSum = 0;
      const weightedX = new Array(k).fill(0);
      for (const row of data) {
        if (row.time < data[i].time) continue;
        const eta = dot(beta, row.covariates);
        const w = Math.exp(eta);
        expSum += w;
        for (let j = 0; j < k; j++) weightedX[j] += w * row.covariates[j];
      }
      if (expSum <= 0) continue;
      for (let j = 0; j < k; j++) {
        grad[j] += data[i].covariates[j] - weightedX[j] / expSum;
      }
    }
    beta = beta.map((b, j) => b + lr * grad[j]);
  }

  // Breslow baseline at mean covariate profile
  const meanX = new Array(k).fill(0);
  for (const row of data) {
    for (let j = 0; j < k; j++) meanX[j] += row.covariates[j] / data.length;
  }
  const events = data.filter((d) => d.event).length;
  const exposure = data.reduce((s, d) => s + d.time, 0) || 1;
  const baselineHazard =
    events / exposure / Math.exp(dot(beta, meanX)) || 0.01;

  return { coefficients: beta, baselineHazard };
}

/** Hazard × horizon → probability of an event within `weeks`. */
export function eventProbability(model: CoxModel, covariates: number[], weeks: number): number {
  const h = model.baselineHazard * Math.exp(dot(model.coefficients, covariates));
  return 1 - Math.exp(-h * weeks);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i];
  return s;
}

/** Deterministic helper for tests/sims needing a seeded rng here. */
export function seededUniform(seed: number, n: number): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => rng());
}
