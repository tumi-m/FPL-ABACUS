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

describe("claims are bound to an entity and a measure", () => {
  // The four the audit reproduced against the number-only verifier. Each was
  // accepted; each must now be dropped, and each is a different way for a
  // sentence to be false while every digit in it is real.
  const saka = { player: "Saka", goals: 13 };

  it("refuses a real number attributed to the wrong player", () => {
    expect(verifyFigures("Haaland scored 13 goals.", saka).clean).toBe(false);
  });

  it("refuses a real number attached to the wrong measure", () => {
    // 13 is his goal count, not his price.
    expect(verifyFigures("Saka costs £13m.", saka).clean).toBe(false);
  });

  it("refuses a small count no fact supports, even though 2 reads as grammar", () => {
    // "two of your three defenders" is grammar and stays free; "scored 2
    // goals" is a statistic and needs evidence like any other.
    expect(verifyFigures("Saka scored 2 goals.", saka).clean).toBe(false);
    expect(verifyFigures("Two of the three are yours.", saka).clean).toBe(true);
  });

  it("refuses a flat fitness claim with nothing behind it", () => {
    expect(verifyFigures("Saka is definitely fit.", saka).clean).toBe(false);
    expect(verifyFigures("Saka will start.", saka).clean).toBe(false);
  });

  it("keeps the same claim when the facts do support it", () => {
    expect(verifyFigures("Saka scored 13 goals.", saka).clean).toBe(true);
    const withPrice = { player: "Saka", goals: 13, price: 8.5 };
    expect(verifyFigures("Saka costs £8.5m.", withPrice).clean).toBe(true);
  });

  it("accepts a fitness claim FPL's own words back, wherever they are stored", () => {
    // The briefing keeps this under `label`, not `status` — the evidence is
    // the wording, not the field it arrived in.
    const flagged = { name: "Haaland", label: "Knock · Expected back 8 Mar" };
    expect(verifyFigures("Your captain Haaland is out: Knock · Expected back 8 Mar.", flagged).clean).toBe(true);
  });

  it("does not read an ordinary opener as a player", () => {
    // "Hold" and "Since" begin sentences; they are not somebody who scored.
    expect(verifyFigures("Hold the transfer and take the 13 goals.", saka).clean).toBe(true);
  });

  it("does not split a decimal into a second claim", () => {
    // "42.5% owned" was cut at the period, leaving an orphan "5" that no fact
    // could license, and a true sentence was dropped for a number it never made.
    const owned = { rows: [{ name: "Saka", eo: 42.5 }] };
    expect(verifyFigures("Saka is 42.5% owned.", owned).clean).toBe(true);
  });

  it("reads a measure and a subject out of a fact written as a sentence", () => {
    const threats = { team: { name: "GP", threats: ["Haaland (32% EO)"] } };
    expect(verifyFigures("Haaland sits at 32% owned.", threats).clean).toBe(true);
    expect(verifyFigures("Haaland sits at 44% owned.", threats).clean).toBe(false);
  });
});
