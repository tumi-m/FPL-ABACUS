import { describe, expect, it } from "vitest";
import { impact, importance } from "@/lib/engines/league";

describe("impact", () => {
  it("your captain vs a fully-owned field gains his live points", () => {
    // (2 − 100/100) × 10 = 10
    expect(impact(2, 100, 10)).toBe(10);
  });

  it("your captain vs half-owned field gains proportionally", () => {
    // (2 − 50/100) × 10 = 15
    expect(impact(2, 50, 10)).toBe(15);
  });

  it("an unowned player scoring when nobody owns him is neutral", () => {
    expect(impact(0, 0, 8)).toBe(0);
  });

  it("an unowned threat costs you its owned share of the points", () => {
    // (0 − 25/100) × 8 = −2
    expect(impact(0, 25, 8)).toBe(-2);
  });
});

describe("importance", () => {
  it("identical multipliers across managers → zero spread", () => {
    expect(importance(2, [2, 2], 90, 4)).toBe(0);
  });

  it("hand-computed spread for two managers at full time", () => {
    // mults [2, 0]: mean 1, population sd 1 → 1 × (90/90) × 4
    expect(importance(2, [0], 90, 4)).toBeCloseTo(4, 6);
  });

  it("scales linearly with remaining minutes", () => {
    expect(importance(2, [0], 45, 4)).toBeCloseTo(2, 6);
  });

  it("zero expected remaining points → zero", () => {
    expect(importance(2, [0], 90, 0)).toBe(0);
  });
});
