import { describe, expect, it } from "vitest";
import { composeBriefing, TONIGHT_CUT, type BriefingInput } from "./briefing";
import { verifyFigures } from "@/lib/ai/verifyFigures";

function input(overrides: Partial<BriefingInput> = {}): BriefingInput {
  return {
    starters: [],
    watchlist: [],
    chips: [],
    currentGw: 8,
    nextDeadline: null,
    rival: null,
    ...overrides,
  };
}

const starter = (over: Partial<BriefingInput["starters"][number]> = {}) => ({
  id: 1,
  name: "Saliba",
  isCaptain: false,
  status: "a",
  news: "",
  chanceOfPlaying: null,
  ...over,
});

describe("composeBriefing", () => {
  it("says nothing at all when there are no triggers — no padding line", () => {
    const out = composeBriefing(input());
    expect(out.lines).toEqual([]);
  });

  it("raises one flagged starter in FPL's own words", () => {
    const out = composeBriefing(
      input({
        starters: [
          starter({ name: "Timber", status: "d", news: "Ankle injury - 75% chance of playing", chanceOfPlaying: 75 }),
        ],
      }),
    );
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0].id).toBe("flagged");
    expect(out.lines[0].state).toBe("warn");
    expect(out.lines[0].text).toContain("Timber");
    expect(out.lines[0].text).toContain("75% chance");
  });

  it("counts two flagged starters as critical and names both", () => {
    const out = composeBriefing(
      input({
        starters: [
          starter({ name: "Timber", status: "d", news: "Knock - 75% chance", chanceOfPlaying: 75 }),
          starter({ name: "Saliba", status: "i", news: "Ankle injury - Expected back 15 Feb" }),
        ],
      }),
    );
    const line = out.lines.find((l) => l.id === "flagged")!;
    expect(line.state).toBe("critical");
    expect(line.text).toContain("2 starters are flagged");
    expect(line.text).toContain("Timber");
    expect(line.text).toContain("Saliba");
  });

  it("rules the captain out as its own critical line", () => {
    const out = composeBriefing(
      input({
        starters: [starter({ name: "Haaland", isCaptain: true, status: "s", news: "Suspended - Expected back 20 Jan" })],
      }),
    );
    const cap = out.lines.find((l) => l.id === "captain")!;
    expect(cap).toBeTruthy();
    expect(cap.state).toBe("critical");
    expect(cap.text).toContain("Haaland");
    expect(cap.text).toContain("Suspended");
  });

  it("bench seats never trigger — only the XI is read", () => {
    // The engine receives starters only, so this pins the contract: a flagged
    // player who arrives here IS a starter. The builder filters the bench.
    const out = composeBriefing(
      input({ starters: [starter({ name: "Bench Lad", status: "i", news: "Out" })] }),
    );
    expect(out.lines.some((l) => l.id === "flagged")).toBe(true);
  });

  it("names watchlist players closing on a rise, with the percentage as est", () => {
    const out = composeBriefing(
      input({
        watchlist: [
          { id: 1, name: "Mbeumo", direction: "up", pMove: 0.95, covered: true, label: "Rise" },
          { id: 2, name: "Quiet", direction: "up", pMove: 0.3, covered: true, label: "Rise" },
        ],
      }),
    );
    const line = out.lines.find((l) => l.id === "watchlist")!;
    expect(line).toBeTruthy();
    expect(line.text).toContain("Mbeumo");
    expect(line.text).not.toContain("Quiet");
    expect(line.est?.value).toBe("95%");
  });

  it("never quotes a move for an uncovered row — no snapshot history means silence", () => {
    const out = composeBriefing(
      input({
        watchlist: [{ id: 1, name: "New Signee", direction: "up", pMove: 0.99, covered: false, label: "Rise" }],
      }),
    );
    expect(out.lines.some((l) => l.id === "watchlist")).toBe(false);
  });

  it("flags a chip window closing within the war-room horizon", () => {
    const deadline = new Date(Date.now() + 24 * 3_600_000).toISOString();
    const out = composeBriefing(
      input({
        chips: [{ key: "wc", label: "Wildcard", startEvent: 8, stopEvent: 9 }],
        nextDeadline: deadline,
      }),
    );
    const line = out.lines.find((l) => l.id === "chip")!;
    expect(line).toBeTruthy();
    expect(line.state).toBe("note");
    expect(line.text).toContain("Wildcard");
    expect(line.est?.value.endsWith("h")).toBe(true);
  });

  it("says nothing about a chip window with days left — not worth a line yet", () => {
    const deadline = new Date(Date.now() + 72 * 3_600_000).toISOString();
    const out = composeBriefing(
      input({
        chips: [{ key: "wc", label: "Wildcard", startEvent: 8, stopEvent: 9 }],
        nextDeadline: deadline,
      }),
    );
    expect(out.lines.some((l) => l.id === "chip")).toBe(false);
  });

  it("raises a rival differential hauling against your blank", () => {
    const out = composeBriefing(
      input({ rival: { name: "Cunha", eo: 6, points: 12 } }),
    );
    const line = out.lines.find((l) => l.id === "rival")!;
    expect(line).toBeTruthy();
    expect(line.text).toContain("Cunha");
    expect(line.est?.value).toBe("12 pts");
  });

  it("stays quiet about a template hauler — high EO is not a threat", () => {
    const out = composeBriefing(input({ rival: { name: "Salah", eo: 55, points: 14 } }));
    expect(out.lines.some((l) => l.id === "rival")).toBe(false);
  });

  it("stays quiet about a low-EO player who did not haul", () => {
    const out = composeBriefing(input({ rival: { name: "Cunha", eo: 6, points: 2 } }));
    expect(out.lines.some((l) => l.id === "rival")).toBe(false);
  });

  it("every line's figures verify against its own facts — zero invented", () => {
    const deadline = new Date(Date.now() + 10 * 3_600_000).toISOString();
    const out = composeBriefing(
      input({
        starters: [
          starter({ name: "Timber", status: "d", news: "Knock - 75% chance", chanceOfPlaying: 75 }),
          starter({ name: "Saliba", status: "i", news: "Ankle injury - Expected back 15 Feb" }),
          starter({ name: "Haaland", isCaptain: true, status: "i", news: "Knock - Expected back 8 Mar" }),
        ],
        watchlist: [{ id: 1, name: "Mbeumo", direction: "up", pMove: 0.95, covered: true, label: "Rise" }],
        chips: [{ key: "wc", label: "Wildcard", startEvent: 8, stopEvent: 9 }],
        nextDeadline: deadline,
        rival: { name: "Cunha", eo: 8, points: 12 },
      }),
    );
    expect(out.lines.length).toBeGreaterThanOrEqual(5);
    for (const line of out.lines) {
      const v = verifyFigures(line.text, line.facts);
      expect(v.invented, `${line.id}: ${line.text}`).toEqual([]);
      expect(v.clean).toBe(true);
    }
  });

  it("TONIGHT_CUT matches the price engine's tonight threshold", () => {
    expect(TONIGHT_CUT).toBe(0.92);
  });

  it("orders triggers by what a manager cares about", () => {
    const deadline = new Date(Date.now() + 10 * 3_600_000).toISOString();
    const out = composeBriefing(
      input({
        starters: [starter({ name: "Haaland", isCaptain: true, status: "i", news: "Out" })],
        watchlist: [{ id: 1, name: "Mbeumo", direction: "up", pMove: 0.95, covered: true, label: "Rise" }],
        chips: [{ key: "wc", label: "Wildcard", startEvent: 8, stopEvent: 9 }],
        nextDeadline: deadline,
        rival: { name: "Cunha", eo: 8, points: 12 },
      }),
    );
    const ids = out.lines.map((l) => l.id);
    expect(ids).toEqual(["flagged", "captain", "watchlist", "chip", "rival"]);
  });
});