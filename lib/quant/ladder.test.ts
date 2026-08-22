import { describe, expect, it } from "vitest";
import { glickoStep, scoresFromPoints, type GlickoPlayer } from "@/lib/quant/ladder";

const START: GlickoPlayer = { rating: 1500, rd: 350, volatility: 0.06 };

function cohort(n: number, rating = 1500) {
  return Array.from({ length: n }, () => ({ rating, rd: 350 }));
}

describe("glickoStep (feature 20)", () => {
  it("moves the rating up after beating a large sample", () => {
    const opponents = cohort(50).map((c) => ({ ...c, score: 1 as const }));
    const after = glickoStep(START, opponents);
    expect(after.rating).toBeGreaterThan(1500);
    // A big confident sample also tightens the deviation.
    expect(after.rd).toBeLessThan(START.rd);
  });

  it("moves down after losing and keeps RD sane", () => {
    const opponents = cohort(40).map((c) => ({ ...c, score: 0 as const }));
    const after = glickoStep(START, opponents);
    expect(after.rating).toBeLessThan(1500);
    expect(after.rd).toBeGreaterThan(30);
    expect(after.rd).toBeLessThan(350);
  });

  it("widens RD when inactive without touching the rating", () => {
    const idle = { rating: 1620, rd: 60, volatility: 0.06 };
    const after = glickoStep(idle, []);
    expect(after.rating).toBe(1620);
    expect(after.rd).toBeGreaterThan(60);
    expect(after.rd).toBeLessThanOrEqual(350);
  });

  it("is volatile-then-stable: second identical period moves less", () => {
    const win = cohort(30).map((c) => ({ ...c, score: 1 as const }));
    const first = glickoStep(START, win);
    const second = glickoStep({ ...first }, win.map((w) => ({ ...w })));
    expect(Math.abs(second.rating - first.rating)).toBeLessThan(
      Math.abs(first.rating - START.rating),
    );
  });

  it("produces finite volatility inside the constraint band", () => {
    const mixed = [
      ...cohort(10).map((c) => ({ ...c, score: 1 as const })),
      ...cohort(10).map((c) => ({ ...c, score: 0 as const })),
    ];
    const after = glickoStep(START, mixed);
    expect(Number.isFinite(after.volatility)).toBe(true);
    expect(after.volatility).toBeGreaterThan(0);
    expect(after.volatility).toBeLessThan(10); // sanity ceiling
  });
});

describe("scoresFromPoints", () => {
  it("maps pairwise points to W/D/L outcomes", () => {
    const cohortPts = [
      { rating: 1500, rd: 200, points: 40 },
      { rating: 1500, rd: 200, points: 55 },
      { rating: 1500, rd: 200, points: 55 },
    ];
    const opps = scoresFromPoints(55, cohortPts);
    expect(opps.map((o) => o.score)).toEqual([1, 0.5, 0.5]);
  });
});
