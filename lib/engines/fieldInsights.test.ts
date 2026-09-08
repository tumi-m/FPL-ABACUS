import { describe, expect, it } from "vitest";
import { fieldInsightPoints } from "./fieldInsights";
import type { PerfPlayer } from "./performance";

const player = { id: 1, pos: 3, minutes: 180, cost: 75, xg: 1.2, xa: 0.8, bps: 50, bonus: 3, cbi: 12, recoveries: 20, xgc: 4, saves: 8, owned: 12.5, points: 16 } as PerfPlayer;

describe("Field insight coordinates", () => {
  it("converts tenths of a million and combines xG and xA before normalising", () => {
    expect(fieldInsightPoints([player], "value")[0]).toMatchObject({ x: 7.5, y: 1, smallSample: true });
  });
  it("distinguishes BPS from the actual awarded bonus", () => {
    expect(fieldInsightPoints([player], "bonus")[0]).toMatchObject({ x: 25, y: 1.5 });
  });
  it("keeps defensive components separate and excludes goalkeepers", () => {
    expect(fieldInsightPoints([player, { ...player, pos: 1 }], "workload")).toHaveLength(1);
    expect(fieldInsightPoints([player], "workload")[0]).toMatchObject({ x: 6, y: 10 });
  });
  it("compares only goalkeepers using minutes-normalised xGC and saves", () => {
    const points = fieldInsightPoints([player, { ...player, pos: 1 }], "keepers");
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ x: 2, y: 4 });
  });
  it("preserves ownership percentage without multiplying by captaincy", () => {
    expect(fieldInsightPoints([player], "ownership")[0]).toMatchObject({ x: 12.5, y: 8 });
  });
  it("excludes zero minutes and incomplete statistics instead of inventing a zero", () => {
    expect(fieldInsightPoints([{ ...player, minutes: 0 }, { ...player, xg: NaN }], "value")).toEqual([]);
    expect(fieldInsightPoints([{ ...player, minutes: Infinity }], "bonus")).toEqual([]);
  });
  it("keeps real zeroes and negative awarded points", () => {
    expect(fieldInsightPoints([{ ...player, points: -2, owned: 0 }], "ownership")[0]).toMatchObject({ x: 0, y: -1 });
  });
  it("applies minutes and position filters to the same comparison population", () => {
    const pool = [player, { ...player, id: 2, pos: 2, minutes: 900 }];
    expect(fieldInsightPoints(pool, "bonus", 450, 2).map((p) => p.player.id)).toEqual([2]);
    expect(fieldInsightPoints(pool, "bonus", 450, 3)).toEqual([]);
  });
  it("rejects impossible prices and ownership", () => {
    expect(fieldInsightPoints([{ ...player, cost: 0 }], "value")).toEqual([]);
    expect(fieldInsightPoints([{ ...player, owned: 101 }], "ownership")).toEqual([]);
  });
});
