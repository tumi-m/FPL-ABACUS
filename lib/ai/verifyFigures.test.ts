import { describe, expect, it } from "vitest";
import { allowedFigures, figuresIn, verifyFigures } from "@/lib/ai/verifyFigures";

const facts = {
  gw: 3,
  team: { points: 48, captain: "Isak", rankNow: 1_856_429, threats: ["Haaland (32% EO)"] },
  card: { props: { best: 13, price: 8.5 } },
};

describe("allowedFigures", () => {
  it("finds numbers nested anywhere in the facts", () => {
    const a = allowedFigures(facts);
    expect(a.has("48")).toBe(true);
    expect(a.has("13")).toBe(true);
    expect(a.has("8.5")).toBe(true);
    expect(a.has("1856429")).toBe(true);
  });

  it("finds numbers written inside strings", () => {
    // "Haaland (32% EO)" is a fact, so 32 is quotable.
    expect(allowedFigures(facts).has("32")).toBe(true);
  });

  it("lets a decimal fact license its rounded form", () => {
    // Saying "about 8" of a fact of 8.5 is rounding, not inventing.
    expect(allowedFigures({ x: 8.5 }).has("8")).toBe(true);
  });
});

describe("figuresIn", () => {
  it("reads a thousands separator as one number, not two", () => {
    expect(figuresIn("rank 1,856,429 now")).toEqual(["1856429"]);
  });

  it("treats trailing zeros as the same claim", () => {
    expect(figuresIn("13.00 points")).toEqual(["13"]);
  });
});

describe("verifyFigures", () => {
  it("keeps a sentence whose figures are all in the facts", () => {
    const r = verifyFigures("Isak brought you 48 this week.", facts);
    expect(r.clean).toBe(true);
    expect(r.text).toBe("Isak brought you 48 this week.");
  });

  it("drops the whole sentence when a figure was invented", () => {
    // The bug this prevents: a confident, checkable, wrong number.
    const r = verifyFigures("Isak got 48. Salah added 97 more.", facts);
    expect(r.clean).toBe(false);
    expect(r.invented).toContain("97");
    expect(r.text).toBe("Isak got 48.");
  });

  it("removes the sentence rather than the digits", () => {
    // Deleting just the number leaves "Salah added  more", which still reads
    // as a claim and hides which word went missing.
    const r = verifyFigures("Salah added 97 more.", facts);
    expect(r.text).toBe("");
    expect(r.text).not.toContain("added");
  });

  it("allows the small counting numbers that carry no claim", () => {
    const r = verifyFigures("There are 2 things to watch here.", facts);
    expect(r.clean).toBe(true);
  });

  it("does not wave through a score dressed as a small number", () => {
    // 4 is not on the free list precisely because it can be a scoreline.
    const r = verifyFigures("He returned 4 points.", facts);
    expect(r.clean).toBe(false);
  });

  it("keeps prose with no figures at all untouched", () => {
    const r = verifyFigures("Hold the transfer and let the fixtures turn.", facts);
    expect(r.clean).toBe(true);
    expect(r.text).toBe("Hold the transfer and let the fixtures turn.");
  });

  it("survives an empty reply and empty facts", () => {
    expect(verifyFigures("", {}).text).toBe("");
    expect(verifyFigures("Nothing doing.", null).clean).toBe(true);
  });

  it("quotes a percentage that appears in the facts", () => {
    const r = verifyFigures("Haaland sits at 32% owned.", facts);
    expect(r.clean).toBe(true);
  });
});
