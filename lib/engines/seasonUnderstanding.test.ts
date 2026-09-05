import { describe, expect, it } from "vitest";
import { ledgerDecisions, seasonLuck, formSeries, type GwLine } from "./seasonUnderstanding";
import { shapleyLedger } from "@/lib/quant/understanding";
import { trueForm } from "@/lib/quant/estimators";
import { parseScoring } from "@/lib/engines/scoring";

const SCORING = parseScoring({
  goals_scored: { GKP: 10, DEF: 6, MID: 5, FWD: 4 },
  clean_sheets: { GKP: 4, DEF: 4, MID: 1, FWD: 0 },
  goals_conceded: { GKP: -0.5, DEF: -0.5, MID: -0.25, FWD: 0 },
  defensive_contribution: { GKP: 0, DEF: 2, MID: 2, FWD: 0 },
  assists: 3,
  saves: 1,
  penalties_saved: 5,
  penalties_missed: -2,
  yellow_cards: -1,
  red_cards: -3,
  own_goals: -2,
  short_play: 1,
  long_play: 2,
});

const line = (over: Partial<GwLine>): GwLine => ({
  gw: 1,
  points: 60,
  benchPoints: 4,
  transfersCost: 0,
  chip: null,
  fieldAvg: null,
  pickedStats: [],
  ...over,
});

describe("ledgerDecisions", () => {
  it("prices captaincy as the multiplier's extra copies only", () => {
    const lines: GwLine[] = [
      line({
        pickedStats: [
          { element: 1, pos: 3, multiplier: 2, minutes: 90, points: 10, goals: 2, assists: 0, xg: 1, xa: 0, bonus: 1, bps: 30 },
          { element: 2, pos: 4, multiplier: 1, minutes: 90, points: 4, goals: 1, assists: 0, xg: 1, xa: 0, bonus: 0, bps: 10 },
        ],
      }),
    ];
    const [cap] = ledgerDecisions(lines);
    // 2 goals × 5 pts for a mid = 10 raw, doubled = 20, extra = 10.
    expect(cap.key).toBe("Captaincy");
    expect(cap.valueWithDecision).toBe(10);
  });

  it("prices hits straight off FPL's own arithmetic, negative", () => {
    const lines: GwLine[] = [
      line({ transfersCost: 4 }),
      line({ transfersCost: 8 }),
    ];
    const hits = ledgerDecisions(lines).find((l) => l.key === "Hits taken");
    expect(hits?.valueWithDecision).toBe(-12);
  });

  it("prices the bench as the points it actually contributed", () => {
    const lines: GwLine[] = [line({ benchPoints: 7 }), line({ benchPoints: 3 })];
    const bench = ledgerDecisions(lines).find((l) => l.key === "Bench left alone");
    expect(bench?.valueWithDecision).toBe(10);
  });

  it("the fifteen line is the raw, unmultiplied total", () => {
    const lines: GwLine[] = [
      line({
        pickedStats: [
          { element: 1, pos: 3, multiplier: 3, minutes: 90, points: 5, goals: 1, assists: 0, xg: 1, xa: 0, bonus: 0, bps: 0 },
        ],
      }),
    ];
    const fifteen = ledgerDecisions(lines).find((l) => l.key === "The fifteen themselves");
    expect(fifteen?.valueWithDecision).toBe(5);
  });

  it("feeds shapleyLedger and the attributions sum to the signed total", () => {
    const lines: GwLine[] = [
      line({
        transfersCost: 4,
        benchPoints: 5,
        pickedStats: [
          { element: 1, pos: 3, multiplier: 2, minutes: 90, points: 8, goals: 1, assists: 1, xg: 1, xa: 1, bonus: 0, bps: 0 },
        ],
      }),
    ];
    const result = shapleyLedger(ledgerDecisions(lines), { orderings: 50, seed: 1 });
    const sum = [...result.attributions.values()].reduce((s, v) => s + v, 0);
    expect(Math.abs(sum - result.totalAttributed)).toBeLessThan(0.01);
  });
});

describe("seasonLuck", () => {
  it("finishing luck prices goals minus xG at the position's own goal value", () => {
    const lines: GwLine[] = [
      line({
        pickedStats: [
          // A forward: goal value 4. One goal, xG 2 → +8. An assist over xA: +3.
          { element: 1, pos: 4, multiplier: 1, minutes: 90, points: 7, goals: 1, assists: 1, xg: 2, xa: 0, bonus: 0, bps: 0 },
        ],
      }),
    ];
    const luck = seasonLuck(lines, SCORING);
    expect(luck.finishingLuck).toBe(-4); // (1−2)·4
    expect(luck.fieldLuck).toBe(0);
  });

  it("counts the multiplier on finishing luck", () => {
    const lines: GwLine[] = [
      line({
        pickedStats: [
          { element: 1, pos: 3, multiplier: 2, minutes: 90, points: 10, goals: 2, assists: 0, xg: 0, xa: 0, bonus: 0, bps: 0 },
        ],
      }),
    ];
    const luck = seasonLuck(lines, SCORING);
    expect(luck.finishingLuck).toBe(20); // 2 goals × 5 pts × 2 multiplier
  });

  it("field luck reads your weekly score against that week's average", () => {
    const lines: GwLine[] = [
      line({ points: 70, fieldAvg: 55 }),
      line({ points: 40, fieldAvg: 55 }),
    ];
    const luck = seasonLuck(lines, SCORING);
    expect(luck.fieldLuck).toBe(0);
  });
});

describe("formSeries", () => {
  it("sorts oldest first and discounts cameos by minutes", () => {
    const series = formSeries([
      { round: 3, minutes: 90, expected_goals: 0.5, expected_assists: 0.4 },
      { round: 1, minutes: 45, expected_goals: 0.2, expected_assists: 0.1 },
      { round: 2, minutes: 0, expected_goals: 0, expected_assists: 0 },
    ]);
    expect(series[0]!.y90).toBeCloseTo(0.3, 5);
    expect(series[1]!.y90).toBeNull();
    expect(series[2]!.y90).toBeCloseTo(0.9, 5);
  });

  it("feeds trueForm, which widens the band when a match is missed", () => {
    const series = formSeries([
      { round: 1, minutes: 90, expected_goals: 0.5, expected_assists: 0.3 },
      { round: 2, minutes: 0, expected_goals: 0, expected_assists: 0 },
      { round: 3, minutes: 90, expected_goals: 0.4, expected_assists: 0.3 },
    ]);
    const state = trueForm(series);
    const missed = state.filtered[1]!;
    const played = state.filtered[0]!;
    expect(missed.sd).toBeGreaterThan(played.sd);
  });
});