import { describe, expect, it } from "vitest";
import { computeEO, eoMarginOfError, fallbackEO } from "@/lib/engines/eo";
import type { Pick } from "@/lib/engines/types";

function squad(entries: [number, number][]): Pick[] {
  return entries.map(([element, multiplier]) => ({
    element,
    position: 1,
    multiplier: multiplier as Pick["multiplier"],
    isCaptain: multiplier === 2,
    isViceCaptain: false,
  }));
}

describe("computeEO", () => {
  it("hand-computed 3-manager cohort", () => {
    // A owned by all + captained by one → EO = 100 + (1×100/3) ≈ 133.3
    // B owned by two, never captain → EO = 66.7 ; C unowned → 0
    const cohort = [
      squad([[101, 2], [102, 1]]),
      squad([[101, 1], [102, 1], [103, 1]]),
      squad([[101, 1]]),
    ];
    const eo = computeEO(cohort, [101, 102, 103]);
    expect(eo.get(101)).toBeCloseTo((4 / 3) * 100, 0);
    expect(eo.get(102)).toBeCloseTo((2 / 3) * 100, 0);
    expect(eo.get(103)).toBeCloseTo(33.3, 0);
  });

  it("triple captain contributes an extra 2×", () => {
    const cohort = [squad([[9, 3]])];
    const eo = computeEO(cohort, [9]);
    expect(eo.get(9)).toBeCloseTo(300, 0);
  });
});

describe("eoMarginOfError", () => {
  it("matches the binomial formula at n=800, p=50%", () => {
    const moe = eoMarginOfError(50, 800);
    expect(moe).toBeGreaterThan(3.4);
    expect(moe).toBeLessThan(3.6);
  });
});

describe("fallbackEO", () => {
  it("most-captained player gets a captaincy bump", () => {
    const base = fallbackEO({ selectedByPercent: 40, pos: 4, mostCaptainedId: null, elementId: 7 });
    const bumped = fallbackEO({ selectedByPercent: 40, pos: 4, mostCaptainedId: 7, elementId: 7 });
    expect(bumped).toBeGreaterThan(base);
  });
});
