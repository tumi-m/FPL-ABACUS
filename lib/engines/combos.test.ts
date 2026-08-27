import { describe, expect, it } from "vitest";
import {
  allPairs,
  bandLeaders,
  buildCombo,
  costBand,
  frontier,
  headToHead,
  rankCombos,
  replacementRate,
  type ComboPlayer,
} from "@/lib/engines/combos";

const p = (over: Partial<ComboPlayer> & { id: number }): ComboPlayer => ({
  name: `P${over.id}`,
  pos: 3,
  teamId: over.id,
  cost: 70,
  points: 50,
  minutes: 900,
  starts: 10,
  goals: 5,
  assists: 3,
  xg: 4.2,
  xa: 2.1,
  xgi: 6.3,
  bonus: 6,
  owned: 10,
  ...over,
});

describe("buildCombo", () => {
  it("sums the figures that add and averages the one that does not", () => {
    const c = buildCombo([
      p({ id: 1, cost: 90, points: 60, xgi: 7.5, owned: 40 }),
      p({ id: 2, cost: 55, points: 30, xgi: 3.1, owned: 40 }),
    ]);
    expect(c.cost).toBeCloseTo(14.5);
    expect(c.points).toBe(90);
    expect(c.xgi).toBeCloseTo(10.6);
    // two players owned by 40% each are not owned by 80% of the game
    expect(c.owned).toBe(40);
  });

  it("prices the pair per million, which is the only figure that ranks across budgets", () => {
    const c = buildCombo([p({ id: 1, cost: 50, points: 40 }), p({ id: 2, cost: 50, points: 40 })]);
    expect(c.cost).toBeCloseTo(10);
    expect(c.ppm).toBeCloseTo(8);
  });

  it("counts clubs rather than players — two from one club share every blank", () => {
    const same = buildCombo([p({ id: 1, teamId: 7 }), p({ id: 2, teamId: 7 })]);
    const split = buildCombo([p({ id: 1, teamId: 7 }), p({ id: 2, teamId: 9 })]);
    expect(same.clubs).toBe(1);
    expect(split.clubs).toBe(2);
  });

  it("keys on the members, whatever order they arrive in", () => {
    expect(buildCombo([p({ id: 9 }), p({ id: 4 })]).key).toBe("4-9");
    expect(buildCombo([p({ id: 4 }), p({ id: 9 })]).key).toBe("4-9");
  });

  it("rates a free combination at zero rather than infinity", () => {
    expect(buildCombo([p({ id: 1, cost: 0 }), p({ id: 2, cost: 0 })]).ppm).toBe(0);
  });
});

describe("allPairs", () => {
  it("makes every pair once", () => {
    const pool = [p({ id: 1 }), p({ id: 2 }), p({ id: 3 }), p({ id: 4 })];
    const pairs = allPairs(pool);
    expect(pairs).toHaveLength(6);
    expect(new Set(pairs.map((c) => c.key)).size).toBe(6);
  });

  it("never pairs a player with himself", () => {
    const pairs = allPairs([p({ id: 1 }), p({ id: 2 })]);
    expect(pairs.every((c) => c.players[0].id !== c.players[1].id)).toBe(true);
  });

  it("handles a pool too small to pair", () => {
    expect(allPairs([p({ id: 1 })])).toHaveLength(0);
    expect(allPairs([])).toHaveLength(0);
  });
});

describe("rankCombos", () => {
  const combos = [
    buildCombo([p({ id: 1, cost: 130, points: 100 }), p({ id: 2, cost: 40, points: 10 })]),
    buildCombo([p({ id: 3, cost: 50, points: 60 }), p({ id: 4, cost: 45, points: 40 })]),
  ];

  it("ranks on total points", () => {
    expect(rankCombos(combos, "points", 1)[0].points).toBe(110);
  });

  it("ranks on value, which reverses that", () => {
    // 100 points for £17.0m against 100 points for £9.5m
    expect(rankCombos(combos, "ppm", 1)[0].cost).toBeCloseTo(9.5);
  });

  it("ranks on price when the question is what is affordable", () => {
    expect(rankCombos(combos, "cheap", 1)[0].cost).toBeCloseTo(9.5);
  });

  it("ranks the least-owned first when hunting a differential", () => {
    const owned = [
      buildCombo([p({ id: 1, owned: 50 }), p({ id: 2, owned: 50 })]),
      buildCombo([p({ id: 3, owned: 2 }), p({ id: 4, owned: 4 })]),
    ];
    expect(rankCombos(owned, "differential", 1)[0].owned).toBe(3);
  });

  it("takes only what was asked for", () => {
    expect(rankCombos(combos, "points", 1)).toHaveLength(1);
  });
});

describe("replacementRate", () => {
  it("is the median rate among cheap players who actually play", () => {
    const pool = [
      p({ id: 1, cost: 40, points: 40, minutes: 900 }), // 10.0
      p({ id: 2, cost: 45, points: 27, minutes: 900 }), //  6.0
      p({ id: 3, cost: 50, points: 40, minutes: 900 }), //  8.0
    ];
    expect(replacementRate(pool)).toBeCloseTo(8);
  });

  it("ignores the expensive and the unplayed — neither is what a spare million buys", () => {
    const pool = [
      p({ id: 1, cost: 40, points: 40, minutes: 900 }), // counts
      p({ id: 2, cost: 130, points: 260, minutes: 900 }), // too dear
      p({ id: 3, cost: 40, points: 400, minutes: 20 }), // has not played
    ];
    expect(replacementRate(pool)).toBeCloseTo(10);
  });

  it("returns zero when nobody qualifies, rather than guessing a rate", () => {
    expect(replacementRate([p({ id: 1, cost: 130, minutes: 900 })])).toBe(0);
  });

  it("takes the median of an even sample", () => {
    const pool = [
      p({ id: 1, cost: 50, points: 25, minutes: 900 }), // 5
      p({ id: 2, cost: 50, points: 35, minutes: 900 }), // 7
    ];
    expect(replacementRate(pool)).toBeCloseTo(6);
  });
});

describe("headToHead", () => {
  const rich = buildCombo([p({ id: 1, cost: 145, points: 120 }), p({ id: 2, cost: 45, points: 20 })]);
  const even = buildCombo([p({ id: 3, cost: 95, points: 75 }), p({ id: 4, cost: 80, points: 60 })]);

  it("credits the cheaper side with what its spare money buys", () => {
    // rich is £19.0m for 140; even is £17.5m for 135, with £1.5m left at 8/m
    const h = headToHead(rich, even, 8);
    expect(h.spare).toBeCloseTo(1.5);
    expect(h.spareOn).toBe("b");
    expect(h.spareWorth).toBeCloseTo(12);
    expect(h.adjustedB).toBeCloseTo(147);
    expect(h.margin).toBeCloseTo(-7);
  });

  it("gives the money to whichever side is cheaper", () => {
    const h = headToHead(even, rich, 8);
    expect(h.spareOn).toBe("a");
    expect(h.margin).toBeCloseTo(7);
  });

  it("credits nobody when the two cost the same", () => {
    const a = buildCombo([p({ id: 1, cost: 100, points: 80 })]);
    const b = buildCombo([p({ id: 2, cost: 100, points: 60 })]);
    const h = headToHead(a, b, 8);
    expect(h.spareOn).toBeNull();
    expect(h.spareWorth).toBe(0);
    expect(h.margin).toBeCloseTo(20);
  });

  it("says so when there is no rate to settle a real gap with", () => {
    const h = headToHead(rich, even, 0);
    expect(h.unpriced).toBe(true);
    expect(h.margin).toBeCloseTo(5);
  });

  it("is not unpriced when the sides cost the same, rate or no rate", () => {
    const a = buildCombo([p({ id: 1, cost: 100, points: 80 })]);
    const b = buildCombo([p({ id: 2, cost: 100, points: 60 })]);
    expect(headToHead(a, b, 0).unpriced).toBe(false);
  });
});

describe("costBand", () => {
  it("brackets on the width given", () => {
    expect(costBand(13.4, 2)).toBe("£12.0–14.0m");
    expect(costBand(14.0, 2)).toBe("£14.0–16.0m");
  });
});

describe("bandLeaders", () => {
  it("returns the best of each bracket, cheapest bracket first", () => {
    const combos = [
      buildCombo([p({ id: 1, cost: 60, points: 40 }), p({ id: 2, cost: 60, points: 40 })]), // 12.0, 80
      buildCombo([p({ id: 3, cost: 65, points: 50 }), p({ id: 4, cost: 60, points: 45 })]), // 12.5, 95
      buildCombo([p({ id: 5, cost: 80, points: 70 }), p({ id: 6, cost: 75, points: 60 })]), // 15.5, 130
    ];
    const leaders = bandLeaders(combos, "points", 2);
    expect(leaders).toHaveLength(2);
    expect(leaders[0].points).toBe(95);
    expect(leaders[1].points).toBe(130);
  });
});

describe("frontier", () => {
  it("drops anything that costs more and scores less", () => {
    const cheapGood = buildCombo([p({ id: 1, cost: 50, points: 60 }), p({ id: 2, cost: 40, points: 30 })]); // 9.0, 90
    const dearWorse = buildCombo([p({ id: 3, cost: 90, points: 40 }), p({ id: 4, cost: 60, points: 30 })]); // 15.0, 70
    const dearBetter = buildCombo([p({ id: 5, cost: 90, points: 80 }), p({ id: 6, cost: 60, points: 40 })]); // 15.0, 120
    const kept = frontier([dearWorse, cheapGood, dearBetter]).map((c) => c.points);
    expect(kept).toEqual([90, 120]);
  });

  it("keeps the cheapest of two that score the same", () => {
    const a = buildCombo([p({ id: 1, cost: 50, points: 50 })]);
    const b = buildCombo([p({ id: 2, cost: 90, points: 50 })]);
    expect(frontier([b, a]).map((c) => c.cost)).toEqual([5]);
  });

  it("survives an empty board", () => {
    expect(frontier([])).toEqual([]);
  });
});
