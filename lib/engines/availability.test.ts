import { describe, expect, it } from "vitest";
import {
  availabilityLabel,
  bySeverity,
  readAvailability,
  splitNews,
  type Availability,
} from "@/lib/engines/availability";

const read = (status: string, news = "", chanceOfPlaying: number | null = null) =>
  readAvailability({ status, news, chanceOfPlaying });

describe("readAvailability", () => {
  it("says nothing about a fit player", () => {
    const a = read("a");
    expect(a).toMatchObject({ kind: "fit", flagged: false, note: "", prognosis: "" });
  });

  it("maps each FPL status onto a severity", () => {
    expect(read("d", "Knock - 75% chance of playing").kind).toBe("doubt");
    expect(read("i", "Hamstring injury").kind).toBe("out");
    expect(read("s", "Suspended").kind).toBe("suspended");
    expect(read("u", "Transferred to Real Madrid").kind).toBe("gone");
    expect(read("n", "Not in squad").kind).toBe("gone");
  });

  it("splits the ailment from the prognosis", () => {
    const a = read("i", "Ankle injury - Expected back 15 Feb");
    expect(a.note).toBe("Ankle injury");
    expect(a.prognosis).toBe("Expected back 15 Feb");
  });

  it("keeps an unsplittable line whole rather than mangling it", () => {
    const a = read("i", "Undergoing surgery");
    expect(a.note).toBe("Undergoing surgery");
    expect(a.prognosis).toBe("");
  });

  it("carries FPL's own percentage through", () => {
    expect(read("d", "Knock - 50% chance of playing", 50).chance).toBe(50);
  });

  it("follows the status, not the presence of text — news on a fit player is not a flag", () => {
    // FPL leaves stale news on players who are available again.
    const a = read("a", "Joined on loan");
    expect(a.kind).toBe("fit");
    expect(a.flagged).toBe(false);
  });
});

describe("splitNews", () => {
  it("splits on the standalone dash only", () => {
    expect(splitNews("Knee injury - Expected back 20 Jan")).toEqual({
      note: "Knee injury",
      prognosis: "Expected back 20 Jan",
    });
    // A hyphenated word is not a separator.
    expect(splitNews("Hamstring-related knock")).toEqual({
      note: "Hamstring-related knock",
      prognosis: "",
    });
  });

  it("uses the first separator, so a dash in the prognosis survives", () => {
    expect(splitNews("Illness - Expected back mid-February")).toEqual({
      note: "Illness",
      prognosis: "Expected back mid-February",
    });
  });

  it("handles an empty line", () => {
    expect(splitNews("")).toEqual({ note: "", prognosis: "" });
  });
});

describe("availabilityLabel", () => {
  it("is empty for a fit player", () => {
    expect(availabilityLabel(read("a"))).toBe("");
  });

  it("joins what is wrong with when it ends", () => {
    expect(availabilityLabel(read("i", "Ankle injury - Expected back 15 Feb"))).toBe(
      "Ankle injury · Expected back 15 Feb",
    );
  });

  it("adds the percentage only when the prognosis does not already carry one", () => {
    expect(availabilityLabel(read("d", "Knock - 75% chance of playing", 75))).toBe(
      "Knock · 75% chance of playing",
    );
    expect(availabilityLabel(read("d", "Knock", 75))).toBe("Knock · 75% chance");
  });

  it("falls back to the severity when FPL says nothing", () => {
    expect(availabilityLabel(read("i"))).toBe("Unavailable");
    expect(availabilityLabel(read("s"))).toBe("Suspended");
  });
});

describe("bySeverity", () => {
  const row = (webName: string, a: Availability) => ({ webName, availability: a });

  it("puts the ones you must act on first", () => {
    const rows = [
      row("Doubtful", read("d", "Knock", 75)),
      row("Injured", read("i", "Hamstring")),
      row("Banned", read("s", "Suspended")),
    ];
    expect([...rows].sort(bySeverity).map((r) => r.webName)).toEqual([
      "Injured",
      "Banned",
      "Doubtful",
    ]);
  });

  it("breaks a tie on the lower chance of playing", () => {
    const rows = [
      row("Likely", read("d", "Knock", 75)),
      row("Unlikely", read("d", "Knock", 25)),
    ];
    expect([...rows].sort(bySeverity).map((r) => r.webName)).toEqual(["Unlikely", "Likely"]);
  });

  it("is stable on name when severity and chance match", () => {
    const rows = [
      row("Zeta", read("d", "Knock", 50)),
      row("Alpha", read("d", "Knock", 50)),
    ];
    expect([...rows].sort(bySeverity).map((r) => r.webName)).toEqual(["Alpha", "Zeta"]);
  });
});
