import { describe, expect, it } from "vitest";
import { UNAVAILABLE_LINE, UNAVAILABLE_STATS, provenanceOf } from "./provenance";

describe("D8 provenance data", () => {
  it("every unavailable stat names a real Opta-only metric and one honest reason", () => {
    const labels = new Set(UNAVAILABLE_STATS.map((s) => s.label));
    // Duplicates would read as two different rows for one absence.
    expect(labels.size).toBe(UNAVAILABLE_STATS.length);
    for (const s of UNAVAILABLE_STATS) {
      expect(s.label.length).toBeGreaterThan(2);
      // A reason that does not say why would be worse than none.
      expect(s.why).toMatch(/FPL|Opta|feed|publish/i);
      expect(s.why.length).toBeGreaterThan(40);
    }
  });

  it("the unavailable line is stable — every surface prints the same sentence", () => {
    expect(UNAVAILABLE_LINE).toBe("Not published by FPL");
  });

  it("provenanceOf names all three states without overlap", () => {
    const sentences = ["published", "estimated", "unavailable"].map(provenanceOf);
    expect(new Set(sentences).size).toBe(3);
    // The unavailable state IS the line, so a component can render both from
    // the one constant and they can never drift.
    expect(provenanceOf("unavailable")).toBe(UNAVAILABLE_LINE);
  });
});