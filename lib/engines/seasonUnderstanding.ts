/**
 * seasonUnderstanding — the season read the gameweek charts cannot give (v10 D1).
 *
 * The Field's decision board asks what THIS WEEK did to your rank. This asks
 * the slower question: over the season so far, what did each KIND of decision
 * actually pay, and how much of your score was the team rather than the luck.
 *
 * Three shapers, all pure, feeding the tested engines:
 *
 *   ledgerDecisions — per-gameweek decision lines priced in points against
 *                     the neutral default, shaped for shapleyLedger
 *                     (lib/quant/understanding). Shapley's efficiency
 *                     guarantee means the bars sum to the total attributed.
 *   seasonLuck      — the four luck channels summed over every settled
 *                     gameweek, shaped for processVsOutcome.
 *   formSeries      — per-90 contribution observations, shaped for the
 *                     trueForm Kalman filter (lib/quant/estimators).
 *
 * The counterfactual is deliberately simple and stated on the screen: the
 * neutral default is "the same fifteen, nobody doubled, the bench never
 * counted, no transfers made". Pricing it deeper would need every unbought
 * player's weekly score — data the entry history does not carry — and
 * inventing it would be the one thing this codebase refuses to do.
 *
 * One definition of a player's season (lib/engines/performance) is untouched:
 * these read the per-gameweek feeds and the entry history, never re-derive a
 * rate. Pure functions only — composition happens on the server.
 */

import type { ScoringConfig } from "@/lib/engines/types";
import { pointsForOutcome } from "@/lib/engines/scoring";

/** One settled gameweek of your picks, read from that week's own feed. */
export interface GwLine {
  gw: number;
  /** Total points FPL awarded the entry that week. */
  points: number;
  /** Points the bench contributed — what leaving them there was worth. */
  benchPoints: number;
  /** Points paid for hits that week — FPL's own figure, positive. */
  transfersCost: number;
  /** The chip played, if any. */
  chip: string | null;
  /** The XI's live stat lines from that week's feed, captain flagged. */
  pickedStats: {
    element: number;
    pos: number;
    multiplier: number;
    minutes: number;
    /** The raw live score this week — before the multiplier. */
    points: number;
    goals: number;
    assists: number;
    xg: number;
    xa: number;
    bonus: number;
    bps: number;
  }[];
  /** The week's field average, when the rank curve carries one. */
  fieldAvg: number | null;
}

/** Decision lines for the Shapley ledger, per decision KIND over the season. */
export interface LedgerLine {
  key: string;
  valueWithDecision: number;
  valueDefault: number;
}

/**
 * What each kind of decision paid, over the weeks read.
 *
 *   Captaincy  — the multiplier's whole effect: the armband's extra copies of
 *                the captain's points. Default: single, as the field owns him.
 *   Hits       — what the hits cost, straight off FPL's own arithmetic.
 *                Default: zero, the transfer not made.
 *   Bench      — the points your substitutes scored. Default: zero — the
 *                counterfactual "start them instead" is unknowable from
 *                history, and pretending otherwise would be invention.
 *
 * Each line is a sum of per-week marginals, so the Shapley attribution over
 * them is the per-week marginals themselves — the honest reading of "what did
 * this part of how I play pay", with interactions between them stated as none.
 */
export function ledgerDecisions(lines: GwLine[]): LedgerLine[] {
  let captainExtra = 0;
  let hitCost = 0;
  let benchLeft = 0;
  let rawTotal = 0;

  for (const line of lines) {
    hitCost += line.transfersCost;
    benchLeft += line.benchPoints;
    for (const p of line.pickedStats) {
      rawTotal += p.points;
      if (p.multiplier >= 2) captainExtra += p.points * (p.multiplier - 1);
    }
  }

  return [
    {
      key: "Captaincy",
      valueWithDecision: round1(captainExtra),
      valueDefault: 0,
    },
    {
      key: "Hits taken",
      valueWithDecision: round1(-hitCost),
      valueDefault: 0,
    },
    {
      key: "Bench left alone",
      valueWithDecision: round1(benchLeft),
      valueDefault: 0,
    },
    // The neutral spine: the fifteen's raw, unmultiplied points — the thing
    // every decision above modifies. In Shapley terms this is v(∅), which is
    // why the attributions sit on top of it rather than summing to a total
    // nobody can trace.
    {
      key: "The fifteen themselves",
      valueWithDecision: round1(rawTotal),
      valueDefault: 0,
    },
  ];
}

/**
 * The season's luck channels for processVsOutcome.
 *
 * Finishing: Σ(goals − xG) · the position's goal value from the live scoring
 * config — never a hardcoded table. Creation: assists against xA at the
 * assist value. Bonus bounce and minutes are zero here on purpose: the
 * per-week bonus expectation and the expected-minutes model belong to the
 * gameweek charts, and this page does not have FPL's per-week BPS
 * expectation for past weeks. Field: your weekly score against that week's
 * field average from the rank curve.
 */
export function seasonLuck(
  lines: GwLine[],
  scoring: ScoringConfig,
): {
  bonusLuck: number;
  minutesLuck: number;
  finishingLuck: number;
  creationLuck: number;
  fieldLuck: number;
} {
  let finishingLuck = 0;
  let creationLuck = 0;
  let fieldLuck = 0;
  for (const line of lines) {
    for (const p of line.pickedStats) {
      const goalValue = pointsForOutcome("goal", p.pos as 1 | 2 | 3 | 4, scoring);
      finishingLuck += (p.goals - p.xg) * goalValue * p.multiplier;
      creationLuck += (p.assists - p.xa) * scoring.assist * p.multiplier;
    }
    if (line.fieldAvg != null && line.fieldAvg > 0) fieldLuck += line.points - line.fieldAvg;
  }
  return {
    // Zero on purpose — see the doc comment. processVsOutcome's advice only
    // speaks when a channel clears its threshold, so silent channels are safe.
    bonusLuck: 0,
    minutesLuck: 0,
    finishingLuck: round1(finishingLuck),
    fieldLuck: round1(fieldLuck),
    creationLuck: round1(creationLuck),
  };
}

/**
 * One squad player's per-90 observations, oldest first, for the Kalman filter.
 * y90 is expected involvement per 90 — the same input the ask card uses.
 */
export function formSeries(
  history: { round: number; minutes: number; expected_goals: number; expected_assists: number }[],
): { y90: number | null; minutes: number }[] {
  return [...history]
    .sort((a, b) => a.round - b.round)
    .map((h) => ({
      y90:
        h.minutes > 0
          ? ((h.expected_goals ?? 0) + (h.expected_assists ?? 0)) / Math.max(1, h.minutes / 90)
          : null,
      minutes: h.minutes,
    }));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}