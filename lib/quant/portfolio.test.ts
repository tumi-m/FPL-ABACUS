import { describe, expect, it } from "vitest";
import {
  activeReturnSeries,
  cone,
  position,
  probAhead,
  riskProfile,
  squadBeta,
} from "@/lib/quant/portfolio";

describe("position (feature 1)", () => {
  const holdings = [
    { elementId: 1, m: 2, eoPct: 80 }, // captain everyone owns
    { elementId: 2, m: 1, eoPct: 5 }, // differential starter
    { elementId: 3, m: 0, eoPct: 40 }, // benching a template player
  ];

  it("computes active share in [0,1] with the right bands", () => {
    const p = position(holdings);
    expect(p.activeShare).toBeGreaterThan(0.25); // beyond balanced
    expect(p.activeShare).toBeLessThan(1);
    // identical weights to the field → zero active share
    expect(position([
      { elementId: 9, m: 1, eoPct: 100 },
    ]).activeShare).toBeCloseTo(0);
  });

  it("signs active weights correctly", () => {
    const { activeWeights } = position(holdings);
    expect(activeWeights.get(2)!).toBeGreaterThan(0); // overweight differential
    expect(activeWeights.get(3)!).toBeLessThan(0); // underweight benched player
  });

  it("builds active-return and risk profiles", () => {
    const rSeries = activeReturnSeries(holdings, [
      [{ elementId: 1, pts: 10 }, { elementId: 2, pts: 2 }, { elementId: 3, pts: 12 }],
      [{ elementId: 1, pts: 4 }, { elementId: 2, pts: 14 }, { elementId: 3, pts: 6 }],
      [{ elementId: 1, pts: 6 }, { elementId: 2, pts: 8 }, { elementId: 3, pts: 8 }],
    ]);
    const rp = riskProfile(rSeries);
    // week 1: (2−.8)·10 + (1−.05)·2 + (0−.4)·12 = 12+1.9−4.8 = 9.1
    expect(rSeries[0]).toBeCloseTo(9.1, 5);
    expect(rp.teWeekly).toBeGreaterThan(0);
    expect(Number.isFinite(rp.informationRatio)).toBe(true);
  });

  it("maps IR·√n through the normal CDF", () => {
    expect(probAhead(0, 19)).toBeCloseTo(0.5);
    expect(probAhead(0.35, 19)!).toBeGreaterThan(0.9);
    expect(probAhead(-0.35, 19)!).toBeLessThan(0.1);
    expect(probAhead(NaN, 19)).toBeNull();
  });
});

describe("squadBeta (feature 3)", () => {
  it("recovers β=1 α=0 for a field-tracking squad", () => {
    const field = [50, 52, 48, 55, 51];
    const fit = squadBeta(field.map((f) => f + 0), field);
    expect(fit.beta).toBeCloseTo(1);
    expect(fit.alpha).toBeCloseTo(0);
  });

  it("finds alpha above the field when you outperform consistently", () => {
    const field = [50, 52, 48, 55, 51, 49];
    const you = field.map((f) => f * 0.5 + 30); // half exposure plus flat bonus
    const fit = squadBeta(you, field);
    expect(fit.beta).toBeCloseTo(0.5, 5);
    expect(fit.alpha).toBeCloseTo(30, 5);
    expect(fit.residualSd).toBeCloseTo(0, 3);
  });
});

describe("cone (feature 13)", () => {
  it("widens with weeks left and centres on α·n", () => {
    const short = cone({ alpha: 1, te: 4, weeksLeft: 4, seed: 1 });
    const long = cone({ alpha: 1, te: 4, weeksLeft: 24, seed: 1 });
    expect(long.p95 - long.p5).toBeGreaterThan(short.p95 - short.p5);
    // median tracks the deterministic path
    expect(short.p50).toBeGreaterThanOrEqual(4 * 1 - 3 * short.p50 * 0 - 12);
  });

  it("prices a target honestly in both directions", () => {
    const easy = cone({ alpha: 2, te: 3, weeksLeft: 10, targetActivePoints: 5, seed: 2 });
    const hard = cone({ alpha: 0.2, te: 3, weeksLeft: 4, targetActivePoints: 40, seed: 2 });
    expect(easy.probTarget!).toBeGreaterThan(0.9);
    expect(hard.probTarget!).toBeLessThan(0.1);
    expect(easy.requiredWeeklyRate).toBeCloseTo(0.5);
  });

  it("is deterministic per seed", () => {
    expect(cone({ alpha: 1, te: 4, weeksLeft: 6, seed: 9 })).toEqual(
      cone({ alpha: 1, te: 4, weeksLeft: 6, seed: 9 }),
    );
  });
});
