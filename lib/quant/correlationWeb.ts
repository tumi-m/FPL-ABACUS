/**
 * v3 Feature 4 — THE CORRELATION WEB (Q0 foundation).
 *
 * Copula by construction: draw (G_home, G_away) from the Dixon–Coles bivariate
 * model (independent Poissons reweighted by τ via rejection), allocate goals
 * and assists to players multinomially by team xG/xA share given simulated
 * minutes, then derive CS/DEFCON deterministically from the same draw. M sims
 * give an empirical Σ across the squad; effective bets are the participation
 * ratio of its eigenvalues.
 */
import { lambdasFor, tau, type DcFit } from "@/lib/quant/strength";import { mulberry32 } from "@/lib/engines/simulate";

export interface WebPlayer {
  elementId: number;
  teamId: number;
  /** 1 GK · 2 DEF · 3 MID · 4 FWD */
  pos: 1 | 2 | 3 | 4;
  /** Share of the team's goals this player is expected to score (0..1]. */
  goalShare: number;
  /** Share of team assists. */
  assistShare: number;
  /** Probability of playing ~60+ minutes in the fixture. */
  minutesProb: number;
  /** P(≥10 DEFCON events | starts). */
  defconRate: number;
}

export interface WebDraw {
  elementId: number;
  points: number;
}

export interface WebResult {
  /** Empirical correlation matrix over per-player point vectors. */
  correlation: Map<string, number>; // "a|b" ordered pair → ρ̂
  /** Per-player mean simulated points (sanity + display). */
  meanPoints: Map<number, number>;
  /** Participation ratio of the correlation eigenvalues. */
  effectiveBets: number;
  draws: number;
}

export interface ScoringTable {
  goals: Record<number, number>;
  assist: number;
  cleanSheet: Record<number, number>;
}

const DEFAULT_SCORING: ScoringTable = {
  goals: { 1: 6, 2: 6, 3: 5, 4: 4 },
  assist: 3,
  cleanSheet: { 1: 10, 2: 4, 3: 1, 4: 0 },
};

/** One Dixon–Coles scoreline via rejection against the τ-weighted target. */
export function drawScore(
  fit: DcFit,
  homeTeam: number,
  awayTeam: number,
  rng: () => number,
): { gh: number; ga: number } {
  const { lambdaHome, lambdaAway } = lambdasFor(fit, homeTeam, awayTeam);
  const maxTau = Math.max(1 + Math.abs(fit.rho), 1 - Math.abs(fit.rho));
  for (let tries = 0; tries < 40; tries++) {
    const gh = poissonSample(lambdaHome, rng);
    const ga = poissonSample(lambdaAway, rng);
    // accept with probability ∝ τ(x,y)/τ_max — τ ≥ 1−|ρ|·max(λμ,1) bounded
    const pAccept = Math.min(1.5, tau(gh, ga, fit.rho, lambdaHome, lambdaAway) / maxTau);
    if (rng() < pAccept) return { gh, ga };
  }
  return { gh: poissonSample(lambdaHome, rng), ga: poissonSample(lambdaAway, rng) };
}

function poissonSample(lambda: number, rng: () => number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L && k < 25);
  return k - 1;
}

function multinomialShare(rng: () => number, shares: number[], total: number): number[] {
  // allocate `total` events across players proportional to shares
  const alloc = new Array(shares.length).fill(0);
  const cum = [...shares];
  for (let e = 0; e < total; e++) {
    const sum = cum.reduce((s, v) => s + v, 0);
    if (sum <= 0) break;
    let r = rng() * sum;
    for (let i = 0; i < cum.length; i++) {
      r -= cum[i];
      if (r <= 0) {
        alloc[i]++;
        break;
      }
    }
  }
  return alloc;
}

/**
 * Simulate one fixture set for the squad — every squad player's fixture must
 * be supplied as (playerIndex → homeTeam,awayTeam, isHome).
 */
export function simulateWeb(
  players: WebPlayer[],
  fixtures: { elementId: number; homeTeam: number; awayTeam: number; isHome: boolean }[],
  fit: DcFit,
  scoring: ScoringTable = DEFAULT_SCORING,
  opts: { M?: number; seed?: number } = {},
): WebResult {
  const M = Math.max(100, Math.min(20_000, opts.M ?? 2_000));
  const seed = opts.seed ?? 97;
  const rng = mulberry32(seed);

  const byElement = new Map(fixtures.map((f) => [f.elementId, f]));
  const pts = new Float32Array(players.length * M);

  for (let m = 0; m < M; m++) {
    // group players by fixture so each match is drawn once
    const fixtureGroups = new Map<string, { homeTeam: number; awayTeam: number; members: number[]; isHome: boolean[] }>();
    players.forEach((p, pi) => {
      const fx = byElement.get(p.elementId);
      if (!fx) return;
      const key = `${fx.homeTeam}:${fx.awayTeam}`;
      let g = fixtureGroups.get(key);
      if (!g) {
        g = { homeTeam: fx.homeTeam, awayTeam: fx.awayTeam, members: [], isHome: [] };
        fixtureGroups.set(key, g);
      }
      g.members.push(pi);
      g.isHome.push(fx.isHome);
    });

    const playedGoals = new Map<number, boolean>();
    const playedAssists = new Map<number, boolean>();

    for (const [, g] of fixtureGroups) {
      const { gh, ga } = drawScore(fit, g.homeTeam, g.awayTeam, rng);
      const homePlayers = g.members.filter((_, j) => g.isHome[j]);
      const awayPlayers = g.members.filter((_, j) => !g.isHome[j]);

      const allocate = (
        memberIdxs: number[],
        goalsFor: number,
        conceded: number,
      ) => {
        if (!memberIdxs.length) return;
        // minutes gate
        const starters = memberIdxs.filter((pi) => rng() < players[pi].minutesProb);
        if (!starters.length) return;
        const gShares = starters.map((pi) => players[pi].goalShare);
        const aShares = starters.map((pi) => players[pi].assistShare);
        const goalAlloc = multinomialShare(rng, gShares, goalsFor);
        const assistAlloc = multinomialShare(rng, aShares, Math.min(conceded >= 0 ? goalsFor : goalsFor, goalsFor));
        const cs = conceded === 0;
        starters.forEach((pi, k) => {
          const p = players[pi];
          const gp = goalAlloc[k] * scoring.goals[p.pos] + assistAlloc[k] * scoring.assist + (cs ? scoring.cleanSheet[p.pos] : 0);
          const defcon = rng() < p.defconRate ? 2 : 0;
          pts[pi * M + m] = gp + defcon;
          playedGoals.set(p.elementId, goalAlloc[k] > 0);
          playedAssists.set(p.elementId, assistAlloc[k] > 0);
        });
      };

      allocate(homePlayers, gh, ga);
      allocate(awayPlayers, ga, gh);
    }

    void playedGoals;
    void playedAssists;
  }

  return summarise(players, pts, M);
}

function summarise(players: WebPlayer[], pts: Float32Array, M: number): WebResult {
  const means = players.map((_, i) => {
    let s = 0;
    for (let m = 0; m < M; m++) s += pts[i * M + m];
    return s / M;
  });

  // pairwise Pearson correlations (only where variance exists)
  const correlation = new Map<string, number>();
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const mi = means[i];
      const mj = means[j];
      let cov = 0;
      let vi = 0;
      let vj = 0;
      for (let m = 0; m < M; m++) {
        const di = pts[i * M + m] - mi;
        const dj = pts[j * M + m] - mj;
        cov += di * dj;
        vi += di * di;
        vj += dj * dj;
      }
      const denom = Math.sqrt(vi * vj);
      correlation.set(`${players[i].elementId}|${players[j].elementId}`, denom > 1e-9 ? cov / denom : 0);
    }
  }

  // Effective bets via participation ratio of the covariance eigenvalues.
  // Power iteration on the full matrix is unnecessary — Jacobi-lite on the
  // correlation matrix diagonal dominance would be overkill; use Gershgorin-
  // bounded power method for the top-k trace approximation.
  const n = players.length;
  const lambdaSumSqTrace = (() => {
    // λ_i² summed = trace(C²); compute C² trace directly.
    let tr = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cij = i === j ? 1 : correlation.get(`${players[i].elementId}|${players[j].elementId}`) ?? 0;
        const cji = i === j ? 1 : correlation.get(`${players[j].elementId}|${players[i].elementId}`) ?? cij;
        tr += cij * cji;
      }
    }
    return tr;
  })();
  const trace = n; // unit-diagonal correlation matrix
  const effectiveBets = lambdaSumSqTrace > 0 ? (trace * trace) / lambdaSumSqTrace : n;

  const meanPoints = new Map(players.map((p, i) => [p.elementId, Number(means[i].toFixed(3))]));
  return {
    correlation,
    meanPoints,
    effectiveBets: Number(effectiveBets.toFixed(2)),
    draws: M,
  };
}
