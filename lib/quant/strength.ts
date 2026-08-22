/**
 * v3 Feature 5 — THE STRENGTH MODEL (Q0 foundation).
 *
 * G ~ Poisson(λ); λ_home = exp(μ + att_h − def_a + γ), away symmetric.
 * Dixon–Coles τ low-score correction with ρ; exponential time decay
 * exp(−ξ·Δdays); Gaussian partial pooling att~N(0,σ²att) as the MAP prior.
 *
 * Fitted by coordinate-ascent Newton steps over the penalised weighted
 * log-likelihood — deterministic, no dependencies. Laplace-style standard
 * errors fall out of the diagonal Hessian so every downstream number can
 * carry an error bar ("August honesty").
 */

export interface DcMatch {
  homeTeam: number;
  awayTeam: number;
  /** Full-time goals. */
  gh: number;
  ga: number;
  /** Age in days at fit time (recency weighting). */
  ageDays?: number;
}

export interface DcFitOptions {
  xi?: number; // time-decay per day ≈ 0.0045
  sigmaAtt?: number; // pooling prior sd
  sigmaDef?: number;
  rho?: number; // Dixon–Coles low-score dependence
  sweeps?: number;
}

export interface DcFit {
  mu: number;
  gamma: number;
  att: Map<number, number>;
  def: Map<number, number>;
  rho: number;
  /** Laplace standard errors per team. */
  se: Map<number, { att: number; def: number }>;
  matchesUsed: number;
}

const MAX_GOALS = 10;

export function fitDixonColes(matches: DcMatch[], opts: DcFitOptions = {}): DcFit {
  const xi = opts.xi ?? 0.0045;
  const sigmaAtt = opts.sigmaAtt ?? 0.35;
  const sigmaDef = opts.sigmaDef ?? 0.35;
  const rho = opts.rho ?? -0.06;
  const sweeps = opts.sweeps ?? 60;

  const teams = [...new Set(matches.flatMap((m) => [m.homeTeam, m.awayTeam]))].sort((a, b) => a - b);
  const nTeams = teams.length;
  const zero = () => new Array(nTeams).fill(0);
  const att = zero();
  const def = zero();

  if (matches.length === 0 || nTeams === 0) {
    return {
      mu: Math.log(1.35),
      gamma: 0.1,
      att: new Map(),
      def: new Map(),
      rho,
      se: new Map(),
      matchesUsed: 0,
    };
  }

  // Weights: recency decay. μ and γ from the weighted goal means.
  const w = matches.map((m) => Math.exp(-xi * (m.ageDays ?? 0)));
  let totalGoals = 0;
  let weightSum = 0;
  let homeGoals = 0;
  for (let i = 0; i < matches.length; i++) {
    totalGoals += w[i] * (matches[i].gh + matches[i].ga);
    homeGoals += w[i] * matches[i].gh;
    weightSum += w[i];
  }
  const mu = Math.log(Math.max(0.2, totalGoals / (2 * weightSum)));
  const gamma = Math.log(Math.max(0.6, (homeGoals / weightSum) / (totalGoals / (2 * weightSum))));

  const idx = new Map(teams.map((t, i) => [t, i]));
  const lambdaHome = new Array(matches.length).fill(1);
  const lambdaAway = new Array(matches.length).fill(1);

  const recomputeLambdas = () => {
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const h = idx.get(m.homeTeam)!;
      const a = idx.get(m.awayTeam)!;
      lambdaHome[i] = Math.exp(mu + att[h] - def[a] + gamma);
      lambdaAway[i] = Math.exp(mu + att[a] - def[h]);
    }
  };

  // Coordinate ascent: Newton step per team parameter, several sweeps.
  for (let s = 0; s < sweeps; s++) {
    recomputeLambdas();
    for (const t of teams) {
      const i_t = idx.get(t)!;
      // attack parameter — updated from home and away appearances of team t
      let gSum = 0;
      let info = 1 / (sigmaAtt * sigmaAtt); // prior curvature
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        if (m.homeTeam !== t && m.awayTeam !== t) continue;
        if (m.homeTeam === t) {
          gSum += w[i] * (m.gh - lambdaHome[i]);
          info += w[i] * lambdaHome[i];
        } else {
          gSum += w[i] * (m.ga - lambdaAway[i]);
          info += w[i] * lambdaAway[i];
        }
      }
      att[i_t] += gSum / info;

      // defence parameter
      let dSum = 0;
      let infoD = 1 / (sigmaDef * sigmaDef);
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        if (m.homeTeam !== t && m.awayTeam !== t) continue;
        if (m.awayTeam === t) {
          dSum += w[i] * -(m.gh - lambdaHome[i]);
          infoD += w[i] * lambdaHome[i];
        } else {
          dSum += w[i] * -(m.ga - lambdaAway[i]);
          infoD += w[i] * lambdaAway[i];
        }
      }
      def[i_t] += dSum / infoD;
    }
  }

  recomputeLambdas();

  // Laplace standard errors from final curvature.
  const se = new Map<number, { att: number; def: number }>();
  for (const t of teams) {
    const i_t = idx.get(t)!;
    let infoA = 1 / (sigmaAtt * sigmaAtt);
    let infoD = 1 / (sigmaDef * sigmaDef);
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      if (m.homeTeam === t) {
        infoA += w[i] * lambdaHome[i];
        infoD += w[i] * lambdaHome[i];
      } else if (m.awayTeam === t) {
        infoA += w[i] * lambdaAway[i];
        infoD += w[i] * lambdaAway[i];
      }
    }
    void i_t;
    se.set(t, { att: 1 / Math.sqrt(infoA), def: 1 / Math.sqrt(infoD) });
  }

  return {
    mu,
    gamma,
    att: new Map(teams.map((t, i) => [t, att[i]])),
    def: new Map(teams.map((t, i) => [t, def[i]])),
    rho,
    se,
    matchesUsed: matches.length,
  };
}

/** Dixon–Coles τ(x,y;ρ) — low-score dependence correction (Dixon & Coles 1997). */
export function tau(x: number, y: number, rho: number, lambdaH: number, lambdaA: number): number {
  if (x === 0 && y === 0) return 1 - lambdaH * lambdaA * rho;
  if (x === 0 && y === 1) return 1 + lambdaH * rho;
  if (x === 1 && y === 0) return 1 + lambdaA * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

/** Score-level probability P(g_h=x, g_a=y) with τ applied. */
export function scoreProbability(
  lambdaHome: number,
  lambdaAway: number,
  x: number,
  y: number,
  rho = -0.06,
): number {
  const pH = pois(lambdaHome, x);
  const pA = pois(lambdaAway, y);
  return pH * pA * tau(x, y, rho, lambdaHome, lambdaAway);
}

function pois(l: number, k: number): number {
  if (k > MAX_GOALS) return 0;
  let logp = -l + k * Math.log(Math.max(l, 1e-12));
  for (let i = 2; i <= k; i++) logp -= Math.log(i);
  return Math.exp(logp);
}

/**
 * Expected goals conceded by the HOME side's opponents… precisely: project
 * both scoring rates for a fixture (the raw rates, τ applies at score level).
 */
export function lambdasFor(
  fit: DcFit,
  homeTeam: number,
  awayTeam: number,
): { lambdaHome: number; lambdaAway: number } {
  return {
    lambdaHome: Math.exp(fit.mu + (fit.att.get(homeTeam) ?? 0) - (fit.def.get(awayTeam) ?? 0) + fit.gamma),
    lambdaAway: Math.exp(fit.mu + (fit.att.get(awayTeam) ?? 0) - (fit.def.get(homeTeam) ?? 0)),
  };
}
