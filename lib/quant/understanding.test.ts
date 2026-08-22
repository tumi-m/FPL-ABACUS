import { describe, expect, it } from "vitest";
import { processVsOutcome, shapleyLedger } from "@/lib/quant/understanding";

describe("shapleyLedger (feature 9)", () => {
  const decisions = [
    { key: "transfer-in-haaland", valueWithDecision: 12, valueDefault: 2 },
    { key: "captain-salah", valueWithDecision: 9, valueDefault: 4 },
    { key: "bench-order-gk", valueWithDecision: 3, valueDefault: 5 },
  ];

  it("is efficient — attributions sum to the total move", () => {
    const r = shapleyLedger(decisions, { orderings: 400, seed: 3 });
    const expectedTotal = decisions.reduce((s, d) => s + (d.valueWithDecision - d.valueDefault), 0);
    expect(r.totalAttributed).toBeCloseTo(expectedTotal, 5);
    expect(r.orderings).toBe(400);
  });

  it("credits the big swing and charges the bench mistake", () => {
    const r = shapleyLedger(decisions, { orderings: 500, seed: 5 });
    expect(r.attributions.get("transfer-in-haaland")!).toBeGreaterThan(0);
    expect(r.attributions.get("captain-salah")!).toBeCloseTo(5, 1); // 9−4
    expect(r.attributions.get("bench-order-gk")!).toBeLessThan(0); // −2 mistake
  });

  it("reports standard errors that shrink with more orderings", () => {
    const few = shapleyLedger(decisions, { orderings: 20, seed: 1 });
    const many = shapleyLedger(decisions, { orderings: 1000, seed: 1 });
    for (const [k, se] of many.standardErrors) {
      expect(se).toBeLessThanOrEqual(few.standardErrors.get(k)! + 1e-9);
    }
  });

  it("is deterministic per seed", () => {
    expect(shapleyLedger(decisions, { orderings: 60, seed: 9 })).toEqual(
      shapleyLedger(decisions, { orderings: 60, seed: 9 }),
    );
  });
});

describe("processVsOutcome (feature 11)", () => {
  it("decomposes luck into the four channels", () => {
    const r = processVsOutcome({
      bonusLuck: 2,
      minutesLuck: -6,
      finishingLuck: -8,
      fieldLuck: 3,
    });
    expect(r.luckTotal).toBe(-9);
    expect(r.processScore).toBe(0);
    expect(r.outcomeScore).toBe(r.luckTotal);
  });

  it("advises hold on cold finishing but act on lost minutes", () => {
    const r = processVsOutcome({ bonusLuck: 0, minutesLuck: -7, finishingLuck: -9, fieldLuck: 0 });
    expect(r.advice.some((a) => a.includes("reverts"))).toBe(true);
    expect(r.advice.some((a) => a.includes("squad-construction"))).toBe(true);
  });

  it("stays quiet inside noise bands", () => {
    const r = processVsOutcome({ bonusLuck: 1, minutesLuck: -2, finishingLuck: 4, fieldLuck: 0 });
    expect(r.advice).toHaveLength(0);
  });
});
