/**
 * performance — actual against expected.
 *
 * FPL's own feed carries both sides of every attacking number: what a player
 * did (goals, assists) and what the chances were worth (xG, xA). The gap
 * between them is the most useful signal in the game and the one the official
 * site never shows you, so this module computes it once, honestly, and the
 * boards render what it returns.
 *
 * Two rules run through everything here:
 *
 * 1. **Small samples lie.** Two goals from 0.4 xG in 90 minutes is noise, not
 *    finishing. Every index is shrunk toward zero by minutes played, so a
 *    part-timer cannot top a board on one lucky afternoon.
 * 2. **Defenders are not forwards.** A clean sheet is an achievement for a
 *    keeper and an accident for a striker, so the headline metric is chosen
 *    per position rather than ranking everyone on goals.
 *
 * Pure functions — no fetching, no React.
 */

import { DEFCON_THRESHOLD } from "@/lib/engines/types";

export type Pos = 1 | 2 | 3 | 4;

/** The season row every board here reads. */
export interface PerfPlayer {
  id: number;
  name: string;
  pos: number;
  teamId: number;
  code: string;
  photo: string;
  cost: number;
  minutes: number;
  starts: number;
  points: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  goalsConceded: number;
  saves: number;
  bonus: number;
  bps: number;
  defcon: number;
  tackles: number;
  recoveries: number;
  cbi: number;
  yellowCards: number;
  redCards: number;
  xg: number;
  xa: number;
  xgi: number;
  xgc: number;
  owned: number;
  /** Dead-ball seniority: 1 is his club's first-choice taker, null is neither. */
  deadBall?: number | null;
}

/** Ninety-minute rate. Zero minutes rate as zero, never as infinity. */
export function per90(total: number, minutes: number): number {
  if (!Number.isFinite(total) || minutes <= 0) return 0;
  return (total * 90) / minutes;
}

/**
 * Shrinkage weight for a sample of `minutes`.
 *
 * A full season is ~3400 minutes; `half` is the point where we trust the
 * observed gap half as much as we would at infinite minutes. 900 minutes —
 * ten full games — is where finishing noise starts to settle.
 */
export const SHRINK_HALF_MINUTES = 900;

export function sampleWeight(minutes: number, half = SHRINK_HALF_MINUTES): number {
  if (minutes <= 0) return 0;
  return minutes / (minutes + half);
}

export interface Delta {
  /** Raw actual − expected over the season. */
  raw: number;
  /** The same gap per ninety minutes. */
  per90: number;
  /** Shrunk toward zero by minutes — what the boards rank on. */
  index: number;
  actual: number;
  expected: number;
}

function delta(actual: number, expected: number, minutes: number): Delta {
  const raw = actual - expected;
  return {
    raw: round2(raw),
    per90: round2(per90(raw, minutes)),
    index: round2(raw * sampleWeight(minutes)),
    actual: round2(actual),
    expected: round2(expected),
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Goals against the chances taken — the finishing read. */
export function finishing(p: PerfPlayer): Delta {
  return delta(p.goals, p.xg, p.minutes);
}

/** Assists against the chances created — the creation read. */
export function creation(p: PerfPlayer): Delta {
  return delta(p.assists, p.xa, p.minutes);
}

/** Goals plus assists against expected involvement. */
export function involvement(p: PerfPlayer): Delta {
  return delta(p.goals + p.assists, p.xgi, p.minutes);
}

/**
 * Expected clean sheets.
 *
 * Goals arrive Poisson, so a shutout is P(0) = e^(−λ) with λ the expected
 * goals conceded in that match. We only have the season total, so λ is the
 * per-90 rate and the expectation is that probability across the matches the
 * player actually started. It is an estimate and the UI says so — but it is
 * the right shape, and far better than comparing clean sheets to nothing.
 */
export function expectedCleanSheets(p: PerfPlayer): number {
  const appearances = p.starts > 0 ? p.starts : Math.round(p.minutes / 90);
  if (appearances <= 0) return 0;
  const lambda = per90(p.xgc, p.minutes);
  return round2(appearances * Math.exp(-lambda));
}

/** Clean sheets kept against the shutouts the fixtures were worth. */
export function defending(p: PerfPlayer): Delta {
  return delta(p.cleanSheets, expectedCleanSheets(p), p.minutes);
}

/**
 * The headline over/underperformance index for a player, chosen by position.
 *
 * Keepers and defenders are judged on shutouts, midfielders on total
 * involvement, forwards on finishing — the way the scoring system actually
 * pays them.
 */
export function positionalDelta(p: PerfPlayer): { key: "defending" | "involvement" | "finishing"; label: string; delta: Delta } {
  if (p.pos <= 2) return { key: "defending", label: "Clean sheets vs expected", delta: defending(p) };
  if (p.pos === 3) return { key: "involvement", label: "Goals + assists vs expected", delta: involvement(p) };
  return { key: "finishing", label: "Goals vs expected", delta: finishing(p) };
}

export type Verdict = "over" | "par" | "under";

/** Where a shrunk index sits relative to "doing exactly what the chances said". */
export function verdict(index: number, band = 0.75): Verdict {
  if (index > band) return "over";
  if (index < -band) return "under";
  return "par";
}

/** DEFCON: the 2025/26 defensive-contribution threshold that scores 2 points. */
/**
 * Contributions needed in a match to score, by position.
 *
 * Delegates to the engine's own table rather than restating it. This used to
 * be `pos === 2 ? 10 : 12`, which handed goalkeepers a threshold of twelve —
 * so the board printed "GK · needs 12" and, once it started showing what the
 * lane paid, would have credited keepers points from a lane FPL does not let
 * them score in. The table says 99 for a keeper, which is how the rest of the
 * app spells "no defensive lane at all".
 */
export function defconThreshold(pos: number): number {
  return DEFCON_THRESHOLD[pos as 1 | 2 | 3 | 4] ?? 12;
}

/** Does this position score from the defensive lane at all? */
export function hasDefconLane(pos: number): boolean {
  return defconThreshold(pos) < 99;
}

/**
 * Rough count of matches where a player cleared the DEFCON threshold.
 *
 * FPL publishes the season total, not the per-match series, so this divides
 * the total by the threshold and caps at appearances — an upper bound on
 * hits, not a measured count. Labelled as an estimate wherever it renders.
 */
export function defconHitsEstimate(p: PerfPlayer): number {
  const appearances = p.starts > 0 ? p.starts : Math.round(p.minutes / 90);
  if (appearances <= 0) return 0;
  return Math.min(appearances, Math.floor(p.defcon / defconThreshold(p.pos)));
}

/** Cards per ninety — the booking risk read. */
export function cardRate(p: PerfPlayer): number {
  return round2(per90(p.yellowCards + p.redCards, p.minutes));
}

/** Bonus per ninety — who converts performances into the 1·2·3. */
export function bonusRate(p: PerfPlayer): number {
  return round2(per90(p.bonus, p.minutes));
}

/**
 * BPS earned per bonus point taken.
 *
 * A low number means a player converts efficiently: they win the 1·2·3 rather
 * than piling up BPS in matches somebody else tops. Null until they have
 * actually taken bonus.
 */
export function bonusEfficiency(p: PerfPlayer): number | null {
  if (p.bonus <= 0) return null;
  return round2(p.bps / p.bonus);
}

/** Points per million — the value read, on current price. */
export function valuePerMillion(p: PerfPlayer): number {
  if (p.cost <= 0) return 0;
  return round2(p.points / (p.cost / 10));
}

/**
 * Percentile of `value` within `population`, 0..1.
 *
 * Ties share the midpoint so a population of identical values sits at 0.5
 * rather than everyone claiming the top.
 */
export function percentile(value: number, population: number[]): number {
  if (population.length === 0) return 0;
  let below = 0;
  let equal = 0;
  for (const v of population) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return (below + equal / 2) / population.length;
}

/**
 * A sensible starting minutes floor for a population.
 *
 * A fixed 450 is right in March and absurd in August — in gameweek one it
 * empties every board. Scale it to how much football has actually been played:
 * roughly a third of what the busiest player has managed, rounded to whole
 * matches, and never more than five games.
 */
export function defaultMinutesFloor(players: { minutes: number }[], cap = 450): number {
  const most = players.reduce((m, p) => Math.max(m, p.minutes), 0);
  if (most <= 0) return 0;
  // Never below half a match: two contributions in fourteen minutes rates at
  // 12.9 per 90 and would otherwise top every rate board in gameweek one.
  return Math.min(cap, Math.max(45, Math.floor((most * 0.35) / 90) * 90));
}

/** Minutes floor for a board — keeps one-cameo flukes off the leaderboards. */
export function meetsMinutes(p: PerfPlayer, minMinutes: number): boolean {
  return p.minutes >= minMinutes;
}

export interface RankedBoard<T> {
  rows: T[];
  /** Population size the ranking was taken from, after the minutes filter. */
  eligible: number;
}

/** Filter by minutes, score, sort, cut. One place so every board behaves alike. */
export function rankBoard<T extends PerfPlayer>(
  players: T[],
  opts: {
    minMinutes: number;
    score: (p: T) => number;
    /** Ascending when smaller is the achievement (goals conceded, cards). */
    ascending?: boolean;
    limit: number;
    pos?: number | null;
    teamId?: number | null;
    search?: string;
  },
): RankedBoard<T> {
  const q = opts.search?.trim().toLowerCase() ?? "";
  const pool = players.filter((p) => {
    if (!meetsMinutes(p, opts.minMinutes)) return false;
    if (opts.pos != null && p.pos !== opts.pos) return false;
    if (opts.teamId != null && p.teamId !== opts.teamId) return false;
    if (q && !p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false;
    return true;
  });
  const sorted = [...pool].sort((a, b) => {
    const d = opts.ascending ? opts.score(a) - opts.score(b) : opts.score(b) - opts.score(a);
    return d !== 0 ? d : b.points - a.points;
  });
  return { rows: sorted.slice(0, opts.limit), eligible: pool.length };
}
