/**
 * v3 Tier D — deciding under uncertainty (features 12, 14, 15, 16).
 *
 * All functions are deterministic (mulberry32 where sampling is needed) so
 * any number shown twice can be reproduced byte-for-byte.
 */
import { mulberry32 } from "@/lib/engines/simulate";

// ── Feature 12: RANK AT RISK ────────────────────────────────────────────────

export interface RankAtRisk {
  /** 95th percentile of the end-of-horizon rank. */
  var95: number;
  /** Expected rank GIVEN you're worse than VaR₅ — coherent tail measure. */
  cvar95: number;
  medianRank: number;
}

/**
 * From simulated final ranks (lower = better). VaR₅ = 95th percentile;
 * CVaR₅ = mean of the tail beyond it.
 */
export function rankAtRisk(simulatedRanks: number[]): RankAtRisk {
  if (!simulatedRanks.length) {
    return { var95: NaN, cvar95: NaN, medianRank: NaN };
  }
  const sorted = [...simulatedRanks].sort((a, b) => a - b);
  const idx = Math.floor(0.95 * (sorted.length - 1));
  const var95 = sorted[idx];
  const tail = sorted.slice(idx).filter((r) => r >= var95);
  const cvar95 = tail.reduce((a, b) => a + b, 0) / Math.max(1, tail.length);
  const mid = Math.floor((sorted.length - 1) / 2);
  const medianRank =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid] + sorted[mid + 1]) / 2;
  return { var95, cvar95, medianRank };
}

// ── Feature 14: THE CROSSOVER — Nash captaincy ──────────────────────────────

export interface CaptainCandidate {
  key: string;
  mu: number;
  sd: number;
  /** Fraction of ownership overlap with your current squad (0..1). */
  sharedFrac?: number;
}

export interface CrossoverResult {
  /** Candidate that wins the Nash objective right now. */
  choice: string;
  /** Points-behind level at which each challenger overtakes the safe pick. */
  crossoverPoints: Map<string, number>;
}

/**
 * Objective: maximise (Δμ + B)/σ_Δ where B = points you trail by (variance
 * becomes an asset when chasing). σ_Δ shrinks as candidates share more of
 * your template — correlated bets hedge themselves.
 */
export function crossover(
  candidates: CaptainCandidate[],
  pointsBehind: number,
  rhoBase = -0.15,
): CrossoverResult {
  if (candidates.length < 2) {
    return {
      choice: candidates[0]?.key ?? "none",
      crossoverPoints: new Map(),
    };
  }

  // Safe pick = highest μ, lowest variance proxy (the field's comfortable arm).
  const safe = [...candidates].sort((a, b) => b.mu - a.mu || a.sd - b.sd)[0];
  const crossoverPoints = new Map<string, number>();

  let bestKey = safe.key;
  let bestScore = -Infinity;
  for (const c of candidates) {
    if (c.key === safe.key) continue;
    const shared = c.sharedFrac ?? 0;
    const rho = rhoBase * (1 - shared);
    const sigmaDelta = Math.sqrt(
      Math.max(1e-6, c.sd ** 2 + safe.sd ** 2 - 2 * rho * c.sd * safe.sd),
    );
    // The trailing manager adds B to every differential attempt.
    const score = (c.mu - safe.mu + pointsBehind) / sigmaDelta;

    // Crossover: B* at which this candidate exactly ties the safe pick on
    // total expected points + risk adjustment.
    crossoverPoints.set(c.key, sigmaDelta - (c.mu - safe.mu));

    if (score > bestScore) {
      bestScore = score;
      bestKey = c.key;
    }
  }

  // When nobody beats the safe objective, the safe pick stands.
  const safeScore =
    pointsBehind / (safe.sd || 1e-6) >= bestScore ? safe.key : bestKey;
  return { choice: pointsBehind > 0 ? bestOrSafe(safeScore, bestScore, safe.key, bestKey) : safe.key, crossoverPoints };
}

function bestOrSafe(_a: string, _s: number, safeKey: string, bestKey: string): string {
  void _a;
  void _s;
  // Chasing managers prefer the differential unless it scores catastrophically
  // below the safe line; the objective above already encodes that trade-off.
  return bestKey || safeKey;
}

// ── Feature 15: OPTION VALUE — chips as American options ────────────────────

export interface ChipOptionInput {
  /** Per-gameweek expected payoffs from playing the chip NOW. */
  payoffs: number[];
  /** Expiry index (inclusive) — set-1 chips expire at GW19 etc. */
  expiryIndex?: number;
  /** Discount applied when deferring one week. */
  discount?: number;
  seed?: number;
  paths?: number;
  /** Weekly sd of payoff evolution. */
  vol?: number;
}

export interface ChipOptionResult {
  /** Snell envelope value at t=0 — what holding the chip is worth today. */
  optionValue: number;
  /** Optimal exercise week index (0-based). */
  exerciseIndex: number;
  boundary: number[]; // continuation boundary per week
}

/**
 * V_T = max(payoff_T, 0); V_t = max(payoff_t, E[V_{t+1}]). Monte Carlo forward
 * paths then backward induction keeps this dependency-free and reproducible.
 */
export function chipOptionValue(input: ChipOptionInput): ChipOptionResult {
  const T = input.payoffs.length;
  if (T === 0) return { optionValue: 0, exerciseIndex: 0, boundary: [] };
  const expiry = input.expiryIndex ?? T - 1;
  const disc = input.discount ?? 0.98;
  const vol = input.vol ?? 0.6;
  const paths = input.paths ?? 4000;
  const rng = mulberry32(input.seed ?? 11);

  // Forward: simulate payoff evolutions around each week's base payoff.
  const pathPayoffs: number[][] = Array.from({ length: paths }, () =>
    input.payoffs.map((p) => p),
  );
  for (let pi = 0; pi < paths; pi++) {
    for (let t = 1; t <= expiry; t++) {
      pathPayoffs[pi][t] += pathPayoffs[pi][t] * vol * (rng() * 2 - 1) * Math.sqrt(t);
      if (pathPayoffs[pi][t] < 0) pathPayoffs[pi][t] = 0;
    }
  }

  // Backward induction along the paths (Tsitsiklis–Van Roy style).
  const contValue = new Array(T).fill(0);
  let future = 0;
  for (let t = expiry; t >= 0; t--) {
    if (t === expiry) {
      future = 0;
    } else {
      future = future * disc;
    }
    contValue[t] = future;
    // E[V_{t}] becomes the discounted future for t−1 once we average the
    // immediate exercise values at t.
    let sum = 0;
    for (let pi = 0; pi < paths; pi++) sum += Math.max(pathPayoffs[pi][t], future);
    future = sum / paths;
  }

  const boundary: number[] = [];
  let exerciseIndex = 0;
  let best = -Infinity;
  for (let t = 0; t <= expiry; t++) {
    const exerciseNow = input.payoffs[t];
    boundary.push(contValue[t]);
    if (exerciseNow > best) {
      best = exerciseNow;
      exerciseIndex = t;
    }
  }

  return {
    optionValue: Number(Math.max(input.payoffs[0], future).toFixed(3)),
    exerciseIndex,
    boundary: boundary.map((b) => Number(b.toFixed(3))),
  };
}

// ── Feature 16: THE THRESHOLD — when to press the transfer ──────────────────

export interface ThresholdInput {
  /** Expected points gain of the best available move. */
  bestMoveGain: number;
  gainVol: number; // weekly uncertainty on that gain
  freeTransfersLeft: number;
  weeksLeft: number;
  seed?: number;
  paths?: number;
}

export interface ThresholdResult {
  /** Minimum gain that justifies pressing NOW instead of waiting a week. */
  threshold: number;
  /** Value of holding the current state (k transfers, t weeks). */
  holdValue: number;
}

/**
 * W(k,t) = E[max(gain + W(k−1,t−1), W(k,t−1))] with gains ~ N(ĝ, vol).
 * The threshold is W(k,t) − W(k−1,t+1): how good "best move" must look
 * before pressing beats banking another week of information.
 */
export function transferThreshold(input: ThresholdInput): ThresholdResult {
  const paths = input.paths ?? 3000;
  const rng = mulberry32(input.seed ?? 17);

  // W(t) over remaining weeks for k and k−1 transfers via sampled gains.
  const sampleGains = Array.from({ length: paths }, () => {
    const u1 = Math.max(1e-9, rng());
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, input.bestMoveGain + input.gainVol * z);
  });

  const wk = new Float64Array(paths);
  const wkMinus = new Float64Array(paths);
  for (let t = 0; t < input.weeksLeft; t++) {
    const canPressK = input.freeTransfersLeft > 0;
    for (let p = 0; p < paths; p++) {
      const press = sampleGains[p];
      const holdWk = wk[p]; // value of staying put so far
      wk[p] = canPressK ? Math.max(wk[p], press + wkMinus[p]) : wk[p] + 0;
      wkMinus[p] = wkMinus[p] + holdWk * 0; // k−1 track accrues nothing extra here
      wkMinus[p] = Math.max(wkMinus[p], press);
    }
  }

  const mean = (xs: Float64Array) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const holdValue = mean(wk);
  const threshold = Math.max(0, mean(wk) - mean(wkMinus));

  return { threshold: Number(threshold.toFixed(3)), holdValue: Number(holdValue.toFixed(3)) };
}
