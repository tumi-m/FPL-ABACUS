/**
 * v3 Tier A — portfolio engines (features 1 Position, 3 Squad Beta,
 * 13 The Cone). Pure math on your active weights vs the field.
 *
 * Honesty rules apply downstream: every estimate ships with its uncertainty
 * and observational labels — these functions only compute.
 */
import { mulberry32 } from "@/lib/engines/simulate";

// ── Feature 1: THE POSITION ─────────────────────────────────────────────────

export interface PositionHolding {
  elementId: number;
  /** Your multiplicative weight: 0 bench · 1 starter · 2 captain · 3 TC. */
  m: number;
  /** Field effective ownership in percent (0..100). */
  eoPct: number;
}

export interface PositionResult {
  activeShare: number;
  /** elementId → a_p = w_p − f_p */
  activeWeights: Map<number, number>;
}

export function position(holdings: PositionHolding[]): PositionResult {
  const sumM = holdings.reduce((s, h) => s + h.m, 0);
  const sumF = holdings.reduce((s, h) => s + h.eoPct / 100, 0);
  if (sumM <= 0 || sumF <= 0) {
    return { activeShare: 0, activeWeights: new Map() };
  }
  let absSum = 0;
  const activeWeights = new Map<number, number>();
  for (const h of holdings) {
    const w = h.m / sumM;
    const f = h.eoPct / 100 / sumF;
    const a = w - f;
    activeWeights.set(h.elementId, a);
    absSum += Math.abs(a);
  }
  return { activeShare: absSum / 2, activeWeights };
}

/** Active-return series: Σ_p (m_p − EO_p/100)·pts_{p,t}. */
export function activeReturnSeries(
  holdings: PositionHolding[],
  pointsByGw: { elementId: number; pts: number }[][],
): number[] {
  return pointsByGw.map((gw) =>
    holdings.reduce((sum, h) => {
      const played = gw.find((p) => p.elementId === h.elementId);
      return sum + (h.m - h.eoPct / 100) * (played?.pts ?? 0);
    }, 0),
  );
}

export interface RiskProfile {
  meanR: number;
  /** Per-week sd of active returns. */
  teWeekly: number;
  /** Season-scale tracking error (√38). */
  teSeason: number;
  informationRatio: number;
}

export function riskProfile(rSeries: number[]): RiskProfile {
  const n = rSeries.length;
  if (n < 2) {
    return { meanR: rSeries[0] ?? 0, teWeekly: NaN, teSeason: NaN, informationRatio: NaN };
  }
  const mean = rSeries.reduce((a, b) => a + b, 0) / n;
  const varr = rSeries.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
  const te = Math.sqrt(varr);
  const ir = te > 0 ? (mean - 0) / te : NaN;
  return { meanR: mean, teWeekly: te, teSeason: te * Math.sqrt(38), informationRatio: ir };
}

/** P(finish ahead of the field over n gameweeks) ≈ Φ(IR·√n). */
export function probAhead(ir: number, weeks: number): number | null {
  if (!Number.isFinite(ir)) return null;
  // Abramowitz–Stegun 7.1.26 style normal CDF
  const x = ir * Math.sqrt(weeks);
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly =
    t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf = x >= 0 ? 1 - (Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)) * poly : (Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)) * poly;
  return Math.min(1, Math.max(0, cdf));
}

// ── Feature 3: SQUAD BETA ───────────────────────────────────────────────────

export interface BetaResult {
  alpha: number;
  beta: number;
  residualSd: number;
}

/** OLS of your weekly scores against the field average. */
export function squadBeta(you: number[], field: number[]): BetaResult {
  const n = Math.min(you.length, field.length);
  if (n < 2) return { alpha: 0, beta: NaN, residualSd: NaN };
  const my = you.slice(-n);
  const mf = field.slice(-n);
  const meanY = my.reduce((a, b) => a + b, 0) / n;
  const meanF = mf.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let varF = 0;
  for (let i = 0; i < n; i++) {
    cov += (my[i] - meanY) * (mf[i] - meanF);
    varF += (mf[i] - meanF) ** 2;
  }
  const beta = varF > 0 ? cov / varF : NaN;
  const alpha = meanY - beta * meanF;
  const resid =
    Math.sqrt(
      my.reduce((s, y, i) => s + (y - (alpha + beta * mf[i])) ** 2, 0) / Math.max(1, n - 2),
    ) || 0;
  return { alpha, beta, residualSd: resid };
}

// ── Feature 13: THE CONE ────────────────────────────────────────────────────

export interface ConeInput {
  /** Mean weekly active return (α from Position). */
  alpha: number;
  /** Weekly tracking error. */
  te: number;
  weeksLeft: number;
  /** Active points needed to reach the target (gap to close). */
  targetActivePoints?: number;
  paths?: number;
  seed?: number;
  /** AR(1) persistence of weekly active returns, −1..1. */
  autocorr?: number;
}

export interface ConeResult {
  /** Percentiles of total active points across simulated paths. */
  p5: number;
  p50: number;
  p95: number;
  /**
   * Probability the target is reached, or null when no target was supplied.
   * Honest complement: 1−p is "now a …% outcome".
   */
  probTarget: number | null;
  /** Mean weekly rate required to hit the target (null without target). */
  requiredWeeklyRate: number | null;
}

export function cone(input: ConeInput): ConeResult {
  const paths = input.paths ?? 10_000;
  const rng = mulberry32(input.seed ?? 2026);
  const ar = Math.min(0.9, Math.max(-0.9, input.autocorr ?? 0));

  const totals = new Float64Array(paths);
  for (let p = 0; p < paths; p++) {
    let shock = 0;
    let total = 0;
    for (let w = 0; w < input.weeksLeft; w++) {
      shock = ar * shock + Math.sqrt(1 - ar * ar) * normal(rng) * input.te;
      total += input.alpha + shock;
    }
    totals[p] = total;
  }
  totals.sort();

  const q = (f: number) => totals[Math.min(paths - 1, Math.max(0, Math.floor(f * paths)))];
  const p5 = q(0.05);
  const p50 = q(0.5);
  const p95 = q(0.95);

  let probTarget: number | null = null;
  let requiredWeeklyRate: number | null = null;
  if (input.targetActivePoints != null && input.weeksLeft > 0) {
    requiredWeeklyRate = input.targetActivePoints / input.weeksLeft;
    probTarget = totals.filter((t) => t >= input.targetActivePoints!).length / paths;
  }

  return { p5, p50, p95, probTarget, requiredWeeklyRate };
}

function normal(rng: () => number): number {
  // Box–Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
