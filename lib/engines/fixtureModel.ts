/**
 * fixtureModel — Phase E. Rolling-window opponent goal rates per 90, shrunk
 * toward the league mean (k=6), venue adjusted, quantile-mapped onto the
 * 1..6 fixture heat. Pure functions only — composition happens on the server.
 */
import type { Fixture } from "@/lib/fpl/schemas";
import type { Pos } from "@/lib/engines/types";

export type ColourModel = "xg" | "fdr" | "odds";

export interface TeamRate {
  /** Shrunk goals scored per 90 across the rolling window. */
  attack90: number;
  /** Shrunk goals conceded per 90 across the rolling window. */
  defence90: number;
  /** Completed matches inside the window. */
  sample: number;
}

export interface LeagueRates {
  meanAttack90: number;
  meanDefence90: number;
  /** Multiplicative venue factors derived from the same window (>1 boosts). */
  homeFactor: number;
  awayFactor: number;
}

export interface FixtureModel {
  teams: Map<number, TeamRate>;
  league: LeagueRates;
}

export interface ModelOptions {
  /** Rolling window length in completed matches (spec: 38). */
  window?: number;
  /** Shrinkage strength toward the league mean. */
  k?: number;
}

const FALLBACK_LEAGUE: LeagueRates = {
  meanAttack90: 1.35,
  meanDefence90: 1.35,
  homeFactor: 1.08,
  awayFactor: 0.92,
};

interface RawMatch {
  event: number;
  kickoff: string | null;
  home: boolean;
  gf: number;
  ga: number;
}

/** Completed matches only, ordered so the window keeps the most recent. */
function collectMatches(fixtures: Fixture[], upToGw: number): Map<number, RawMatch[]> {
  const byTeam = new Map<number, RawMatch[]>();
  const done = fixtures.filter(
    (f) =>
      f.event != null &&
      f.event <= upToGw &&
      f.team_h_score != null &&
      f.team_a_score != null,
  );
  for (const f of done) {
    byTeam.set(f.team_h, [
      ...(byTeam.get(f.team_h) ?? []),
      {
        event: f.event!,
        kickoff: f.kickoff_time ?? null,
        home: true,
        gf: f.team_h_score!,
        ga: f.team_a_score!,
      },
    ]);
    byTeam.set(f.team_a, [
      ...(byTeam.get(f.team_a) ?? []),
      {
        event: f.event!,
        kickoff: f.kickoff_time ?? null,
        home: false,
        gf: f.team_a_score!,
        ga: f.team_h_score!,
      },
    ]);
  }
  return byTeam;
}

function shrink(x: number, n: number, prior: number, k: number): number {
  if (n <= 0) return prior;
  return (n * x + k * prior) / (n + k);
}

export function buildFixtureModel(
  fixtures: Fixture[],
  opts: ModelOptions & { upToGw: number },
): FixtureModel {
  const window = Math.max(1, Math.min(38, opts.window ?? 38));
  const k = opts.k ?? 6;
  const byTeam = collectMatches(fixtures, opts.upToGw);

  // League means over ALL completed matches in range (the shrinkage prior).
  let gf = 0;
  let ga = 0;
  let homeGf = 0;
  let matches = 0;
  for (const ms of byTeam.values()) {
    for (const m of ms) {
      gf += m.gf;
      ga += m.ga;
      if (m.home) homeGf += m.gf;
    }
    matches += ms.length;
  }
  // Each match contributes two entries; means are per-team-match.
  const n = matches || 1;
  const meanAttack90 = gf / n;
  const meanDefence90 = ga / n || meanAttack90;
  const shareHome = homeGf / (gf || 1);
  const homeFactor = matches > 0 ? Math.min(1.25, Math.max(0.9, shareHome * 2)) : FALLBACK_LEAGUE.homeFactor;
  const awayFactor = matches > 0 ? Math.min(1.15, Math.max(0.75, 2 - homeFactor)) : FALLBACK_LEAGUE.awayFactor;

  const teams = new Map<number, TeamRate>();
  for (const [teamId, ms] of byTeam) {
    const recent = [...ms]
      .sort((a, b) => a.event - b.event || String(a.kickoff).localeCompare(String(b.kickoff)))
      .slice(-window);
    const sample = recent.length;
    const rawAttack = recent.reduce((s, m) => s + m.gf, 0) / Math.max(1, sample) ;
    const rawDefence = recent.reduce((s, m) => s + m.ga, 0) / Math.max(1, sample);
    teams.set(teamId, {
      attack90: shrink(rawAttack, sample, meanAttack90, k),
      defence90: shrink(rawDefence, sample, meanDefence90, k),
      sample,
    });
  }

  return {
    teams,
    league: {
      meanAttack90,
      meanDefence90,
      homeFactor,
      awayFactor,
    },
  };
}

export interface FixtureProjection {
  /** Projected goals for the team in question, per 90. */
  xgFor: number;
  /** Projected goals conceded by the team in question, per 90. */
  xgAgainst: number;
}

/** Ratio-of-rates projection with venue adjustment. */
export function projectFixture(
  model: FixtureModel,
  teamId: number,
  opponentId: number,
  wasHome: boolean,
): FixtureProjection {
  const me = model.teams.get(teamId);
  const opp = model.teams.get(opponentId);
  const l = model.league;
  const myAttack = me?.attack90 ?? l.meanAttack90;
  const myDefence = me?.defence90 ?? l.meanDefence90;
  const oppAttack = opp?.attack90 ?? l.meanAttack90;
  const oppDefence = opp?.defence90 ?? l.meanDefence90;

  const venueMine = wasHome ? l.homeFactor : l.awayFactor;
  const venueTheirs = wasHome ? l.awayFactor : l.homeFactor;

  return {
    xgFor: myAttack * (oppDefence / l.meanDefence90) * venueMine,
    xgAgainst: oppAttack * (myDefence / l.meanDefence90) * venueTheirs,
  };
}

/**
 * Position-aware easiness — the SAME fixture must colour differently for a
 * defender (wants opp attacks blunted) than an attacker (wants weak opp
 * defences). Higher = easier. Gabriel ≠ Watkins is the acceptance test.
 */
export function easiness(p: FixtureProjection, pos: Pos): number {
  if (pos <= 2) return -p.xgAgainst; // GK/DEF: fewer opp goals = better
  return p.xgFor; // MID/FWD: more our goals = better
}

/** Quantile cut points for k buckets (k-1 interior cuts). */
export function quantileCuts(values: number[], k = 6): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const cuts: number[] = [];
  for (let i = 1; i < k; i++) {
    const idx = (sorted.length - 1) * (i / k);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    cuts.push(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
  }
  return cuts;
}

/** Map a value onto 1..k against precomputed cuts (higher value → higher heat). */
export function bucket(value: number, cuts: number[]): number {
  let b = 0;
  for (const c of cuts) {
    if (value > c) b++;
  }
  return b + 1;
}

/** UPPERCASE = home, lowercase = away — the grid encoding. */
export function cellCode(opponentShort: string, wasHome: boolean): string {
  const s = opponentShort.toUpperCase();
  return wasHome ? s : s.toLowerCase();
}

/** Official FDR mapped into the six-step heat (stub keeps 1..5 granularity). */
export function fdrHeat(difficulty: number): number {
  return Math.min(5, Math.max(1, Math.round(difficulty)));
}

/** Odds-stub colour model from static overall strength ratings. */
export function oddsStubHeat(strengthSelf: number, strengthOpp: number): number {
  const gap = strengthSelf - strengthOpp; // −ish…+ish
  const t = Math.max(-8, Math.min(8, gap));
  return Math.round(((t + 8) / 16) * 5) + 1; // 1..6
}
