import { pointsForOutcome } from "@/lib/engines/scoring";
import type { Pos, ScoringConfig, Multiplier } from "@/lib/engines/types";

export type Outcome = "goal" | "assist" | "cleanSheet" | "defcon" | "blank" | "card";

export const OUTCOMES: Outcome[] = ["goal", "assist", "cleanSheet", "defcon", "blank", "card"];

const KNOCK_ON_BONUS: Record<Outcome, number> = {
  goal: 1.2,
  assist: 0.8,
  cleanSheet: 0.6,
  defcon: 0.3,
  blank: 0,
  card: -0.2,
};

function pointsFor(o: Outcome, pos: Pos, scoring: ScoringConfig): number {
  switch (o) {
    case "goal":
      return pointsForOutcome("goal", pos, scoring);
    case "assist":
      return scoring.assist;
    case "cleanSheet":
      return scoring.cleanSheet[pos];
    case "defcon":
      return scoring.defconPoints[pos];
    case "blank":
      return 0;
    case "card":
      return -1;
  }
}

export interface LeverageRow {
  element: number;
  perOutcome: { outcome: Outcome; points: number; ranks: number; p: number }[];
  expected: number;
  exposure: number;
  /** positive = you own the upside; negative = the field does and you don't */
  direction: number;
}

export function leverageRow(p: {
  element: number;
  pos: Pos;
  yourMult: Multiplier;
  eo: number;
  scoring: ScoringConfig;
  ranksPerPt: number;
  minutesRemaining: number;
  outcomeProbabilities?: Partial<Record<Outcome, number>>;
}): LeverageRow {
  const rel = p.yourMult - p.eo / 100;
  const value = (o: Outcome) => pointsFor(o, p.pos, p.scoring) + KNOCK_ON_BONUS[o];
  const swing = (o: Outcome) => rel * value(o) * p.ranksPerPt;

  const probs = OUTCOMES.map((o) => p.outcomeProbabilities?.[o] ?? 0);

  return {
    element: p.element,
    perOutcome: OUTCOMES.map((o) => ({
      outcome: o,
      points: value(o),
      ranks: swing(o),
      p: probs[OUTCOMES.indexOf(o)],
    })),
    expected: OUTCOMES.reduce((s, o) => s + (probs[OUTCOMES.indexOf(o)] ?? 0) * swing(o), 0),
    exposure: Math.abs(rel) * (p.minutesRemaining / 90),
    direction: rel > 0 ? 1 : rel < 0 ? -1 : 0,
  };
}
