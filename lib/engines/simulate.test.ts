import { describe, expect, it } from "vitest";
import { beatProbability, mulberry32, poisson, percentiles, simulatePaired, stdev } from "@/lib/engines/simulate";
import type { SimPlayer } from "@/lib/engines/simulate";

function sp(overrides: Partial<SimPlayer> = {}): SimPlayer {
  return {
    element: 1,
    multiplier: 1,
    started: true,
    pStart: 1,
    pointsSoFar: 2,
    remainingMinutes: 90,
    lambdaGoal: 0.4,
    lambdaAssist: 0.3,
    csStillPossible: true,
    pCleanSheet: 0.3,
    pDefcon: 0.4,
    defconHit: false,
    goalValue: 5,
    csValue: 4,
    ...overrides,
  };
}

describe("simulate", () => {
  it("same seed → byte-identical output", () => {
    const squads = [[sp()], [sp({ element: 2 })]];
    const a = simulatePaired(squads, { runs: 500, seed: 42 });
    const b = simulatePaired(squads, { runs: 500, seed: 42 });
    expect(Array.from(a[0])).toEqual(Array.from(b[0]));
    expect(Array.from(a[1])).toEqual(Array.from(b[1]));
  });

  it("paired runs: P(A>B) + P(B>A) + P(tie) === 1", () => {
    const squads = [[sp()], [sp({ element: 2 })]];
    const [you, rival] = simulatePaired(squads, { runs: 4000, seed: 7 });
    let pYou = 0;
    let pRival = 0;
    for (let i = 0; i < you.length; i++) {
      if (you[i] > rival[i]) pYou++;
      else if (rival[i] > you[i]) pRival++;
    }
    const ties = you.length - pYou - pRival;
    expect((pYou + pRival + ties) / you.length).toBe(1);
  });

  it("paired identical squads tie — shared draws are perfectly correlated", () => {
    const squads = [[sp()], [sp()]];
    const [you, rival] = simulatePaired(squads, { runs: 3000, seed: 99 });
    const p = beatProbability(you, rival);
    expect(p).toBe(0);
  });

  it("a stronger squad beats a weaker one more often than not", () => {
    const squads = [[sp({ lambdaGoal: 0.5 })], [sp({ element: 2, lambdaGoal: 0.2 })]];
    const [you, rival] = simulatePaired(squads, { runs: 3000, seed: 99 });
    const p = beatProbability(you, rival);
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(1);
  });

  it("poisson mean ≈ λ over many draws", () => {
    const rng = mulberry32(123);
    const n = 100_000;
    const lambda = 0.45;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += poisson(rng, lambda);
    expect(sum / n).toBeGreaterThan(lambda - 0.02);
    expect(sum / n).toBeLessThan(lambda + 0.02);
  });

  it("percentiles are ordered", () => {
    const rng = mulberry32(5);
    const dist = new Float32Array(2000);
    for (let i = 0; i < dist.length; i++) dist[i] = rng();
    const p = percentiles(dist, [5, 25, 50, 75, 95]);
    expect(p.get(5)!).toBeLessThan(p.get(50)!);
    expect(p.get(50)!).toBeLessThan(p.get(95)!);
  });

  it("stdev of a constant array is 0", () => {
    expect(stdev(new Float32Array([3, 3, 3]))).toBe(0);
  });
});
