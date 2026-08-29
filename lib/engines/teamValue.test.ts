import { describe, expect, it } from "vitest";
import {
  fmtDeltaM,
  fmtM,
  priceLedger,
  readTeamValue,
  sellPrice,
  topMovers,
  type PriceMove,
  type ValuePoint,
} from "@/lib/engines/teamValue";

const pt = (gw: number, totalTenths: number, bankTenths = 0): ValuePoint => ({ gw, totalTenths, bankTenths });

const mv = (id: number, name: string, startTenths: number, eventTenths = 0): PriceMove => ({
  id,
  name,
  code: "ARS",
  photo: "",
  pos: 4,
  teamId: 1,
  costTenths: 100 + startTenths,
  startTenths,
  eventTenths,
  netTransfers: 0,
});

describe("readTeamValue", () => {
  it("splits the total into squad and bank rather than summing them", () => {
    // FPL's team value already has the selling-price rule applied; summing
    // fifteen now_cost values instead overstates a squad that has made money.
    const r = readTeamValue([pt(1, 1000), pt(2, 1003)], { totalTenths: 1007, bankTenths: 5 });
    expect(r.totalTenths).toBe(1007);
    expect(r.squadTenths).toBe(1002);
    expect(r.bankTenths).toBe(5);
  });

  it("measures the change against the budget rather than the first week played", () => {
    // A manager who joined late still started on 100.0; taking the baseline
    // from series[0] would report them level no matter what they had made.
    const r = readTeamValue([pt(7, 1012)], { totalTenths: 1012, bankTenths: 2 });
    expect(r.startTenths).toBe(1000);
    expect(r.changeTenths).toBe(12);
  });

  it("finds the best and worst gameweek", () => {
    const r = readTeamValue(
      [pt(1, 1000), pt(2, 1004), pt(3, 1002), pt(4, 1009)],
      { totalTenths: 1009, bankTenths: 0 },
    );
    expect(r.swings).toEqual([
      { gw: 2, deltaTenths: 4 },
      { gw: 3, deltaTenths: -2 },
      { gw: 4, deltaTenths: 7 },
    ]);
    expect(r.best).toEqual({ gw: 4, deltaTenths: 7 });
    expect(r.worst).toEqual({ gw: 3, deltaTenths: -2 });
  });

  it("has no best or worst before two weeks exist", () => {
    const r = readTeamValue([pt(1, 1000)], { totalTenths: 1000, bankTenths: 0 });
    expect(r.swings).toEqual([]);
    expect(r.best).toBeNull();
    expect(r.worst).toBeNull();
  });

  it("sorts a series that arrives out of order", () => {
    const r = readTeamValue([pt(3, 1005), pt(1, 1000), pt(2, 1002)], { totalTenths: 1005, bankTenths: 0 });
    expect(r.series.map((s) => s.gw)).toEqual([1, 2, 3]);
    expect(r.swings.map((s) => s.deltaTenths)).toEqual([2, 3]);
  });

  it("survives an empty history", () => {
    const r = readTeamValue([], { totalTenths: 1000, bankTenths: 0 });
    expect(r.totalTenths).toBe(1000);
    expect(r.changeTenths).toBe(0);
    expect(r.swings).toEqual([]);
  });
});

describe("sellPrice", () => {
  it("pays half the rise, rounded down", () => {
    // Bought at 10.0, now 10.3: the 0.3 rise pays 0.1, not 0.15 and not 0.3.
    expect(sellPrice(100, 103)).toBe(101);
    expect(sellPrice(100, 104)).toBe(102);
    expect(sellPrice(100, 105)).toBe(102);
  });

  it("takes a fall in full", () => {
    expect(sellPrice(100, 97)).toBe(97);
  });

  it("is the price itself when nothing moved", () => {
    expect(sellPrice(100, 100)).toBe(100);
  });
});

describe("priceLedger", () => {
  it("sorts by season move and counts the three states", () => {
    const l = priceLedger([mv(1, "Flat", 0), mv(2, "Riser", 4), mv(3, "Faller", -2)]);
    expect(l.moves.map((m) => m.name)).toEqual(["Riser", "Flat", "Faller"]);
    expect(l.risen).toBe(1);
    expect(l.fallen).toBe(1);
    expect(l.flat).toBe(1);
    expect(l.netTenths).toBe(2);
  });

  it("sums this gameweek separately from the season", () => {
    const l = priceLedger([mv(1, "A", 5, 1), mv(2, "B", -3, -1)]);
    expect(l.netTenths).toBe(2);
    expect(l.netEventTenths).toBe(0);
  });

  it("names a best only when somebody actually rose", () => {
    const l = priceLedger([mv(1, "A", 0), mv(2, "B", -1)]);
    expect(l.best).toBeNull();
    expect(l.worst?.name).toBe("B");
  });

  it("names a worst only when somebody actually fell", () => {
    const l = priceLedger([mv(1, "A", 3), mv(2, "B", 1)]);
    expect(l.best?.name).toBe("A");
    expect(l.worst).toBeNull();
  });

  it("is empty-safe", () => {
    const l = priceLedger([]);
    expect(l.moves).toEqual([]);
    expect(l.netTenths).toBe(0);
    expect(l.best).toBeNull();
    expect(l.worst).toBeNull();
  });
});

describe("topMovers", () => {
  it("never pads a fallers list with risers", () => {
    // The bug this guards: slicing a sorted list without filtering returns the
    // eight least-risen players under a "biggest fallers" heading.
    const l = topMovers([mv(1, "A", 5), mv(2, "B", 3), mv(3, "C", 1)], "down");
    expect(l).toEqual([]);
  });

  it("never pads a risers list with fallers", () => {
    expect(topMovers([mv(1, "A", -5), mv(2, "B", -1)], "up")).toEqual([]);
  });

  it("orders each direction by size and caps the list", () => {
    const moves = [mv(1, "A", 5), mv(2, "B", -4), mv(3, "C", 2), mv(4, "D", -9), mv(5, "E", 0)];
    expect(topMovers(moves, "up", 2).map((m) => m.name)).toEqual(["A", "C"]);
    expect(topMovers(moves, "down", 2).map((m) => m.name)).toEqual(["D", "B"]);
  });

  it("leaves the caller's array alone", () => {
    const moves = [mv(1, "A", 1), mv(2, "B", 5)];
    topMovers(moves, "up");
    expect(moves.map((m) => m.name)).toEqual(["A", "B"]);
  });
});

describe("formatters", () => {
  it("prints tenths as pounds", () => {
    expect(fmtM(1004)).toBe("£100.4m");
    expect(fmtM(5)).toBe("£0.5m");
  });

  it("keeps a negative total signed", () => {
    expect(fmtM(-3)).toBe("−£0.3m");
  });

  it("says level rather than +£0.0m", () => {
    expect(fmtDeltaM(0)).toBe("level");
    expect(fmtDeltaM(14)).toBe("+£1.4m");
    expect(fmtDeltaM(-3)).toBe("−£0.3m");
  });
});
