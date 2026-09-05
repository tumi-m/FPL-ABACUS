import { describe, expect, it } from "vitest";
import { layoutAnswer, type LayoutCard } from "./layout";

function card(component: string): LayoutCard {
  return { component, prose: `Resolved ${component}.` };
}

describe("layoutAnswer — the assembling interface (v10 E4)", () => {
  it("one card renders as itself, no dashboard chrome", () => {
    const l = layoutAnswer([card("captain-compare")]);
    expect(l.template).toBe("single");
    expect(l.hero?.component).toBe("captain-compare");
    expect(l.support).toEqual([]);
  });

  it("no cards is an honest empty, not a crash", () => {
    const l = layoutAnswer([]);
    expect(l.template).toBe("single");
    expect(l.hero).toBeNull();
  });

  it("the hero is the highest-ranked component that answered, not the first resolved", () => {
    const l = layoutAnswer([card("price-gauge"), card("rank-projection"), card("injury-list")]);
    expect(l.hero?.component).toBe("rank-projection");
    expect(l.support.map((c) => c.component)).toEqual(["price-gauge", "injury-list"]);
  });

  it("two cards take the hero-side template", () => {
    const l = layoutAnswer([card("price-gauge"), card("injury-list")]);
    expect(l.template).toBe("hero-side");
    // Nothing hero-ranked answered: the first resolved leads.
    expect(l.hero?.component).toBe("price-gauge");
  });

  it("a wide support chart promotes the band template", () => {
    const l = layoutAnswer([
      card("captain-compare"),
      card("injury-list"),
      card("exposure-scatter"),
    ]);
    expect(l.template).toBe("hero-band");
    expect(l.hero?.component).toBe("captain-compare");
  });

  it("narrow supports stack", () => {
    const l = layoutAnswer([
      card("captain-compare"),
      card("injury-list"),
      card("price-gauge"),
    ]);
    expect(l.template).toBe("stack");
  });

  it("the layout is a pure function of the card set — same input, same template", () => {
    const cards = [card("swing-impact"), card("chip-timeline"), card("wpa")];
    expect(layoutAnswer(cards)).toEqual(layoutAnswer([...cards]));
  });
});