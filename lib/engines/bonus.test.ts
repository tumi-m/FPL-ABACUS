import { describe, expect, it } from "vitest";
import { bonusForFixture } from "@/lib/engines/bonus";

function m(entries: [number, number][]): Map<number, number> {
  return new Map(entries);
}

function values(map: Map<number, number>, keys: number[]): (number | undefined)[] {
  return keys.map((k) => map.get(k));
}

describe("bonusForFixture tie rules", () => {
  it("clean podium: 3,2,1", () => {
    const r = bonusForFixture(m([[1, 50], [2, 40], [3, 30], [4, 10]]));
    expect(values(r, [1, 2, 3])).toEqual([3, 2, 1]);
    expect(r.has(4)).toBe(false);
  });

  it("two tied on top: 3,3, then next gets 1", () => {
    const r = bonusForFixture(m([[1, 50], [2, 50], [3, 30]]));
    expect(values(r, [1, 2])).toEqual([3, 3]);
    expect(r.get(3)).toBe(1);
  });

  it("three tied on top: 3,3,3 and nothing else", () => {
    const r = bonusForFixture(m([[1, 50], [2, 50], [3, 50], [4, 20]]));
    expect(values(r, [1, 2, 3])).toEqual([3, 3, 3]);
    expect(r.has(4)).toBe(false);
  });

  it("top then two tied: 3,2,2 nothing else", () => {
    const r = bonusForFixture(m([[1, 60], [2, 40], [3, 40]]));
    expect(values(r, [1, 2, 3])).toEqual([3, 2, 2]);
  });

  it("four tied on top consumes all slots: everyone gets 3", () => {
    const r = bonusForFixture(m([[1, 30], [2, 30], [3, 30], [4, 30]]));
    expect(values(r, [1, 2, 3, 4])).toEqual([3, 3, 3, 3]);
  });
});
