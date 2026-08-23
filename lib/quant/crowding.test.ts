import { describe, expect, it } from "vitest";
import { crowding, type CrowdingPlayer } from "@/lib/quant/crowding";

function p(elementId: number, pos: 1 | 2 | 3 | 4, eo: number): CrowdingPlayer {
  return { elementId, pos, eo };
}

describe("crowding — per-position market structure", () => {
  it("a perfectly split market makes n effective picks at max entropy", () => {
    const r = crowding([p(1, 2, 10), p(2, 2, 10), p(3, 2, 10), p(4, 2, 10)]);
    const def = r.positions[0];
    expect(def.players).toBe(4);
    expect(def.hhi).toBeCloseTo(0.25, 4);
    expect(def.effectivePicks).toBeCloseTo(4, 2);
    expect(def.entropy).toBeCloseTo(Math.log(4), 4);
    expect(def.evenness).toBeCloseTo(1, 4);
  });

  it("a monopoly pick collapses to one effective pick and zero entropy", () => {
    const r = crowding([p(1, 3, 100), p(2, 3, 0), p(3, 3, 0)]);
    const mid = r.positions[0];
    // zero-EO players are excluded from the market entirely
    expect(mid.players).toBe(1);
    expect(mid.effectivePicks).toBeCloseTo(1, 4);
    expect(mid.entropy).toBeCloseTo(0, 4);
    expect(mid.evenness).toBeCloseTo(0, 4);
    expect(mid.top?.elementId).toBe(1);
    expect(mid.top?.share).toBeCloseTo(1, 4);
  });

  it("two-player splits land between the extremes", () => {
    const r = crowding([p(1, 4, 75), p(2, 4, 25)]);
    const fwd = r.positions[0];
    expect(fwd.effectivePicks).toBeCloseTo(1 / (0.75 ** 2 + 0.25 ** 2), 3);
    expect(fwd.entropy).toBeGreaterThan(0);
    expect(fwd.entropy).toBeLessThan(Math.log(2));
    expect(fwd.effectivePicks).toBeGreaterThan(1);
    expect(fwd.effectivePicks).toBeLessThan(2);
  });

  it("keeps positions separate and summarises the whole market overall", () => {
    const r = crowding([
      p(1, 1, 90), p(2, 1, 10),
      p(3, 2, 50), p(4, 2, 50),
    ]);
    expect(r.positions.map((x) => x.pos)).toEqual([1, 2]);
    expect(r.positions[0].effectivePicks).toBeCloseTo(1 / (0.9 ** 2 + 0.1 ** 2), 3);
    expect(r.positions[1].effectivePicks).toBeCloseTo(2, 2);
    expect(r.overall.players).toBe(4);
    expect(r.overall.effectivePicks).toBeCloseTo(1 / (0.45 ** 2 + 0.05 ** 2 + 0.25 ** 2 + 0.25 ** 2), 2);
  });

  it("handles an empty market without exploding", () => {
    const r = crowding([]);
    expect(r.positions).toEqual([]);
    expect(r.overall.players).toBe(0);
    expect(r.overall.effectivePicks).toBe(0);
  });
});
