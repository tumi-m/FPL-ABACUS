import { describe, expect, it } from "vitest";
import { isBenched } from "@/lib/engines/matchdayModel";

/**
 * Four lines that decide how many players a pitch draws.
 *
 * The rule this replaced only asked whether a bench seat had come on, so an
 * auto-sub put the replacement onto the pitch and left the man he replaced
 * there as well — twelve in the formation, one of them a blank drawn as if he
 * were playing.
 */
describe("isBenched", () => {
  it("keeps an ordinary starter on the pitch", () => {
    expect(isBenched(7, false, false)).toBe(false);
  });

  it("keeps an ordinary bench seat on the bench", () => {
    expect(isBenched(13, false, false)).toBe(true);
  });

  it("brings a bench seat onto the pitch when he comes on", () => {
    expect(isBenched(13, true, false)).toBe(false);
  });

  it("takes a starter OFF the pitch when he is subbed out — the half that was missing", () => {
    expect(isBenched(7, false, true)).toBe(true);
  });

  it("keeps a swap at eleven: one off, one on", () => {
    const positions = Array.from({ length: 15 }, (_, i) => i + 1);
    const out = 7; // a blanking starter
    const on = 13; // his replacement
    const xi = positions.filter(
      (position) => !isBenched(position, position === on, position === out),
    );
    expect(xi).toHaveLength(11);
    expect(xi).not.toContain(out);
    expect(xi).toContain(on);
  });

  it("draws eleven when nothing happens", () => {
    const xi = Array.from({ length: 15 }, (_, i) => i + 1).filter(
      (position) => !isBenched(position, false, false),
    );
    expect(xi).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("survives a double sub", () => {
    const outs = new Set([4, 9]);
    const ins = new Set([13, 14]);
    const xi = Array.from({ length: 15 }, (_, i) => i + 1).filter(
      (position) => !isBenched(position, ins.has(position), outs.has(position)),
    );
    expect(xi).toHaveLength(11);
  });
});
