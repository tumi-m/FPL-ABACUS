import { describe, expect, it } from "vitest";
import {
  assessFormation,
  composeCockpit,
  formationOf,
  type CockpitInput,
  type CockpitSlot,
} from "./cockpit";

function slot(overrides: Partial<CockpitSlot> & { id: number }): CockpitSlot {
  return {
    name: `P${overrides.id}`,
    pos: 3,
    slot: overrides.id <= 11 ? overrides.id : overrides.id - 10,
    isCaptain: false,
    status: "a",
    news: "",
    chanceOfPlaying: null,
    horizon: [4, 4, 4, 4, 4, 4],
    netTransfers: 0,
    costChangeEvent: 0,
    ...overrides,
  };
}

/** 4-4-2 of fits, everyone projecting 4. */
function legalSquad(): CockpitSlot[] {
  return [
    slot({ id: 1, pos: 1, slot: 1 }),
    slot({ id: 2, pos: 2, slot: 2 }),
    slot({ id: 3, pos: 2, slot: 3 }),
    slot({ id: 4, pos: 2, slot: 4 }),
    slot({ id: 5, pos: 2, slot: 5 }),
    slot({ id: 6, pos: 3, slot: 6 }),
    slot({ id: 7, pos: 3, slot: 7 }),
    slot({ id: 8, pos: 3, slot: 8 }),
    slot({ id: 9, pos: 3, slot: 9, isCaptain: true }),
    slot({ id: 10, pos: 4, slot: 10 }),
    slot({ id: 11, pos: 4, slot: 11 }),
    slot({ id: 12, pos: 1, slot: 12 }),
    slot({ id: 13, pos: 2, slot: 13 }),
    slot({ id: 14, pos: 3, slot: 14 }),
    slot({ id: 15, pos: 4, slot: 15 }),
  ];
}

const proj = { weeks: 6, suggestion: null, hitCost: 4 };

function input(overrides: Partial<CockpitInput> = {}): CockpitInput {
  return {
    squadUnavailable: false,
    slots: legalSquad(),
    freeTransfers: 1,
    projection: proj,
    ...overrides,
  };
}

describe("assessFormation", () => {
  it("accepts a legal 4-4-2", () => {
    expect(assessFormation(legalSquad().slice(0, 11))).toEqual({ ok: true, problem: null });
  });

  it("names the shortfall when the XI is one short", () => {
    const short = legalSquad().slice(0, 10);
    expect(assessFormation(short)).toEqual({ ok: false, problem: "Your XI is one short" });
  });

  it("names the line that is short when eleven field but no keeper", () => {
    const noKeeper = legalSquad()
      .filter((s) => s.pos !== 1)
      .slice(0, 10)
      .concat(slot({ id: 99, pos: 3, slot: 11 }));
    const res = assessFormation(noKeeper);
    expect(res.ok).toBe(false);
    expect(res.problem).toContain("in goal");
  });

  it("rejects five forwards", () => {
    const fiveFwd = legalSquad()
      .filter((s) => s.pos !== 4)
      .slice(0, 7)
      .concat([
        slot({ id: 90, pos: 4, slot: 8 }),
        slot({ id: 91, pos: 4, slot: 9 }),
        slot({ id: 92, pos: 4, slot: 10 }),
        slot({ id: 93, pos: 4, slot: 11 }),
      ]);
    expect(assessFormation(fiveFwd).ok).toBe(false);
  });
});

describe("formationOf", () => {
  it("reads 4-4-2", () => {
    expect(formationOf(legalSquad().slice(0, 11))).toBe("4-4-2");
  });
});

describe("composeCockpit", () => {
  it("is all clear for a planned, legal, settled squad", () => {
    const res = composeCockpit(input());
    expect(res.allClear).toBe(true);
    expect(res.blocks.map((b) => b.id)).toEqual(["xi", "flagged", "captain", "transfers", "price"]);
    expect(res.blocks[1].verdict).toBe("No starters are flagged.");
    expect(res.blocks[3].verdict).toContain("banked");
  });

  it("collapses ok blocks to tick lines (no evidence)", () => {
    const res = composeCockpit(input());
    for (const b of res.blocks) {
      if (b.state === "ok") expect(b.evidence).toBeUndefined();
    }
  });

  it("names a short XI from the formation rules", () => {
    const slots = legalSquad().filter((s) => s.pos !== 2 || s.slot !== 5).concat();
    // removing a defender from the XI leaves ten + bench intact
    const ten = legalSquad().slice(0, 10);
    const res = composeCockpit(input({ slots: ten.concat(legalSquad().slice(11)) }));
    expect(res.blocks[0].state).toBe("critical");
    expect(res.blocks[0].verdict).toBe("Your XI is one short");
    expect(slots).toHaveLength(14);
  });

  it("lists flagged starters with FPL's words verbatim", () => {
    const slots = legalSquad();
    slots[4] = { ...slots[4], status: "d", news: "Ankle injury - 75% chance of playing", chanceOfPlaying: 75 };
    slots[8] = { ...slots[8], isCaptain: false, status: "i", news: "Knee injury - Expected back 15 Feb", chanceOfPlaying: 0 };
    const res = composeCockpit(input({ slots }));
    const flagged = res.blocks.find((b) => b.id === "flagged")!;
    expect(flagged.state).toBe("critical");
    expect(flagged.verdict).toBe("2 starters are flagged.");
    expect(flagged.evidence?.map((e) => e.text)).toEqual([
      "P5 — Knee injury · Expected back 15 Feb",
      "P5 — Ankle injury · 75% chance of playing",
    ].map((t, i) => (i === 0 ? t.replace("P5", "P9") : t)));
  });

  it("demotes the armband when a teammate projects higher", () => {
    const slots = legalSquad();
    slots[3] = { ...slots[3], horizon: [9, 9, 9, 9, 9, 9] }; // a defender on 9
    const res = composeCockpit(input({ slots }));
    const captain = res.blocks.find((b) => b.id === "captain")!;
    expect(captain.state).toBe("warn");
    expect(captain.verdict).toContain("P4 projects higher");
    expect(captain.evidence?.[0].est?.value).toBe("+5.0");
  });

  it("keeps the armband on the highest projection", () => {
    const slots = legalSquad();
    slots[8] = { ...slots[8], isCaptain: true, horizon: [10, 0, 0, 0, 0, 0] };
    const res = composeCockpit(input({ slots }));
    expect(res.blocks.find((b) => b.id === "captain")!.state).toBe("ok");
  });

  it("flags a captain who is ruled out", () => {
    const slots = legalSquad();
    slots[8] = { ...slots[8], isCaptain: true, status: "i", news: "Suspended - Expected back 20 Jan", chanceOfPlaying: 0 };
    const res = composeCockpit(input({ slots }));
    expect(res.blocks.find((b) => b.id === "captain")!.state).toBe("critical");
  });

  it("prices an unused free transfer with the suggestion and its gain", () => {
    const res = composeCockpit(
      input({
        freeTransfers: 1,
        projection: {
          weeks: 6,
          hitCost: 4,
          suggestion: { outId: 6, inId: 99, outName: "OUT", inName: "IN", gain: 2.4 },
        },
      }),
    );
    const transfers = res.blocks.find((b) => b.id === "transfers")!;
    expect(transfers.state).toBe("warn");
    expect(transfers.verdict).toContain("OUT → IN");
    expect(transfers.evidence?.[0].est?.value).toBe("+2.4");
    expect(transfers.action?.href).toBe("/planner?out=6&in=99");
  });

  it("calls a hit-priced move only when the gain beats the cost", () => {
    const base = input({ freeTransfers: 0 });
    const withGain = {
      ...base,
      projection: { weeks: 6, hitCost: 4, suggestion: { outId: 6, inId: 99, outName: "OUT", inName: "IN", gain: 4.1 } },
    };
    expect(composeCockpit(withGain).blocks.find((b) => b.id === "transfers")!.state).toBe("warn");
    const withSmallGain = {
      ...base,
      projection: { weeks: 6, hitCost: 4, suggestion: { outId: 6, inId: 99, outName: "OUT", inName: "IN", gain: 3.9 } },
    };
    expect(composeCockpit(withSmallGain).blocks.find((b) => b.id === "transfers")!.state).toBe("ok");
  });

  it("degrades to an honest unpriced block when the projection desk missed", () => {
    const res = composeCockpit(input({ projection: null }));
    const transfers = res.blocks.find((b) => b.id === "transfers")!;
    expect(transfers.verdict).toContain("1 free transfer in hand");
    expect(transfers.verdict).toContain("not priced");
    const captain = res.blocks.find((b) => b.id === "captain")!;
    expect(captain.verdict).toContain("not priced");
  });

  it("says the one-line all-clear only when every block is ok", () => {
    expect(composeCockpit(input()).allClear).toBe(true);
    const res = composeCockpit(input({ freeTransfers: 1, projection: { weeks: 6, hitCost: 4, suggestion: { outId: 6, inId: 99, outName: "OUT", inName: "IN", gain: 1 } } }));
    expect(res.allClear).toBe(false);
  });

  it("says so when picks are unavailable", () => {
    const res = composeCockpit(input({ squadUnavailable: true }));
    expect(res.blocks).toHaveLength(1);
    expect(res.blocks[0].state).toBe("critical");
    expect(res.allClear).toBe(false);
  });

  it("warns on squad players closing on a price move", () => {
    const slots = legalSquad();
    slots[2] = { ...slots[2], netTransfers: 190_000, costChangeEvent: 0 };
    const res = composeCockpit(input({ slots }));
    const price = res.blocks.find((b) => b.id === "price")!;
    expect(price.state).toBe("ok"); // it is informational, not a warning
    expect(price.verdict).toContain("within reach of a price move");
    expect(price.evidence?.[0].text).toContain("P3");
    expect(price.evidence?.[0].est).toBeDefined();
  });

  it("carries verdict text without estimate figures", () => {
    const res = composeCockpit(
      input({
        projection: { weeks: 6, hitCost: 4, suggestion: { outId: 6, inId: 99, outName: "OUT", inName: "IN", gain: 2.4 } },
      }),
    );
    for (const b of res.blocks) {
      // verdict lines name players and count things; the estimated gain lives in evidence
      expect(b.verdict).toEqual(expect.not.stringMatching(/gain/));
    }
  });
});