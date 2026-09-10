import { describe, expect, it } from "vitest";
import { MIN_AXES, buildRadar } from "@/lib/engines/playerRadar";
import type { PercentileRead, StatRow } from "@/lib/engines/playerPercentiles";

const row = (key: string, percentile: number | null, display = "0.30"): StatRow => ({
  key,
  label: key,
  value: 0.3,
  display,
  percentile,
  hint: `hint for ${key}`,
  lowerIsBetter: false,
});

const read = (rows: StatRow[], cohortSize = 40): PercentileRead => ({
  groups: [{ title: "All", rows }],
  cohortSize,
  minMinutes: 270,
});

const OUTFIELD_KEYS = ["xg", "xa", "points", "bps", "defcon", "perMillion"];
const KEEPER_KEYS = ["saves", "cleanSheets", "conceded", "bps", "points", "perMillion"];

describe("buildRadar", () => {
  it("draws the outfield six in a fixed order", () => {
    // Fixed, because two players' shapes are only comparable if the axes are
    // in the same places.
    const r = buildRadar(read(OUTFIELD_KEYS.map((k) => row(k, 60))), 3)!;
    expect(r.axes.map((a) => a.key)).toEqual(OUTFIELD_KEYS);
    expect(r.axes.map((a) => a.label)).toEqual([
      "Threat", "Creation", "Returns", "Bonus", "Defence", "Value",
    ]);
    // The card codes the hexagon points carry — a full word overhangs the
    // viewBox and gets clipped to "ALUE".
    expect(r.axes.map((a) => a.short)).toEqual(["THR", "CRE", "RET", "BPS", "DEF", "VAL"]);
  });

  it("gives a keeper a keeper's axes", () => {
    // A card for a goalkeeper does not show shooting — and an expected-goals
    // axis where every keeper in the cohort scores zero would draw at half
    // height, because a fully tied pool returns the median by construction.
    // Half height reads as "average finisher"; it means "nobody here shoots".
    const rows = [...KEEPER_KEYS, "xg", "xa", "defcon"].map((k) => row(k, 50));
    const r = buildRadar(read(rows), 1)!;
    expect(r.axes.map((a) => a.key)).toEqual(KEEPER_KEYS);
    expect(r.axes.some((a) => a.key === "xg")).toBe(false);
  });

  it("drops an axis the cohort was too small to rank, rather than drawing zero", () => {
    // Zero is "worst in his position". Null is "not enough players to say".
    // Drawing the second as the first is the whole reason this branch exists.
    const rows = OUTFIELD_KEYS.map((k) => row(k, k === "defcon" ? null : 70));
    const r = buildRadar(read(rows), 3)!;
    expect(r.axes.map((a) => a.key)).toEqual(["xg", "xa", "points", "bps", "perMillion"]);
    expect(r.axes.every((a) => a.percentile > 0)).toBe(true);
  });

  it("returns no radar at all when too few axes survive", () => {
    // Under three points there is no area to read, and a two-spoke "shape" is
    // a chart that cannot be wrong because it says nothing.
    const rows = OUTFIELD_KEYS.map((k) => row(k, k === "xg" || k === "xa" ? 70 : null));
    expect(buildRadar(read(rows), 3)).toBeNull();
    expect(MIN_AXES).toBe(3);
  });

  it("carries the figure behind every point", () => {
    // The shape is never the only evidence: each axis keeps the number it was
    // drawn from and the hint that explains it.
    const r = buildRadar(read(OUTFIELD_KEYS.map((k) => row(k, 60, "0.42"))), 4)!;
    expect(r.axes.every((a) => a.display === "0.42")).toBe(true);
    expect(r.axes.every((a) => a.hint.startsWith("hint for"))).toBe(true);
  });

  it("averages the axes it actually drew, not the six it wanted", () => {
    const rows = OUTFIELD_KEYS.map((k) =>
      row(k, k === "perMillion" ? null : k === "xg" ? 100 : 50),
    );
    // Drawn: 100, 50, 50, 50, 50 → 60. Counting the dropped axis as zero
    // would give 50 and quietly punish a player for a thin cohort.
    expect(buildRadar(read(rows), 3)!.overall).toBe(60);
  });

  it("passes the cohort size through, so the shape can say what it is against", () => {
    const r = buildRadar(read(OUTFIELD_KEYS.map((k) => row(k, 60)), 137), 3)!;
    expect(r.cohortSize).toBe(137);
  });
});
