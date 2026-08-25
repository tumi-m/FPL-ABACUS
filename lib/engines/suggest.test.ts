import { describe, expect, it } from "vitest";
import type { PlannerPlayer } from "@/lib/engines/planner";
import { spendLabel, suggestTransfers } from "@/lib/engines/suggest";

function player(over: Partial<PlannerPlayer> & { id: number }): PlannerPlayer {
  return {
    name: `P${over.id}`,
    pos: 3,
    team: 1,
    code: "AAA",
    cost: 50,
    photo: "",
    form: 3,
    ppg: 3,
    points: 30,
    owned: 5,
    minutes: 900,
    status: "a",
    news: "",
    horizon: [2, 2, 2, 2, 2, 2],
    costChangeEvent: 0,
    costChangeStart: 0,
    netTransfers: 0,
    ...over,
  };
}

/** Four of yours; ids 1–4. The midfielder (3) is the weak link. */
const squad = () => [
  player({ id: 1, pos: 1, team: 1, cost: 45, horizon: [3, 3, 3, 3, 3, 3] }),
  player({ id: 2, pos: 2, team: 1, cost: 50, horizon: [4, 4, 4, 4, 4, 4] }),
  player({ id: 3, pos: 3, team: 2, cost: 60, horizon: [1, 1, 1, 1, 1, 1] }),
  player({ id: 4, pos: 4, team: 3, cost: 80, horizon: [5, 5, 5, 5, 5, 5] }),
];

const sell = (id: number) => squad().find((p) => p.id === id)?.cost ?? 0;

describe("suggestTransfers", () => {
  it("finds the upgrade on the weakest link", () => {
    const market = [
      ...squad(),
      player({ id: 10, pos: 3, team: 4, cost: 60, horizon: [6, 6, 6, 6, 6, 6] }),
    ];
    const [top] = suggestTransfers({ squad: squad(), market, bankTenths: 0, sellPriceOf: sell, weeks: 6 });
    expect(top.outId).toBe(3);
    expect(top.inId).toBe(10);
    expect(top.gain).toBeCloseTo(30, 5); // (6−1) × 6 weeks
    expect(top.spend).toBe(0);
    expect(top.bankAfter).toBe(0);
  });

  it("never suggests a move you cannot afford", () => {
    const market = [
      ...squad(),
      player({ id: 10, pos: 3, team: 4, cost: 130, horizon: [9, 9, 9, 9, 9, 9] }),
    ];
    // Selling the £6.0m midfielder with an empty bank leaves £6.0m, not £13.0m.
    expect(suggestTransfers({ squad: squad(), market, bankTenths: 0, sellPriceOf: sell, weeks: 6 })).toEqual([]);
  });

  it("spends the bank when there is one", () => {
    const market = [
      ...squad(),
      player({ id: 10, pos: 3, team: 4, cost: 90, horizon: [9, 9, 9, 9, 9, 9] }),
    ];
    const out = suggestTransfers({ squad: squad(), market, bankTenths: 30, sellPriceOf: sell, weeks: 6 });
    expect(out[0].inId).toBe(10);
    expect(out[0].spend).toBe(30); // 9.0 in, 6.0 out
    expect(out[0].bankAfter).toBe(0);
  });

  it("respects the three-per-club cap", () => {
    // Three of the four are already club 5; a fourth from club 5 is illegal.
    const mine = [
      player({ id: 1, pos: 1, team: 5, cost: 45, horizon: [3, 3, 3, 3, 3, 3] }),
      player({ id: 2, pos: 2, team: 5, cost: 50, horizon: [4, 4, 4, 4, 4, 4] }),
      player({ id: 3, pos: 4, team: 5, cost: 80, horizon: [5, 5, 5, 5, 5, 5] }),
      player({ id: 4, pos: 3, team: 2, cost: 60, horizon: [1, 1, 1, 1, 1, 1] }),
    ];
    const market = [
      ...mine,
      player({ id: 10, pos: 3, team: 5, cost: 60, horizon: [9, 9, 9, 9, 9, 9] }),
      player({ id: 11, pos: 3, team: 6, cost: 60, horizon: [6, 6, 6, 6, 6, 6] }),
    ];
    const out = suggestTransfers({
      squad: mine,
      market,
      bankTenths: 0,
      sellPriceOf: (id) => mine.find((p) => p.id === id)?.cost ?? 0,
      weeks: 6,
    });
    // The better player is a fourth from club 5, so the legal one wins.
    expect(out[0].inId).toBe(11);
  });

  it("never suggests a swap that loses points", () => {
    const market = [
      ...squad(),
      player({ id: 10, pos: 3, team: 4, cost: 55, horizon: [0, 0, 0, 0, 0, 0] }),
    ];
    expect(suggestTransfers({ squad: squad(), market, bankTenths: 0, sellPriceOf: sell, weeks: 6 })).toEqual([]);
  });

  it("gives each of your players one suggestion, not ten variations", () => {
    const market = [
      ...squad(),
      player({ id: 10, pos: 3, team: 4, cost: 60, horizon: [6, 6, 6, 6, 6, 6] }),
      player({ id: 11, pos: 3, team: 5, cost: 60, horizon: [5, 5, 5, 5, 5, 5] }),
      player({ id: 12, pos: 3, team: 6, cost: 60, horizon: [4, 4, 4, 4, 4, 4] }),
    ];
    const out = suggestTransfers({ squad: squad(), market, bankTenths: 0, sellPriceOf: sell, weeks: 6 });
    expect(out.filter((s) => s.outId === 3)).toHaveLength(1);
    expect(out.find((s) => s.outId === 3)!.inId).toBe(10); // the best of the three
  });

  it("never offers the same signing twice — you can only sign him once", () => {
    // Two weak midfielders of yours, and one obvious upgrade both could take.
    const mine = [
      player({ id: 1, pos: 3, team: 1, cost: 60, horizon: [1, 1, 1, 1, 1, 1] }),
      player({ id: 2, pos: 3, team: 2, cost: 60, horizon: [2, 2, 2, 2, 2, 2] }),
      player({ id: 3, pos: 1, team: 3, cost: 45, horizon: [3, 3, 3, 3, 3, 3] }),
      player({ id: 4, pos: 4, team: 4, cost: 80, horizon: [5, 5, 5, 5, 5, 5] }),
    ];
    const market = [
      ...mine,
      player({ id: 10, pos: 3, team: 5, cost: 60, horizon: [9, 9, 9, 9, 9, 9] }),
      player({ id: 11, pos: 3, team: 6, cost: 60, horizon: [7, 7, 7, 7, 7, 7] }),
    ];
    const out = suggestTransfers({
      squad: mine,
      market,
      bankTenths: 0,
      sellPriceOf: (id) => mine.find((p) => p.id === id)?.cost ?? 0,
      weeks: 6,
    });
    expect(new Set(out.map((s) => s.inId)).size).toBe(out.length);
    expect(new Set(out.map((s) => s.outId)).size).toBe(out.length);
    // The best signing goes to the outgoing that gains most from him...
    expect(out[0]).toMatchObject({ outId: 1, inId: 10 });
    // ...and the next-best signing covers the other.
    expect(out[1]).toMatchObject({ outId: 2, inId: 11 });
  });

  it("is a set of moves you could make together", () => {
    const mine = [
      player({ id: 1, pos: 3, team: 1, cost: 60, horizon: [1, 1, 1, 1, 1, 1] }),
      player({ id: 2, pos: 3, team: 2, cost: 60, horizon: [1, 1, 1, 1, 1, 1] }),
      player({ id: 3, pos: 1, team: 3, cost: 45, horizon: [1, 1, 1, 1, 1, 1] }),
      player({ id: 4, pos: 4, team: 4, cost: 80, horizon: [1, 1, 1, 1, 1, 1] }),
    ];
    const market = [
      ...mine,
      player({ id: 10, pos: 3, team: 5, cost: 60, horizon: [9, 9, 9, 9, 9, 9] }),
      player({ id: 11, pos: 3, team: 6, cost: 60, horizon: [8, 8, 8, 8, 8, 8] }),
      player({ id: 12, pos: 1, team: 7, cost: 45, horizon: [7, 7, 7, 7, 7, 7] }),
    ];
    const out = suggestTransfers({
      squad: mine,
      market,
      bankTenths: 0,
      sellPriceOf: (id) => mine.find((p) => p.id === id)?.cost ?? 0,
      weeks: 6,
    });
    // No player is spent twice on either side, so the whole list is stageable.
    const outs = out.map((s) => s.outId);
    const ins = out.map((s) => s.inId);
    expect(outs).toEqual([...new Set(outs)]);
    expect(ins).toEqual([...new Set(ins)]);
  });

  it("leaves flagged and barely-played candidates off the board", () => {
    const market = [
      ...squad(),
      player({ id: 10, pos: 3, team: 4, cost: 60, horizon: [9, 9, 9, 9, 9, 9], status: "i" }),
      player({ id: 11, pos: 3, team: 5, cost: 60, horizon: [8, 8, 8, 8, 8, 8], minutes: 30 }),
      player({ id: 12, pos: 3, team: 6, cost: 60, horizon: [3, 3, 3, 3, 3, 3] }),
    ];
    const out = suggestTransfers({
      squad: squad(),
      market,
      bankTenths: 0,
      sellPriceOf: sell,
      weeks: 6,
      minMinutes: 180,
    });
    expect(out[0].inId).toBe(12);
  });

  it("prices over the window asked for, not the whole horizon", () => {
    const market = [
      ...squad(),
      player({ id: 10, pos: 3, team: 4, cost: 60, horizon: [6, 6, 1, 1, 1, 1] }),
    ];
    const two = suggestTransfers({ squad: squad(), market, bankTenths: 0, sellPriceOf: sell, weeks: 2 })[0];
    const six = suggestTransfers({ squad: squad(), market, bankTenths: 0, sellPriceOf: sell, weeks: 6 })[0];
    expect(two.gain).toBeCloseTo(10, 5); // (6−1) × 2
    expect(six.gain).toBeCloseTo(10, 5); // 16 − 6
    expect(two.inPoints).toBeCloseTo(12, 5);
    expect(six.inPoints).toBeCloseTo(16, 5);
  });

  it("honours the limit and returns the best first", () => {
    const market = [
      ...squad(),
      player({ id: 10, pos: 3, team: 4, cost: 60, horizon: [6, 6, 6, 6, 6, 6] }),
      player({ id: 20, pos: 1, team: 7, cost: 45, horizon: [4, 4, 4, 4, 4, 4] }),
      player({ id: 30, pos: 2, team: 8, cost: 50, horizon: [5, 5, 5, 5, 5, 5] }),
    ];
    const all = suggestTransfers({ squad: squad(), market, bankTenths: 0, sellPriceOf: sell, weeks: 6 });
    expect(all.map((s) => s.gain)).toEqual([...all.map((s) => s.gain)].sort((a, b) => b - a));
    expect(suggestTransfers({ squad: squad(), market, bankTenths: 0, sellPriceOf: sell, weeks: 6, limit: 1 })).toHaveLength(1);
  });
});

describe("spendLabel", () => {
  it("says what the move does to your money", () => {
    expect(spendLabel(0)).toBe("same price");
    expect(spendLabel(5)).toBe("£0.5m more");
    expect(spendLabel(-12)).toBe("frees £1.2m");
  });
});
