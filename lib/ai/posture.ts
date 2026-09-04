/**
 * posture — the numeric half of a persona (v10 B3).
 *
 * Four gaffers who differ only in adjectives are one gaffer with four
 * voices. The difference a user can feel is *what they advise*, and that
 * lives in numbers, not adjectives: each persona carries a posture that
 * re-weights the same facts the same way every time, and the engine — not
 * the prompt — applies it.
 *
 * A posture is explicit weights over the signals the transfer desk already
 * reads. Nothing here invents data; it ranks the same projections
 * differently:
 *
 *   oleg  — the tactician. Fixture run first, ownership comfort high.
 *           The template exists for a reason.
 *   ana   — the fixture specialist. Fixture run weighted hardest of all,
 *           price pressure read as confirmation (a rising player is one
 *           the market agrees with).
 *   kofi  — the maverick. Differential exposure: low ownership is a
 *           feature, form is trusted, cheap punts score higher than a
 *           template twin.
 *   mei   — the scout. Minutes certainty and points per £m; a punt with
 *           unproven minutes is a wasted transfer however explosive.
 *
 * The reason a persona gives must name its own weights — the card shows
 * why, and the test pins that the stated reason matches the weighting.
 * Pure functions only.
 */
import type { PlannerPlayer } from "@/lib/engines/planner";
import type { PersonaId } from "@/lib/ai/personas";

export interface PersonaPosture {
  id: PersonaId;
  /** Weight on the projected points gap, 0..1 — the base signal. */
  gain: number;
  /** Weight on fixture-run ease over the horizon, 0..1. */
  fixture: number;
  /** Weight on form (recent output) beyond the projection, 0..1. */
  form: number;
  /** Weight on minutes certainty (played football), 0..1. */
  minutes: number;
  /** Weight REWARDING low ownership — differential appetite. 0 for the template. */
  differential: number;
  /** Weight REWARDING a price rise in motion — market confirmation. */
  momentum: number;
  /** Weight on points per £m — value appetite. */
  value: number;
  /** One sentence naming the weighting, for the card to show. */
  reason: string;
}

export const POSTURES: Record<PersonaId, PersonaPosture> = {
  oleg: {
    id: "oleg",
    gain: 1,
    fixture: 0.6,
    form: 0.3,
    minutes: 0.2,
    differential: 0,
    momentum: 0,
    value: 0.1,
    reason: "Template first: proven quality, strong fixture run, high ownership trusted.",
  },
  ana: {
    id: "ana",
    gain: 0.8,
    fixture: 1,
    form: 0.2,
    minutes: 0.2,
    differential: 0.1,
    momentum: 0.4,
    value: 0,
    reason: "Fixture run decides it: swings, doubles and the market confirming the move.",
  },
  kofi: {
    id: "kofi",
    gain: 0.8,
    fixture: 0.3,
    form: 0.6,
    minutes: 0.1,
    differential: 0.8,
    momentum: 0.2,
    value: 0.1,
    reason: "Differential first: low ownership, hot form, the pick the crowd ignored.",
  },
  mei: {
    id: "mei",
    gain: 0.7,
    fixture: 0.2,
    form: 0.3,
    minutes: 1,
    differential: 0.2,
    momentum: 0,
    value: 0.9,
    reason: "Value decides: points per £m and proven minutes over a big price tag.",
  },
};

export interface PosturePlayer extends PlannerPlayer {
  /** Fixture-run gain over the window, as expected-goals share 0..1+. */
  fixtureEase: number;
}

/**
 * Score one candidate swap through a persona's posture.
 *
 * Signals, each normalised to roughly 0..1 before weighting:
 *   gain      — window gain against the field's typical swap (≈4 points).
 *   fixture   — the incoming player's fixture ease this window.
 *   form      — form per 90 minutes scale.
 *   minutes   — minutes played against a full-season pace.
 *   diff      — 1 − ownership/100: the size of the differential bet.
 *   momentum  — price movement this gameweek, clamped at ±2 tenths.
 *   value     — points-per-£m against the market's own scale.
 */
export function postureScore(
  swap: { outPoints: number; inPoints: number },
  incoming: PosturePlayer,
  posture: PersonaPosture,
): number {
  const gainPts = Math.max(0, swap.inPoints - swap.outPoints);
  const sGain = Math.min(1, gainPts / 4);
  const sFixture = clamp01(incoming.fixtureEase);
  const sForm = clamp01(incoming.form / 6);
  const sMinutes = clamp01(incoming.minutes / 1500);
  const sDiff = clamp01(1 - incoming.owned / 100);
  const sMomentum = clamp01((incoming.costChangeEvent + 2) / 4);
  const sValue = clamp01((incoming.points / Math.max(1, incoming.cost / 10)) / 60);
  return (
    posture.gain * sGain +
    posture.fixture * sFixture +
    posture.form * sForm +
    posture.minutes * sMinutes +
    posture.differential * sDiff +
    posture.momentum * sMomentum +
    posture.value * sValue
  );
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface PostureRow {
  outId: number;
  inId: number;
  outPoints: number;
  inPoints: number;
  gain: number;
  /** Cost in tenths — carried through untouched from the desk's row. */
  spend?: number;
}

/**
 * Rank the desk's legal suggestions through a persona's eyes.
 *
 * `suggestTransfers` owns legality and the gain maths; this re-ranks its
 * output by posture so the two can never disagree about whether a move is
 * legal — only about whether it is worth doing. Stable ordering: equal
 * scores keep the desk's order.
 */
export function applyPosture(
  rows: PostureRow[],
  incomingOf: (id: number) => PosturePlayer | undefined,
  posture: PersonaPosture,
): PostureRow[] {
  return rows
    .map((r) => {
      const inc = incomingOf(r.inId);
      const score = inc ? postureScore({ outPoints: r.outPoints, inPoints: r.inPoints }, inc, posture) : -Infinity;
      return { r, score };
    })
    .sort((a, b) => b.score - a.score || a.r.outId - b.r.outId || a.r.inId - b.r.inId)
    .map((x) => x.r);
}

/** The fixture-ease normaliser callers compute once per player. */
export function fixtureEaseOf(
  horizon: number[] | undefined,
  weeks: number,
  basePerGw: number,
): number {
  if (!horizon || horizon.length === 0 || basePerGw <= 0) return 0;
  const projected = horizon.slice(0, weeks).reduce((a, b) => a + b, 0);
  return clamp01(projected / (basePerGw * weeks));
}