import { describe, expect, it } from "vitest";
import { fingerprintStrokes, kitWeaveBands, sigilGlyphs, sigilSpec, SIGIL_MINUTES } from "@/lib/generative/specs";
import type { GwRecord, SigilSwing } from "@/lib/generative/specs";

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

describe("sigilGlyphs — the Gameweek Sigil (v10 E1)", () => {
  const swings: SigilSwing[] = [
    { minute: 5, delta: 40_000, yours: true },
    { minute: 45, delta: -120_000, yours: false },
    { minute: 90, delta: 60_000, yours: true },
  ];

  it("same input renders byte-identical twice", () => {
    expect(sigilGlyphs(1851681 + 12, swings)).toEqual(sigilGlyphs(1851681 + 12, [...swings]));
  });

  it("angle maps the minute onto the dial, kickoff at 12 o'clock", () => {
    const glyphs = sigilGlyphs(1, [
      { minute: 0, delta: 10, yours: false },
      { minute: 45, delta: -10, yours: false },
      { minute: 90, delta: 10, yours: false },
    ]);
    // Angle is relative to 12 o'clock and sweeps clockwise with the minute.
    // Jitter (±0.02 rad) keeps same-minute events distinct, so tolerance 0.03.
    expect(glyphs[0].angle).toBeCloseTo(-Math.PI / 2, 1);
    expect(glyphs[1].angle).toBeGreaterThan(glyphs[0].angle);
    expect(glyphs[2].angle).toBeCloseTo(-Math.PI / 2 + (90 / SIGIL_MINUTES) * Math.PI * 2, 1);
  });

  it("reach is the swing's share of the biggest move; direction picks the tone", () => {
    const glyphs = sigilGlyphs(2, swings);
    expect(glyphs[1].reach).toBe(1); // the biggest move
    expect(glyphs[0].reach).toBeCloseTo(40_000 / 120_000, 5);
    expect(glyphs[0].tone).toBe("surge");
    expect(glyphs[1].tone).toBe("flare");
    expect(glyphs[2].tone).toBe("surge");
  });

  it("marks the swings that were yours", () => {
    const glyphs = sigilGlyphs(3, swings);
    expect(glyphs.map((g) => g.yours)).toEqual([true, false, true]);
  });

  it("minutes outside the match clamp; empty sequences stay empty", () => {
    const clamped = sigilGlyphs(4, [{ minute: 999, delta: 10, yours: false }]);
    // 999 clamps to 95 → one full sweep back to 12 o'clock, plus jitter.
    expect(((clamped[0].angle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)).toBeLessThan(0.03);
    expect(sigilGlyphs(5, [])).toEqual([]);
  });
});
