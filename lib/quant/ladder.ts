/**
 * v3 Feature 20 — THE LADDER. Standard Glicko-2 (Glickman 2012) over
 * gameweek "rounds": each manager plays a round-robin sample of the cohort,
 * outcomes 1/½/0 by gameweek points. Rating r with rating deviation RD and
 * volatility σ; RD widens through inactivity. Portable across seasons.
 */

export interface GlickoPlayer {
  rating: number; // start 1500
  rd: number; // start 350
  volatility: number; // start 0.06
}

export interface GlickoOpponent {
  rating: number;
  rd: number;
  /** 1 win · 0.5 draw · 0 loss */
  score: 0 | 0.5 | 1;
}

const TAU = 0.5; // Glickman's recommended constraint range mid-point

/** g(φ) in Glicko-2 internal scale. */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi ** 2) / Math.PI ** 2);
}

/** One Glicko-2 rating period for a single player against their opponents. */
export function glickoStep(player: GlickoPlayer, opponents: GlickoOpponent[]): GlickoPlayer {
  if (opponents.length === 0) {
    // Inactive period: RD grows toward its 350 cap.
    const phiStar = Math.sqrt((player.rd / 173.7178) ** 2 + player.volatility ** 2);
    return { ...player, rd: Math.min(350, 173.7178 * phiStar) };
  }

  const mu = (player.rating - 1500) / 173.7178;
  const phi = player.rd / 173.7178;

  let vInv = 0;
  let deltaSum = 0;
  for (const o of opponents) {
    const muJ = (o.rating - 1500) / 173.7178;
    const phiJ = o.rd / 173.7178;
    const gj = g(phiJ);
    const e = 1 / (1 + Math.exp(-gj * (mu - muJ)));
    vInv += gj ** 2 * e * (1 - e);
    deltaSum += gj * (o.score - e);
  }
  const v = 1 / Math.max(1e-9, vInv);
  const delta = v * deltaSum;

  // Illinois algorithm for σ′ (Glickman 2012, step 5).
  const a = Math.log(player.volatility ** 2);
  const dSq = phi ** 2 + v;
  const f = (x: number): number =>
    (Math.exp(x) * (delta ** 2 - phiSqOf(player) - v - Math.exp(x))) / (2 * dSq ** 2) -
    (x - a) / TAU ** 2;

  let A = a;
  let B = delta ** 2 > dSq ? Math.log(delta ** 2 - phiSqOf(player) - v) : a - TAU;
  let fA = f(A);
  let fB = f(B);
  while (fA * fB > 0) {
    B += TAU;
    fB = f(B);
  }
  for (let i = 0; i < 100 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  const newVol = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi ** 2 + newVol ** 2);
  const phiPrime = 1 / Math.sqrt(1 / phiStar ** 2 + 1 / v);
  const muPrime = mu + phiPrime ** 2 * deltaSum;

  return {
    rating: 1500 + 173.7178 * muPrime,
    rd: 173.7178 * phiPrime,
    volatility: newVol,
  };
}

function phiSqOf(p: GlickoPlayer): number {
  return (p.rd / 173.7178) ** 2;
}

/**
 * Ladder helper — convert one manager's GW points against the cohort's points
 * distribution into a score set for `glickoStep`. Sample opponents carry the
 * cohort's current (rating, rd); outcomes come from pairwise point compare.
 */
export function scoresFromPoints(
  yourPoints: number,
  cohort: { rating: number; rd: number; points: number }[],
): GlickoOpponent[] {
  return cohort.map((c) => ({
    rating: c.rating,
    rd: c.rd,
    score: yourPoints > c.points ? 1 : yourPoints === c.points ? 0.5 : 0,
  }));
}
