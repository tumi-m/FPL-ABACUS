import { describe, expect, it } from "vitest";
import { matchesTwin, summariseArm, twinStudy, twinLikelyOverlap, twinShortlist, type TwinEntry, type TwinOutcome } from "@/lib/engines/twinStudy";

const SQUAD15 = Array.from({ length: 15 }, (_, i) => i + 1);

function entry(id: number, over: Partial<TwinEntry> = {}): TwinEntry {
  return {
    entry: id,
    elements: [...SQUAD15],
    counts: [15, 11, 1],
    squadCostTenths: 1000,
    bankTenths: 100,
    ft: 1,
    rankAt: null,
    ...over,
  };
}

function outcome(entry: number, gwPoints: number, captainPoints = 0, arm: TwinOutcome["arm"] = "hold"): TwinOutcome {
  return { entry, gwPoints, captainPoints, arm };
}

describe("matchesTwin — near-twin pairing", () => {
  it("accepts ≥13/15 overlap with matching bank", () => {
    expect(matchesTwin(new Set(SQUAD15), 100, 1, entry(2, {
      elements: [...SQUAD15.slice(0, 14), 99],
    }))).toBe(true);
  });

  it("rejects when overlap drops below 13/15", () => {
    expect(matchesTwin(new Set(SQUAD15), 100, 1, entry(3, {
      elements: [...SQUAD15.slice(0, 12), 98, 99, 100],
    }))).toBe(false);
  });

  it("rejects when bank drifts beyond ±£0.5m", () => {
    expect(matchesTwin(new Set(SQUAD15), 100, 1, entry(4, { bankTenths: 200 }))).toBe(false);
    expect(matchesTwin(new Set(SQUAD15), 100, 1, entry(4, { bankTenths: 40 }))).toBe(false);
    expect(matchesTwin(new Set(SQUAD15), 100, 1, entry(4, { bankTenths: 150 }))).toBe(true);
  });

  it("rejects when free transfers differ by more than one", () => {
    expect(matchesTwin(new Set(SQUAD15), 100, 2, entry(5, { ft: 1 }))).toBe(true);
    expect(matchesTwin(new Set(SQUAD15), 100, 4, entry(5, { ft: 1 }))).toBe(false);
    expect(matchesTwin(new Set(SQUAD15), 100, 1, entry(5, { ft: null }))).toBe(true); // unknown FT never excludes
  });
});

describe("summariseArm — deterministic arm stats", () => {
  it("computes mean/median/sd with an empty-arms guard", () => {
    const a = summariseArm([outcome(1, 70), outcome(2, 74), outcome(3, 66)], new Map([[1, 100], [2, 120], [3, 80]]));
    expect(a).not.toBeNull();
    expect(a!.mean).toBeCloseTo(70, 2);
    expect(a!.median).toBe(70);
    expect(a!.n).toBe(3);
    expect(a!.preRankAvg).toBe(100);
    expect(a!.rankDeltaAvg).toBe(100);
  });

  it("returns null for an empty arm", () => {
    expect(summariseArm([], new Map())).toBeNull();
  });
});

describe("twinStudy — the experiment", () => {
  const makeCohort = (base: number, n: number): TwinEntry[] =>
    Array.from({ length: n }, (_, i) => entry(base + i, { bankTenths: 100 }));

  it("greys out below n=100 and reports observational", () => {
    const transfers = makeCohort(1000, 49);
    const holds = makeCohort(2000, 49);
    const all = [...transfers, ...holds];
    const outcomes = new Map<number, TwinOutcome>();
    transfers.forEach((t) => outcomes.set(t.entry, outcome(t.entry, 70, 0, "transfer")));
    holds.forEach((t) => outcomes.set(t.entry, outcome(t.entry, 60, 0, "hold")));
    const r = twinStudy(SQUAD15, 100, 1, all, outcomes, new Map());
    expect(r.n).toBe(98);
    expect(r.reliable).toBe(false);
    expect(r.note).toBe("observational");
    expect(r.arms.map((a) => a.arm).sort()).toEqual(["hold", "transfer"].sort());
  });

  it("splits by decision arm and sorts by sample size", () => {
    const transfers = makeCohort(1000, 120);
    const holds = makeCohort(2000, 120);
    const all = [...transfers, ...holds];
    const outcomes = new Map<number, TwinOutcome>();
    transfers.forEach((t) => outcomes.set(t.entry, outcome(t.entry, 68, 0, "transfer")));
    holds.forEach((t) => outcomes.set(t.entry, outcome(t.entry, 62, 0, "hold")));
    const rankAt = new Map<number, number | null>(all.map((t, i) => [t.entry, 500 - i] as const));
    const r = twinStudy(SQUAD15, 100, 1, all, outcomes, rankAt);
    expect(r.reliable).toBe(true);
    expect(r.arms).toHaveLength(2);
    expect(r.arms[0].n).toBeGreaterThanOrEqual(r.arms[1].n);
  });

  it("ignores far squad and bank outliers", () => {
    const near = entry(200, { bankTenths: 102 });
    const far = entry(300, {
      elements: Array.from({ length: 15 }, (_, i) => i + 200),
      bankTenths: 900,
    });
    const r = twinStudy(SQUAD15, 100, 1, [near, far], new Map(), new Map());
    expect(r.cohortSize).toBe(1);
  });
});

describe("twin top-up shortlist — the 30k extension's pre-filter", () => {
  it("overlap count pins identical squads at 15", () => {
    expect(twinLikelyOverlap(new Set(SQUAD15), SQUAD15)).toBe(15);
    expect(twinLikelyOverlap(new Set(SQUAD15), [...SQUAD15.slice(0, 10), 91, 92, 93, 94, 95])).toBe(10);
  });

  it("shortlists by overlap, honouring the min and cap", () => {
    const mine = SQUAD15;
    const near = { entry: 1, elements: [...mine.slice(0, 14), 99] }; // overlap 14
    const edge = { entry: 2, elements: [...mine.slice(0, 10), 91, 92, 93, 94, 95] }; // overlap 10
    const far = { entry: 3, elements: [...mine.slice(0, 9), 91, 92, 93, 94, 95, 96] }; // 9 → drop
    // deterministic tie order: entry id asc
    const tieA = { entry: 4, elements: [...mine.slice(0, 12), 91, 92, 93] };
    const tieB = { entry: 5, elements: [...mine.slice(0, 12), 94, 95, 96] };
    const picks = twinShortlist(mine, [far, edge, near, tieB, tieA], 10, 3);
    expect(picks.map((p) => p.entry)).toEqual([1, 4, 5]);
  });

  it("empty seeds shortlist nothing", () => {
    expect(twinShortlist(SQUAD15, [])).toEqual([]);
  });
});
