import { describe, expect, it } from "vitest";
import { fingerprintStrokes, kitWeaveBands, sigilSpec } from "@/lib/generative/specs";
import type { GwRecord } from "@/lib/generative/specs";

const records: GwRecord[] = [
  { event: 1, points: 52, overallRank: 900_000, chip: null },
  { event: 2, points: 71, overallRank: 410_000, chip: null },
  { event: 3, points: 44, overallRank: 620_000, chip: "wildcard" },
];

describe("fingerprintStrokes", () => {
  it("is deterministic for a given seed", () => {
    expect(fingerprintStrokes(1851681, records)).toEqual(fingerprintStrokes(1851681, [...records]));
    expect(fingerprintStrokes(7, records)).toEqual(fingerprintStrokes(7, [...records]));
  });

  it("differs across seeds", () => {
    const a = fingerprintStrokes(1, records);
    const b = fingerprintStrokes(2, records);
    expect(a).not.toEqual(b);
  });

  it("marks rank gains surge and losses flare; chips force surge", () => {
    const strokes = fingerprintStrokes(11, records);
    expect(strokes[1].tone).toBe("surge"); // rank improved
    expect(strokes[0].tone).toBe("line"); // no previous week
    expect(strokes[2].tone).toBe("surge"); // rank dropped but a chip was played
    const plainDrop: GwRecord[] = [
      { event: 1, points: 60, overallRank: 100_000, chip: null },
      { event: 2, points: 40, overallRank: 900_000, chip: null },
    ];
    expect(fingerprintStrokes(13, plainDrop)[1].tone).toBe("flare");
  });

  it("produces one stroke per record with finite geometry", () => {
    const strokes = fingerprintStrokes(3, records);
    expect(strokes).toHaveLength(records.length);
    for (const s of strokes) {
      expect(Number.isFinite(s.angle)).toBe(true);
      expect(s.magnitude).toBeGreaterThanOrEqual(0);
      expect(s.magnitude).toBeLessThanOrEqual(1.06); // jitter allowance
      expect(s.length).toBeGreaterThan(0);
    }
  });
});

describe("sigilSpec", () => {
  it("is deterministic and within design bounds", () => {
    const a = sigilSpec(42);
    const b = sigilSpec(42);
    expect(a).toEqual(b);
    expect(a.petals).toBeGreaterThanOrEqual(6);
    expect(a.petals).toBeLessThan(13);
    expect(a.petalLength.every((l) => l >= 0.55 && l <= 1)).toBe(true);
    expect(a.ringDashes).toHaveLength(3);
  });
});

describe("kitWeaveBands", () => {
  it("maps team ids to club tokens deterministically", () => {
    const bands = kitWeaveBands([14, 1]);
    expect(bands.map((b) => b.colorVar)).toEqual(["var(--club-liv)", "var(--club-ars)"]);
    expect(kitWeaveBands([14, 1])).toEqual(bands);
  });

  it("falls back to line tones when empty", () => {
    expect(kitWeaveBands([])[0].colorVar).toBe("var(--line)");
  });
});
