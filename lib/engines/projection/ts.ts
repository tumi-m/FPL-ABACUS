export interface ProjectionInput {
  elementId: number;
  pos: number;
  status: "a" | "d" | "i" | "s" | "u" | "n";
  chanceOfPlaying: number | null;
  /** last-6 starts / matches played */
  startRate: number;
  avgMinutesStarted: number;
  xg: number;
  xa: number;
  minutesPlayed: number;
  teamAttackHome: number;
  teamAttackAway: number;
  oppDefenceHome: number;
  oppDefenceStrength: number;
  isHome: boolean;
  leagueAvgAttack: number;
  leagueAvgDefence: number;
  teamXgcPerMatch: number;
  matchesPlayed: number;
  defconHitRate: number;
}

export interface PlayerProjection {
  gw?: number;
  elementId?: number;
  xMins: number;
  pStart: number;
  pAppear: number;
  xG: number;
  xA: number;
  pCleanSheet: number;
  xGC: number;
  pDefcon: number;
  xBonus: number;
  xCards: number;
  xP: number;
  sd: number;
  breakdown: { minutes: number; goals: number; assists: number; cs: number; defcon: number; bonus: number; negatives: number };
}

export interface ProjectionContext {
  input: ProjectionInput;
}

/** shrink(x, prior, k) = (n·x + k·prior)/(n+k) — not optional in August. */
export function shrink(x: number, n: number, prior: number, k = 180): number {
  if (n <= 0) return prior;
  return (n * x + k * prior) / (n + k);
}

const HOME_ADJ = 1.1;
const AWAY_ADJ = 0.92;

const PRIOR_XG_BY_POS: Record<number, number> = { 1: 0.06, 2: 0.09, 3: 0.16, 4: 0.24 };
const PRIOR_XA_BY_POS: Record<number, number> = { 1: 0.03, 2: 0.08, 3: 0.18, 4: 0.12 };
const PRIOR_DEFCON: Record<number, number> = { 1: 0, 2: 0.45, 3: 0.2, 4: 0.12 };

const BONUS_COEFFS = { b0: -0.10, b1: 1.35, b2: 0.85, b3: 0.55, b4: 0.25, b5: 0.06 };

function fixtureMultiplier(inp: ProjectionInput): number {
  const attack = inp.isHome ? inp.teamAttackHome : inp.teamAttackAway;
  const oppDef = inp.isHome ? inp.oppDefenceStrength : inp.oppDefenceHome;
  const mult = (attack / inp.leagueAvgAttack) * (inp.leagueAvgDefence / oppDef) * (inp.isHome ? HOME_ADJ : AWAY_ADJ);
  return Number.isFinite(mult) && mult > 0 ? mult : 1;
}

export function projectPlayer(
  ctx: ProjectionContext,
  scoring: { goals: Record<number, number>; cleanSheet: Record<number, number>; assist: number },
): PlayerProjection {
  const inp = ctx.input;

  let pAppear = inp.startRate > 0 ? Math.min(1, inp.startRate) : 0;
  if (inp.status === "i" || inp.status === "s" || inp.status === "u" || inp.status === "n") {
    pAppear = 0;
  } else if (inp.chanceOfPlaying !== null) {
    pAppear = Math.min(pAppear, inp.chanceOfPlaying / 100);
  }

  const eMinsIfStart = shrink(inp.avgMinutesStarted, inp.minutesPlayed / 6, 80, 6);
  const xMins = pAppear * (inp.startRate * eMinsIfStart + (1 - inp.startRate) * 25);

  const fxMult = fixtureMultiplier(inp);

  // Season totals must be converted to per-90 BEFORE shrinkage.
  const rawXg90 = inp.minutesPlayed > 0 ? (inp.xg / inp.minutesPlayed) * 90 : PRIOR_XG_BY_POS[inp.pos] ?? 0.15;
  const rawXa90 = inp.minutesPlayed > 0 ? (inp.xa / inp.minutesPlayed) * 90 : PRIOR_XA_BY_POS[inp.pos] ?? 0.12;
  const xg90 = shrink(rawXg90, inp.minutesPlayed, PRIOR_XG_BY_POS[inp.pos] ?? 0.15);
  const xa90 = shrink(rawXa90, inp.minutesPlayed, PRIOR_XA_BY_POS[inp.pos] ?? 0.12);
  const xG = (xg90 * (xMins / 90)) * fxMult;
  const xA = (xa90 * (xMins / 90)) * fxMult;

  const xgc90 = shrink(inp.teamXgcPerMatch, inp.matchesPlayed, 1.35, 6) / (fxMult || 1);
  const pCleanSheet = Math.exp(-xgc90 * (xMins / 90));
  const xGC = xgc90 * (xMins / 90);

  const pDefconBase = shrink(inp.defconHitRate, inp.matchesPlayed, PRIOR_DEFCON[inp.pos] ?? 0.2, 8);
  const pDefcon = Math.min(1, pDefconBase * (xMins / 90) * Math.pow(fxMult, -0.3));

  const goalValue = scoring.goals[inp.pos] ?? 4;
  const csValue = scoring.cleanSheet[inp.pos] ?? 0;

  const xBonus = Math.max(0, Math.min(3,
    BONUS_COEFFS.b0 + BONUS_COEFFS.b1 * xG + BONUS_COEFFS.b2 * xA +
    BONUS_COEFFS.b3 * pCleanSheet + BONUS_COEFFS.b4 * pDefcon +
    (inp.pos === 1 ? BONUS_COEFFS.b5 * (xGC * -1 + 2) : 0),
  ));

  const minutesPts = (xMins >= 60 ? 2 : xMins > 0 ? 1 : 0);
  const negatives = -0.15 * (inp.pos <= 2 ? xGC / 2 : 0) - 0.08;
  const breakdown = {
    minutes: minutesPts * (pAppear > 0 ? 1 : 0),
    goals: xG * goalValue,
    assists: xA * scoring.assist,
    cs: pCleanSheet * csValue,
    defcon: pDefcon * 2,
    bonus: xBonus,
    negatives,
  };

  const xP = Math.max(0, breakdown.minutes + breakdown.goals + breakdown.assists + breakdown.cs + breakdown.defcon + breakdown.bonus + breakdown.negatives);

  const sd =
    Math.sqrt(
      (xG * goalValue ** 2 + xA * scoring.assist ** 2) * 1.2 +
        pCleanSheet * csValue ** 2 * 0.5 +
        4,
    ) || 2;

  return {
    elementId: inp.elementId,
    xMins: round(xMins, 1),
    pStart: round(inp.startRate * pAppear, 3),
    pAppear: round(pAppear, 3),
    xG: round(xG, 2),
    xA: round(xA, 2),
    pCleanSheet: round(pCleanSheet, 3),
    xGC: round(xGC, 2),
    pDefcon: round(pDefcon, 3),
    xBonus: round(xBonus, 2),
    xCards: 0.15,
    xP: round(xP, 1),
    sd: round(sd, 1),
    breakdown: {
      minutes: round(breakdown.minutes, 2),
      goals: round(breakdown.goals, 2),
      assists: round(breakdown.assists, 2),
      cs: round(breakdown.cs, 2),
      defcon: round(breakdown.defcon, 2),
      bonus: round(breakdown.bonus, 2),
      negatives: round(breakdown.negatives, 2),
    },
  };
}

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;
