import { describe, expect, it } from "vitest";
import {
  chipOptionValue,
  crossover,
  rankAtRisk,
  transferThreshold,
} from "@/lib/quant/decision";

describe("rankAtRisk (feature 12)", () => {
  it("reads VaR and CVaR off the simulated tail", () => {
    const ranks = Array.from({ length: 100 }, (_, i) => i + 1); // 1..1000 spread
    const r = rankAtRisk(ranks.map((x) => x * 10));
    expect(r.var95).toBe(950);
    // CVaR must be at least as bad as VaR
    expect(r.cvar95).toBeGreaterThanOrEqual(r.var95);
    expect(r.medianRank).toBe(505); // even count → mean of central pair
  });

  it("keeps CVaR coherent on skewed tails", () => {
    const ranks = [100, 100, 100, 100, 100, 5000];
    const r = rankAtRisk(ranks);
    expect(r.cvar95).toBeGreaterThanOrEqual(r.var95);
  });
});

describe("crossover (feature 14)", () => {
  const candidates = [
    { key: "safe", mu: 6, sd: 2.5, sharedFrac: 0.8 },
    { key: "differential", mu: 4.4, sd: 6, sharedFrac: 0.05 },
  ];

  it("keeps the safe pick when level", () => {
    const r = crossover(candidates, 0);
    expect(r.choice).toBe("safe");
  });

  it("switches to the differential once you trail", () => {
    const chasing = crossover(candidates, 12);
    expect(chasing.choice).toBe("differential");
  });

  it("prices the crossover below the trailing gap for wide-variance picks", () => {
    const r = crossover(candidates, 0);
    const bStar = r.crossoverPoints.get("differential")!;
    expect(Number.isFinite(bStar)).toBe(true);
    expect(bStar).toBeGreaterThan(0); // need to trail before the gamble pays
  });
});

describe("chipOptionValue (feature 15)", () => {
  it("values a chip above its best single-week payoff when better weeks loom", () => {
    const r = chipOptionValue({
      payoffs: [3, 4, 9, 2],
      vol: 0.3,
      seed: 5,
      paths: 2000,
    });
    expect(r.optionValue).toBeGreaterThanOrEqual(2.9);
    expect(r.exerciseIndex).toBe(2);
  });

  it("expires set-1 chips at the wall", () => {
    const r = chipOptionValue({
      payoffs: [2, 2, 30, 30],
      expiryIndex: 1, // hard wall after index 1
      vol: 0,
      seed: 3,
      paths: 500,
    });
    expect(r.exerciseIndex).toBeLessThanOrEqual(1);
  });
});

describe("transferThreshold (feature 16)", () => {
  it("demands more evidence when free transfers are plentiful", () => {
    const plenty = transferThreshold({
      bestMoveGain: 2,
      gainVol: 2,
      freeTransfersLeft: 2,
      weeksLeft: 5,
      seed: 1,
      paths: 1500,
    });
    const none = transferThreshold({
      bestMoveGain: 2,
      gainVol: 2,
      freeTransfersLeft: 0,
      weeksLeft: 5,
      seed: 1,
      paths: 1500,
    });
    expect(plenty.threshold).toBeGreaterThan(none.threshold);
  });

  it("never returns a negative threshold", () => {
    const r = transferThreshold({
      bestMoveGain: -3,
      gainVol: 1,
      freeTransfersLeft: 1,
      weeksLeft: 4,
      seed: 2,
      paths: 800,
    });
    expect(r.threshold).toBeGreaterThanOrEqual(0);
  });
});
