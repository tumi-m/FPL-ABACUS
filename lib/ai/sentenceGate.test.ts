import { describe, expect, it } from "vitest";
import { createSentenceGate } from "@/lib/ai/sentenceGate";

const facts = { team: { points: 48 }, card: { props: { best: 13 } } };

describe("createSentenceGate", () => {
  it("holds text back until a sentence is complete", () => {
    const g = createSentenceGate(facts);
    expect(g.push("Isak brought you 48").emit).toBe("");
    expect(g.push(" this week. ").emit).toBe("Isak brought you 48 this week. ");
  });

  it("never emits a sentence carrying an invented figure", () => {
    // The whole point: this must not reach the screen and then be corrected.
    const g = createSentenceGate(facts);
    const out = g.push("Salah added 97 more. ");
    expect(out.emit).toBe("");
    expect(out.invented).toContain("97");
  });

  it("keeps the good sentences either side of a dropped one", () => {
    const g = createSentenceGate(facts);
    const out = g.push("Isak got 48. Salah added 97. Hold the transfer. ");
    expect(out.emit).toContain("Isak got 48.");
    expect(out.emit).toContain("Hold the transfer.");
    expect(out.emit).not.toContain("97");
  });

  it("reassembles a sentence split across chunks", () => {
    // A token boundary is not a sentence boundary; 4 and 8 must not be read
    // as two figures because the stream split "48".
    const g = createSentenceGate(facts);
    expect(g.push("You are on 4").emit).toBe("");
    expect(g.push("8 points. ").emit).toBe("You are on 48 points. ");
  });

  it("releases the tail on flush even without a full stop", () => {
    const g = createSentenceGate(facts);
    g.push("Hold the transfer");
    expect(g.flush().emit).toBe("Hold the transfer ");
  });

  it("drops an unverifiable tail on flush too", () => {
    const g = createSentenceGate(facts);
    g.push("Salah is on 97");
    expect(g.flush().emit).toBe("");
    expect(g.droppedCount).toBe(1);
  });

  it("is empty-safe", () => {
    const g = createSentenceGate(facts);
    expect(g.push("").emit).toBe("");
    expect(g.flush().emit).toBe("");
  });

  it("counts every figure it caught across the reply", () => {
    const g = createSentenceGate(facts);
    g.push("A is 97. B is 55. C is 48. ");
    expect(g.droppedCount).toBe(2);
  });
});
