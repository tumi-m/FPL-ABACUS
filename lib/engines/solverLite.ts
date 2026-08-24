/**
 * solver-lite — prices staged transfers across the full horizon in rank
 * equity, not next-week ep deltas. Per-GW projections come from the Board's
 * fixture model, keyed to position (Gabriel ≠ Watkins): attackers care about
 * blunt opposition defences, defenders about blunt opposition attacks. The
 * payback marker is the first horizon GW where cumulative gain covers the
 * hit; the rank price converts net points into rank swing at the hero's
 * position on the season curve. Pure functions — composition on the server.
 */
import type { FixtureModel } from "@/lib/engines/fixtureModel";

export interface HorizonPlayer {
  pos: number; // 1 GK · 2 DEF · 3 MID · 4 FWD
  teamId: number;
  /** Blended expectation against a league-average fixture (≥ 0). */
  base: number;
  /** 0..1 availability share across the horizon. */
  availability: number;
}

export interface FixtureLookup {
  opponentId: number;
  wasHome: boolean;
}

/** Blend FPL's own next-gw projection with recent form — neither alone is honest. */
export function blendBase(epNext: number | null, form: number): number {
  const f = Number.isFinite(form) ? form : 0;
  if (epNext == null || !Number.isFinite(epNext)) return f;
  return (epNext + f) / 2;
}

/** Status + published chance of playing → availability share for the horizon. */
export function availabilityOf(status: string, chanceOfPlaying: number | null): number {
  const chance =
    chanceOfPlaying == null ? null : chanceOfPlaying > 1 ? chanceOfPlaying / 100 : chanceOfPlaying;
  if (status === "a") return Math.min(1, chance ?? 1);
  if (status === "d") return Math.min(1, (chance ?? 0.75));
  return 0;
}

const clampMult = (v: number) => Math.min(1.5, Math.max(0.6, v));

/**
 * Projected xP per horizon GW — blank weeks are zero, double weeks stack
 * (each fixture contributes its own multiplier to the same 90-minute base).
 * The fixture factor is opponent+venue only (own-team quality already lives
 * in `base`, so it is not double counted): attackers scale by opposition
 * defence, defenders by the bluntness of opposition attack.
 */
export function projectHorizon(
  p: HorizonPlayer,
  gws: number[],
  model: FixtureModel,
  /** All fixtures for the team that GW — empty array means a blank week. */
  fixturesFor: (teamId: number, gw: number) => FixtureLookup[],
): number[] {
  const l = model.league;
  const base = p.base * p.availability;
  return gws.map((gw) => {
    const fxs = fixturesFor(p.teamId, gw);
    if (!fxs || fxs.length === 0 || base <= 0) return 0;
    let total = 0;
    for (const fx of fxs) {
      const opp = model.teams.get(fx.opponentId);
      const oppDef = opp?.defence90 ?? l.meanDefence90;
      const oppAtt = opp?.attack90 ?? l.meanAttack90;
      const venueMine = fx.wasHome ? l.homeFactor : l.awayFactor;
      const venueTheirs = fx.wasHome ? l.awayFactor : l.homeFactor;
      const mult =
        p.pos <= 2
          ? clampMult(l.meanAttack90 / Math.max(0.2, oppAtt * venueTheirs))
          : clampMult((oppDef / l.meanDefence90) * venueMine);
      total += base * mult;
    }
    return Math.round(total * 100) / 100;
  });
}

export interface MovePrice {
  /** Σ projected(in) − Σ projected(out) across the horizon. */
  gain: number;
  hitCost: number;
  /** First horizon GW (1-based count) where cumulative gain covers the hit. */
  paybackGw: number | null;
  /** (gain − hitCost) × ranks-per-point at the hero's total; null without a curve. */
  rankSwing: number | null;
}

export function priceMove(
  outHorizon: number[],
  inHorizon: number[],
  opts: { hitCost: number; ranksPerPoint: number | null },
): MovePrice {
  const n = Math.min(outHorizon.length, inHorizon.length);
  let gain = 0;
  let paybackGw: number | null = null;
  for (let i = 0; i < n; i++) {
    gain += inHorizon[i] - outHorizon[i];
    if (paybackGw == null && opts.hitCost > 0 && gain >= opts.hitCost) paybackGw = i + 1;
  }
  gain = Math.round(gain * 100) / 100;
  return {
    gain,
    hitCost: opts.hitCost,
    paybackGw,
    rankSwing:
      opts.ranksPerPoint != null
        ? Math.round((gain - opts.hitCost) * opts.ranksPerPoint)
        : null,
  };
}

/** Desk-level verdict: net horizon points and net rank swing across all staged moves. */
export function deskVerdict(
  prices: MovePrice[],
): { netPoints: number; netRankSwing: number | null } {
  let netPoints = 0;
  let rankSum = 0;
  let anyRank = false;
  for (const p of prices) {
    netPoints += p.gain - p.hitCost;
    if (p.rankSwing != null) {
      rankSum += p.rankSwing;
      anyRank = true;
    }
  }
  return {
    netPoints: Math.round(netPoints * 100) / 100,
    netRankSwing: anyRank ? Math.round(rankSum) : null,
  };
}
