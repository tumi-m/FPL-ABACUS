import type { Pos, ScoringConfig } from "@/lib/engines/types";
import { DEFCON_THRESHOLD } from "@/lib/engines/types";

/**
 * A player's season, read match by match.
 *
 * Two things the bootstrap's season totals cannot tell you, both of which come
 * out of the per-match series that element-summary already returns.
 */

/** The one match-level shape both reads need. */
export interface MatchLine {
  round: number;
  minutes: number;
  total_points: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  defensive_contribution: number;
}

export interface DefconRead {
  /** Matches where he cleared his position's line. */
  hits: number;
  /** Matches with a minute or more — the denominator that means something. */
  played: number;
  /** Points actually banked from the lane. */
  points: number;
  threshold: number;
  /** Season total of contributions, most of which may have scored nothing. */
  total: number;
  /** Best single match. */
  best: number;
}

/**
 * What the defensive lane actually paid.
 *
 * The season total is the number every screen shows and it is close to
 * meaningless on its own: contributions are counted per match against a line —
 * ten for a defender, twelve for everyone else — and everything below the line
 * in a given match scores nothing at all. Nine contributions can be nine
 * points' worth of work and zero points; nine in one match and none in the
 * next is two points. Only the per-match series can tell those apart, which is
 * why this takes matches rather than a total.
 *
 * `defensive_contribution` is FPL's own already-position-appropriate figure —
 * recoveries are inside it for a midfielder and outside it for a defender — so
 * it is compared to the threshold as-is. Adding recoveries on top, as the
 * player page used to, double-counts them for exactly the positions where
 * they already count.
 */
export function readDefcon(matches: MatchLine[], pos: Pos, scoring?: ScoringConfig): DefconRead {
  const threshold = DEFCON_THRESHOLD[pos] ?? 99;
  const perHit = scoring?.defconPoints[pos] ?? 2;
  let hits = 0;
  let played = 0;
  let total = 0;
  let best = 0;
  for (const m of matches) {
    total += m.defensive_contribution;
    if (m.defensive_contribution > best) best = m.defensive_contribution;
    if (m.minutes > 0) played++;
    if (threshold < 99 && m.defensive_contribution >= threshold) hits++;
  }
  return { hits, played, points: hits * perHit, threshold, total, best };
}

export interface PointsSource {
  key: string;
  label: string;
  points: number;
}

export interface PointsSplit {
  sources: PointsSource[];
  /** The real season total, straight from the match rows. */
  total: number;
}

/**
 * Where a season's points came from.
 *
 * Derived from the per-match stat lines against the live scoring config rather
 * than hardcoded, because FPL has changed these values mid-era before — the
 * defensive lane did not exist two seasons ago and clean sheets have moved.
 *
 * The last row is a residual: everything the named rows did not account for,
 * against the real total. It exists so the split can never quietly disagree
 * with the number printed at the top of the page. If FPL adds a scoring lane
 * tomorrow, this chart shows it as "other" instead of silently losing it, and
 * the totals still reconcile.
 */
export function splitPoints(matches: MatchLine[], pos: Pos, scoring: ScoringConfig): PointsSplit {
  let appearance = 0;
  let goals = 0;
  let assists = 0;
  let clean = 0;
  let conceded = 0;
  let saves = 0;
  let bonus = 0;
  let defcon = 0;
  let cards = 0;
  let misc = 0;
  let total = 0;

  const threshold = DEFCON_THRESHOLD[pos] ?? 99;
  let savesCarry = 0;
  let concededCarry = 0;

  for (const m of matches) {
    total += m.total_points;
    if (m.minutes <= 0) continue;

    appearance += m.minutes >= 60 ? scoring.minutesLong : scoring.minutesShort;
    goals += m.goals_scored * scoring.goals[pos];
    assists += m.assists * scoring.assist;
    clean += m.clean_sheets * scoring.cleanSheet[pos];
    bonus += m.bonus;
    if (threshold < 99 && m.defensive_contribution >= threshold) defcon += scoring.defconPoints[pos];
    cards += m.yellow_cards * scoring.yellow + m.red_cards * scoring.red;
    misc +=
      m.own_goals * scoring.ownGoal +
      m.penalties_saved * scoring.penSave +
      m.penalties_missed * scoring.penMiss;

    /* Saves and goals conceded score per three and per two, and FPL counts
       them within a match rather than across the season — a keeper with two
       saves in each of two games gets nothing, not one point. Carrying the
       remainder per match keeps that true. */
    savesCarry = m.saves;
    saves += Math.floor(savesCarry / 3) * scoring.savesPer3;
    concededCarry = m.goals_conceded;
    conceded += Math.floor(concededCarry / 2) * scoring.concededPer2[pos];
  }

  const named: PointsSource[] = [
    { key: "appearance", label: "Minutes", points: appearance },
    { key: "goals", label: "Goals", points: goals },
    { key: "assists", label: "Assists", points: assists },
    { key: "clean", label: "Clean sheets", points: clean },
    { key: "defcon", label: "Defensive", points: defcon },
    { key: "bonus", label: "Bonus", points: bonus },
    { key: "saves", label: "Saves", points: saves },
    { key: "conceded", label: "Conceded", points: conceded },
    { key: "cards", label: "Cards", points: cards },
    { key: "misc", label: "Penalties & own goals", points: misc },
  ].filter((s) => s.points !== 0);

  const accounted = named.reduce((sum, s) => sum + s.points, 0);
  const residual = total - accounted;
  if (residual !== 0) named.push({ key: "other", label: "Other", points: residual });

  return { sources: named, total };
}

/** Points per gameweek, oldest first — the series behind the form line. */
export function pointsByGameweek(matches: MatchLine[]): { gw: number; points: number; minutes: number }[] {
  return [...matches]
    .sort((a, b) => a.round - b.round)
    .map((m) => ({ gw: m.round, points: m.total_points, minutes: m.minutes }));
}
