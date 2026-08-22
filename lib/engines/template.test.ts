import { describe, expect, it } from "vitest";
import { overlapPct, templateDrift, templateXI } from "@/lib/engines/template";
import type { TemplatePlayer } from "@/lib/engines/template";

function pool(): TemplatePlayer[] {
  return [
    { element: 1, pos: 1, eo10k: 90 },
    { element: 2, pos: 2, eo10k: 85 },
    { element: 3, pos: 2, eo10k: 80 },
    { element: 4, pos: 2, eo10k: 75 },
    { element: 5, pos: 2, eo10k: 70 },
    { element: 6, pos: 2, eo10k: 65 },
    { element: 7, pos: 3, eo10k: 88 },
    { element: 8, pos: 3, eo10k: 82 },
    { element: 9, pos: 3, eo10k: 76 },
    { element: 10, pos: 3, eo10k: 60 },
    { element: 11, pos: 4, eo10k: 84 },
    { element: 12, pos: 4, eo10k: 72 },
    { element: 13, pos: 4, eo10k: 50 },
    { element: 14, pos: 1, eo10k: 55 },
    { element: 15, pos: 3, eo10k: 45 },
  ];
}

describe("templateXI", () => {
  it("produces a legal formation", () => {
    const xi = templateXI(pool());
    expect(xi.size).toBe(11);
  });

  it("prefers the highest EO players", () => {
    const xi = templateXI(pool());
    expect(xi.has(1)).toBe(true);
    expect(xi.has(7)).toBe(true);
    expect(xi.has(13)).toBe(false);
  });

  it("overlap is a percentage of shared players", () => {
    const xi = templateXI(pool());
    const mine = new Set([...xi].slice(0, 6));
    expect(overlapPct(mine, xi)).toBeCloseTo((6 / 11) * 100, 0);
  });
});

describe("templateDrift", () => {
  it("splits bets for and against by DVS sign", () => {
    const cohort = pool().map((p) => ({ ...p, xP: 6 }));
    const yourXI = templateXI(cohort);
    // remove one template player from my XI to create an against-bet
    yourXI.delete(12);
    const drift = templateDrift(yourXI, cohort, [40, 41]);
    expect(drift.direction).toBe("stable");
    expect(drift.overlap).toBeGreaterThan(0);
  });
});
