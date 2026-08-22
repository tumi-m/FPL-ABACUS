import { describe, expect, it } from "vitest";
import { aggregateCohort, logSpacedPages, reservoirSample, toEnginePick } from "@/lib/engines/cohortSampling";
import { mulberry32 } from "@/lib/engines/simulate";
import type { Pick } from "@/lib/engines/types";

describe("logSpacedPages", () => {
  it("is head-dense and sorted, capped at maxPage", () => {
    const pages = logSpacedPages(6, 1000);
    expect(pages[0]).toBe(1);
    expect(pages).toEqual([...new Set(pages)].sort((a, b) => a - b));
    expect(pages.every((p) => p >= 1 && p <= 1000)).toBe(true);
    // geometric growth: later gaps much larger than early ones
    const early = pages[1] - pages[0];
    const late = pages[pages.length - 1] - pages[pages.length - 2];
    expect(late).toBeGreaterThan(early * 10);
  });
});

describe("reservoirSample", () => {
  it("keeps exactly k items (or all when fewer)", () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    expect(reservoirSample(items, 10, mulberry32(1))).toHaveLength(10);
    expect(reservoirSample(items, 500, mulberry32(1))).toHaveLength(100);
  });

  it("every item has equal probability — chi-square-ish sanity", () => {
    const items = Array.from({ length: 200 }, (_, i) => i);
    const counts = new Map<number, number>();
    for (let trial = 0; trial < 400; trial++) {
      for (const picked of reservoirSample(items, 20, mulberry32(trial + 1))) {
        counts.set(picked, (counts.get(picked) ?? 0) + 1);
      }
    }
    // expected picks per item ≈ 400 × 20/200 = 40
    for (const item of items) {
      const c = counts.get(item) ?? 0;
      expect(c).toBeGreaterThan(15);
      expect(c).toBeLessThan(75);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(reservoirSample(items, 7, mulberry32(42))).toEqual(reservoirSample(items, 7, mulberry32(42)));
  });
});

function squad(entries: [number, number][]): Pick[] {
  return entries.map(([element, multiplier], idx) =>
    toEnginePick({ element, position: Math.min(idx + 1, 15), multiplier }),
  );
}

describe("aggregateCohort", () => {
  it("computes owned/started/captain percentages and EO over the cohort", () => {
    // 3 managers: A captained once (mult 2), B started twice, C benched once.
    const squads = [
      squad([[101, 2], [102, 1]]), // A captain
      squad([[101, 1], [102, 1], [103, 1]]),
      squad([[101, 0], [102, 1]]), // A on the bench
    ];
    const rows = aggregateCohort(squads, 3);

    expect(rows.get(101)).toEqual({ element: 101, ownedPct: 100, startedPct: 66.7, captainPct: 33.3, eo: 100 });
    expect(rows.get(102)?.ownedPct).toBe(100);
    expect(rows.get(102)?.startedPct).toBe(100);
    expect(rows.get(102)?.eo).toBeCloseTo(100, 1);
    expect(rows.get(103)).toEqual({ element: 103, ownedPct: 33.3, startedPct: 33.3, captainPct: 0, eo: 33.3 });
  });

  it("treats triple-captain as started + captain", () => {
    const squads = [squad([[9, 3]]), squad([[9, 1]])];
    const rows = aggregateCohort(squads, 2);
    expect(rows.get(9)?.captainPct).toBe(50);
    expect(rows.get(9)?.startedPct).toBe(100);
    expect(rows.get(9)?.eo).toBeCloseTo(200, 0); // mean multiplier × 100
  });

  it("returns an empty map for empty input", () => {
    expect(aggregateCohort([], 0).size).toBe(0);
  });
});

describe("toEnginePick", () => {
  it("clamps multipliers into the engine domain", () => {
    expect(toEnginePick({ element: 1, position: 12, multiplier: 4 }).multiplier).toBe(3);
    expect(toEnginePick({ element: 1, position: 12, multiplier: -1 }).multiplier).toBe(0);
    expect(toEnginePick({ element: 5, position: 8, multiplier: 0 }).isCaptain).toBe(false);
  });
});
