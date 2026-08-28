import { describe, expect, it } from "vitest";
import { describeReason, itemiseGap, topSwings, type GapInput } from "@/lib/engines/compareGap";

const p = (element: number, livePoints: number, multiplier = 1): GapInput => ({
  element,
  webName: `P${element}`,
  teamId: 1,
  livePoints,
  multiplier,
});

describe("itemiseGap", () => {
  it("reconciles: the parts add up to the scoreline", () => {
    // The whole point of the feature. If this ever fails the breakdown is
    // lying, and a breakdown that does not reconcile is worse than none.
    const mine = [p(1, 6), p(2, 2, 2), p(3, 9), p(4, 0, 0)];
    const theirs = [p(1, 6), p(5, 12, 2), p(3, 9), p(6, 1)];
    const { rows, total } = itemiseGap(mine, theirs);
    expect(rows.reduce((sum, r) => sum + r.delta, 0)).toBe(total);
  });

  it("reconciles when the two squads share nothing at all", () => {
    const { rows, total } = itemiseGap([p(1, 10, 2)], [p(2, 4)]);
    expect(rows.reduce((s, r) => s + r.delta, 0)).toBe(total);
    expect(total).toBe(16);
  });

  it("drops the players who cost neither of you anything", () => {
    // Shared, both started, same points: a genuine nil, and listing it is the
    // noise this exists to remove.
    const { rows } = itemiseGap([p(1, 6), p(2, 3)], [p(1, 6), p(3, 3)]);
    expect(rows.map((r) => r.element)).toEqual([2, 3]);
  });

  it("catches a captaincy split on a player you BOTH own", () => {
    // Ownership says "shared". Contribution says it is the whole gap. This is
    // the case a differential-only view misses entirely.
    const { rows, total } = itemiseGap([p(1, 12, 2)], [p(1, 12, 1)]);
    expect(total).toBe(12);
    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe("captaincy");
    expect(rows[0].delta).toBe(12);
  });

  it("separates a bench call from a captain call", () => {
    const benched = itemiseGap([p(1, 7, 0)], [p(1, 7, 1)]);
    expect(benched.rows[0].reason).toBe("benching");
    const capped = itemiseGap([p(1, 7, 2)], [p(1, 7, 1)]);
    expect(capped.rows[0].reason).toBe("captaincy");
  });

  it("names ownership when only one side has him", () => {
    expect(itemiseGap([p(1, 5)], []).rows[0].reason).toBe("only-you");
    expect(itemiseGap([], [p(1, 5)]).rows[0].reason).toBe("only-them");
  });

  it("orders by how much it moved the gap, either direction", () => {
    const { rows } = itemiseGap([p(1, 2), p(2, 1)], [p(3, 9)]);
    expect(rows[0].element).toBe(3);
    expect(rows[0].delta).toBe(-9);
  });

  it("is stable when two swings are the same size", () => {
    const a = itemiseGap([p(2, 4), p(1, 4)], []).rows.map((r) => r.element);
    const b = itemiseGap([p(1, 4), p(2, 4)], []).rows.map((r) => r.element);
    expect(a).toEqual(b);
  });

  it("counts a benched player as nothing rather than as his points", () => {
    const { total } = itemiseGap([p(1, 15, 0)], []);
    expect(total).toBe(0);
  });

  it("handles a triple captain", () => {
    expect(itemiseGap([p(1, 10, 3)], [p(1, 10, 1)]).total).toBe(20);
  });

  it("survives two empty squads", () => {
    expect(itemiseGap([], [])).toEqual({ rows: [], total: 0 });
  });

  it("names the player from whichever side has him", () => {
    expect(itemiseGap([], [p(9, 3)]).rows[0].webName).toBe("P9");
  });
});

describe("topSwings", () => {
  it("takes the headline, not the ledger", () => {
    const { rows } = itemiseGap([p(1, 9), p(2, 5), p(3, 3), p(4, 1)], []);
    expect(topSwings(rows, 3).map((r) => r.delta)).toEqual([9, 5, 3]);
  });
});

describe("describeReason", () => {
  it("says whose captain it was, not just 'captaincy'", () => {
    expect(describeReason(itemiseGap([p(1, 9, 2)], [p(1, 9, 1)]).rows[0])).toBe("your captain");
    expect(describeReason(itemiseGap([p(1, 9, 1)], [p(1, 9, 2)]).rows[0])).toBe("their captain");
  });

  it("says who did the benching", () => {
    expect(describeReason(itemiseGap([p(1, 9, 0)], [p(1, 9, 1)]).rows[0])).toBe("you benched him");
    expect(describeReason(itemiseGap([p(1, 9, 1)], [p(1, 9, 0)]).rows[0])).toBe("they benched him");
  });
});
