import { describe, expect, it } from "vitest";

/**
 * The pitch has to add up to the figure printed above it.
 *
 * A captain used to show his raw score, so a sixteen-point armband read as
 * eight and the eleven tokens summed to less than the hero total. This is the
 * same rule the token uses, kept here as an executable statement of the
 * arithmetic rather than a comment about it.
 */
const tokenScore = (row: { livePoints: number; multiplier: number }): number =>
  row.multiplier > 0 ? row.livePoints * row.multiplier : row.livePoints;

describe("tokenScore", () => {
  it("doubles a captain", () => {
    expect(tokenScore({ livePoints: 8, multiplier: 2 })).toBe(16);
  });

  it("triples a triple captain", () => {
    expect(tokenScore({ livePoints: 8, multiplier: 3 })).toBe(24);
  });

  it("leaves an ordinary starter alone", () => {
    expect(tokenScore({ livePoints: 6, multiplier: 1 })).toBe(6);
  });

  it("shows a bench player what he scored, not the nothing it was worth", () => {
    // Zero would be arithmetically true and useless: the bench heading exists
    // to say what you left on it.
    expect(tokenScore({ livePoints: 11, multiplier: 0 })).toBe(11);
  });

  it("sums to the gameweek score across a starting eleven", () => {
    const xi = [
      { livePoints: 2, multiplier: 1 },
      { livePoints: 1, multiplier: 1 },
      { livePoints: 9, multiplier: 1 },
      { livePoints: 11, multiplier: 1 },
      { livePoints: 2, multiplier: 1 },
      { livePoints: 1, multiplier: 1 },
      { livePoints: 8, multiplier: 1 },
      { livePoints: 2, multiplier: 2 }, // the armband
      { livePoints: 2, multiplier: 1 },
      { livePoints: 2, multiplier: 1 },
      { livePoints: 11, multiplier: 1 },
    ];
    const shown = xi.reduce((sum, r) => sum + tokenScore(r), 0);
    const scored = xi.reduce((sum, r) => sum + r.livePoints * r.multiplier, 0);
    expect(shown).toBe(scored);
    expect(shown).toBe(53);
  });

  it("a promoted vice is read from the multiplier, not a captain flag", () => {
    // The armband moves to the vice without isCaptain ever changing, so the
    // multiplier is the only thing that knows.
    expect(tokenScore({ livePoints: 7, multiplier: 2 })).toBe(14);
  });
});
