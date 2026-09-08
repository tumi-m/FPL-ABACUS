import { describe, expect, it } from "vitest";
import { compareDecision } from "./decision";
import type { PlannerPlayer } from "./planner";

function compare(out: number[], incoming: number[], ft = 0, factor = 1) {
  const players = [{ id: 1, horizon: out }, { id: 2, horizon: incoming }] as PlannerPlayer[];
  return compareDecision({ moves: [{ out: 1, in: 2 }], playerOf: (id) => players.find((p) => p.id === id), freeTransfers: ft, weeks: out.length, incomingFactor: factor });
}

describe("decision comparison", () => {
  it("prices waiting against the same calendar and earns a free transfer", () => {
    const result = compare([5, 2, 2], [4, 6, 6])!;
    expect(result.rows.map((r) => [r.now, r.wait])).toEqual([[-5, 0], [-1, 4], [3, 8]]);
    expect(result.best).toBe("wait");
    expect(result.paybackWeek).toBe(2);
  });
  it("keeps the free transfer on a tie", () => {
    expect(compare([3, 3], [3, 3], 1)!.best).toBe("hold");
  });
  it("does not invent a second gameweek", () => {
    expect(compare([2], [8])!).toMatchObject({ nowNet: 2, waitNet: null, waitHit: null, best: "now" });
  });
  it("keeps blank weeks at zero and applies the scenario only to arrivals", () => {
    expect(compare([4, 4, 0], [0, 10, 5], 1, 0.5)!.nowNet).toBe(-0.5);
  });
  it("finds the break-even assumption including the hit", () => {
    const result = compare([3, 3], [5, 5])!;
    expect(result.breakEvenFactor).toBe(1);
    expect(compare([3, 3], [5, 5], 0, result.breakEvenFactor!)!.nowNet).toBe(0);
  });
  it("does not claim payback before a later reversal", () => {
    expect(compare([0, 10], [5, 0])!.paybackWeek).toBeNull();
  });
  it("does not value missing or invalid data as a blank", () => {
    expect(compare([2, 3], [5])).toBeNull();
    expect(compare([2], [NaN])).toBeNull();
  });
  it("has no break-even ratio when arrivals have no projected points", () => {
    expect(compare([3, 3], [0, 0])!.breakEvenFactor).toBeNull();
  });
  it("charges a basket together and respects the five-transfer cap", () => {
    const players = Array.from({ length: 12 }, (_, id) => ({ id, horizon: [2, 3] })) as PlannerPlayer[];
    const result = compareDecision({ moves: Array.from({ length: 6 }, (_, i) => ({ out: i, in: i + 6 })), playerOf: (id) => players[id], freeTransfers: 5, weeks: 2 })!;
    expect(result).toMatchObject({ nowHit: 4, waitHit: 4, nowNextFt: 1, holdNextFt: 5, best: "hold" });
  });
});
