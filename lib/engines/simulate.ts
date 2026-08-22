export interface SimConfig {
  runs: number;
  seed: number;
}

export interface SimPlayer {
  element: number;
  multiplier: number;
  started: boolean;
  pStart: number;
  pointsSoFar: number;
  remainingMinutes: number;
  lambdaGoal: number;
  lambdaAssist: number;
  csStillPossible: boolean;
  pCleanSheet: number;
  pDefcon: number;
  defconHit: boolean;
  goalValue: number;
  csValue: number;
  hitCost?: number;
}

/** Deterministic PRNG — same seed, byte-identical output. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Knuth Poisson for small λ. */
export function poisson(rng: () => number, lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

function expectedBonusDelta(goals: number, assists: number, cs: number, defcon: number): number {
  return clamp(0, 3, goals * 1.1 + assists * 0.7 + cs * 0.5 + defcon * 0.2 - 0.15);
}

const clamp = (lo: number, hi: number, v: number) => Math.min(hi, Math.max(lo, v));

/**
 * Simulates every squad inside the same loop with shared draws per player so
 * shared ownership is perfectly correlated — independent runs make paired
 * head-to-head probabilities badly wrong.
 */
export function simulatePaired(squads: SimPlayer[][], cfg: SimConfig): Float32Array[] {
  const rng = mulberry32(cfg.seed);
  const out = Array.from({ length: squads.length }, () => new Float32Array(cfg.runs));
  const hitCosts = squads.map((squad) => squad.reduce((s, p) => s + (p.hitCost ?? 0), 0));

  for (let r = 0; r < cfg.runs; r++) {
    const totals = new Float64Array(squads.length);
    const seen = new Set<number>();

    for (let si = 0; si < squads.length; si++) {
      for (const p of squads[si]) {
        if (seen.has(p.element)) continue;
        seen.add(p.element);

        let pts: number;
        if (p.remainingMinutes <= 0) {
          pts = p.pointsSoFar;
        } else {
          const plays = p.started ? 1 : rng() < p.pStart ? 1 : 0;
          if (!plays) {
            pts = p.pointsSoFar;
          } else {
            const frac = p.remainingMinutes / 90;
            const goals = poisson(rng, p.lambdaGoal * frac);
            const assists = poisson(rng, p.lambdaAssist * frac);
            const cs = p.csStillPossible && rng() < p.pCleanSheet ? 1 : 0;
            const dc = !p.defconHit && rng() < p.pDefcon ? 1 : 0;
            pts =
              p.pointsSoFar +
              goals * p.goalValue +
              assists * 3 +
              cs * p.csValue +
              dc * 2 +
              expectedBonusDelta(goals, assists, cs, dc);
          }
        }

        for (let sj = 0; sj < squads.length; sj++) {
          const owner = squads[sj].find((q) => q.element === p.element);
          if (owner) totals[sj] += pts * owner.multiplier;
        }
      }
    }

    for (let sj = 0; sj < squads.length; sj++) out[sj][r] = totals[sj] - hitCosts[sj];
  }
  return out;
}

export function beatProbability(a: Float32Array, b: Float32Array): number {
  let wins = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] > b[i]) wins++;
  }
  return wins / n;
}

export function percentiles(dist: Float32Array, ps: number[] = [5, 25, 50, 75, 95]): Map<number, number> {
  const sorted = Float32Array.from(dist).sort();
  const out = new Map<number, number>();
  for (const p of ps) {
    const idx = clampInt(Math.floor((p / 100) * sorted.length), 0, sorted.length - 1);
    out.set(p, sorted[idx]);
  }
  return out;
}

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

export function mean(dist: Float32Array): number {
  let s = 0;
  for (let i = 0; i < dist.length; i++) s += dist[i];
  return s / dist.length;
}

export function stdev(dist: Float32Array): number {
  const m = mean(dist);
  let s = 0;
  for (let i = 0; i < dist.length; i++) s += (dist[i] - m) ** 2;
  return Math.sqrt(s / dist.length);
}
