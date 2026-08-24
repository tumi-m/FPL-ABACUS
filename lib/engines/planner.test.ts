import { describe, expect, it } from "vitest";
import {
  applyMoves,
  bankAfter,
  buildTicker,
  checkSwap,
  fdrHeatStep,
  runScore,
  filterMarket,
  heatCuts,
  heatIndex,
  priceOutlook,
  stageMove,
  summarisePlan,
  windowPoints,
  type PlannerPlayer,
} from "@/lib/engines/planner";

function player(over: Partial<PlannerPlayer> & { id: number }): PlannerPlayer {
  return {
    name: `P${over.id}`,
    pos: 3,
    team: 1,
    code: "ARS",
    cost: 50,
    photo: "",
    form: 0,
    ppg: 0,
    points: 0,
    owned: 0,
    minutes: 900,
    status: "a",
    news: "",
    horizon: [4, 4, 4, 4, 4, 4],
    costChangeEvent: 0,
    costChangeStart: 0,
    netTransfers: 0,
    ...over,
  };
}

const pool = [
  player({ id: 1, pos: 1, team: 1, cost: 45 }),
  player({ id: 2, pos: 3, team: 2, code: "AVL", cost: 80, horizon: [5, 5, 5, 5, 5, 5] }),
  player({ id: 3, pos: 3, team: 3, code: "BOU", cost: 120, horizon: [7, 7, 7, 7, 7, 7] }),
  player({ id: 4, pos: 3, team: 2, code: "AVL", cost: 60, horizon: [3, 3, 3, 3, 3, 3] }),
  player({ id: 5, pos: 4, team: 4, code: "BRE", cost: 90 }),
  player({ id: 6, pos: 3, team: 2, code: "AVL", cost: 55 }),
  player({ id: 7, pos: 3, team: 2, code: "AVL", cost: 55 }),
  player({ id: 8, pos: 4, team: 5, code: "BHA", cost: 55 }),
];
const byId = new Map(pool.map((p) => [p.id, p]));
const playerOf = (id: number) => byId.get(id);

describe("windowPoints", () => {
  it("sums only the weeks asked for", () => {
    expect(windowPoints([2, 3, 4, 5], 1)).toBe(2);
    expect(windowPoints([2, 3, 4, 5], 3)).toBe(9);
  });

  it("never reads past the horizon it was given", () => {
    expect(windowPoints([2, 3], 6)).toBe(5);
    expect(windowPoints(undefined, 3)).toBe(0);
  });
});

describe("stageMove", () => {
  it("appends a fresh swap", () => {
    expect(stageMove([], 1, 2)).toEqual([{ out: 1, in: 2 }]);
  });

  it("rewrites rather than stacks when the same slot moves twice", () => {
    const first = stageMove([], 4, 2);
    const second = stageMove(first, 2, 3);
    expect(second).toEqual([{ out: 4, in: 3 }]);
  });

  it("cancels the transfer when a player is moved back to who he replaced", () => {
    const first = stageMove([], 4, 2);
    expect(stageMove(first, 2, 4)).toEqual([]);
  });

  it("refuses to sell the same squad player twice", () => {
    const first = stageMove([], 4, 2);
    expect(stageMove(first, 4, 3)).toEqual(first);
  });
});

describe("applyMoves", () => {
  it("swaps in place so the squad keeps its slot order", () => {
    expect(applyMoves([1, 4, 5], [{ out: 4, in: 2 }])).toEqual([1, 2, 5]);
  });
});

describe("bankAfter", () => {
  it("credits the selling price, not today's price", () => {
    // Sold at 65 (bought cheap, risen), bought at 80, from a 20 bank.
    const bank = bankAfter(20, [{ out: 4, in: 2 }], () => 65, (id) => playerOf(id)!.cost);
    expect(bank).toBe(5);
  });
});

describe("checkSwap", () => {
  const base = { squadIds: [1, 4, 5], bankTenths: 0, playerOf, sellPriceOf: () => 60 };

  it("allows a like-for-like move you can afford", () => {
    expect(checkSwap(4, 6, base).ok).toBe(true);
  });

  it("blocks a different position", () => {
    const res = checkSwap(4, 8, base);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/forward/i);
  });

  it("blocks a player already owned", () => {
    expect(checkSwap(4, 1, { ...base, squadIds: [1, 4, 5] }).reason).toBe("Already in your squad");
  });

  it("reports exactly how short the budget is", () => {
    const res = checkSwap(4, 3, { ...base, bankTenths: 0, sellPriceOf: () => 60 });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("£6.0m short");
  });

  it("enforces three per club", () => {
    // Squad already holds 6, 7 and 4 from Villa; 4 leaves, 2 (Villa) comes in — legal.
    const three = { ...base, squadIds: [6, 7, 4], sellPriceOf: () => 90 };
    expect(checkSwap(4, 2, three).ok).toBe(true);
    // Position is checked before the club count, so a GK-for-MID never reaches it.
    const four = { ...base, squadIds: [6, 7, 4, 1], sellPriceOf: () => 90 };
    expect(checkSwap(1, 2, four).reason).toMatch(/can't replace a goalkeeper/i);
  });

  it("blocks a fourth from one club on a legal position swap", () => {
    const ctx = { ...base, squadIds: [6, 7, 4, 3], sellPriceOf: () => 130 };
    const res = checkSwap(3, 2, ctx);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("Already 3 from AVL");
  });
});

describe("summarisePlan", () => {
  const opts = { freeTransfers: 1, weeks: 3, bankTenths: 40, playerOf, sellPriceOf: () => 60 };

  it("prices one free transfer with no hit", () => {
    const s = summarisePlan([{ out: 4, in: 2 }], opts);
    expect(s.hits).toBe(0);
    expect(s.gross).toBeCloseTo(6, 5); // (5−3) × 3 weeks
    expect(s.net).toBeCloseTo(6, 5);
  });

  it("charges four points for the move past the free one", () => {
    const s = summarisePlan(
      [
        { out: 4, in: 2 },
        { out: 6, in: 3 },
      ],
      opts,
    );
    expect(s.hits).toBe(1);
    expect(s.hitCost).toBe(4);
    expect(s.net).toBeCloseTo(s.gross - 4, 5);
  });
});

describe("filterMarket", () => {
  const base = {
    search: "",
    pos: null,
    team: null,
    maxCost: null,
    affordableWithin: null,
    sort: "projected" as const,
    weeks: 3,
    exclude: new Set<number>(),
  };

  it("orders by projected points over the chosen window", () => {
    expect(filterMarket(pool, base)[0].id).toBe(3);
  });

  it("keeps owned players out", () => {
    const rows = filterMarket(pool, { ...base, exclude: new Set([3]) });
    expect(rows.some((r) => r.id === 3)).toBe(false);
  });

  it("respects the affordability ceiling", () => {
    const rows = filterMarket(pool, { ...base, affordableWithin: 60 });
    expect(rows.every((r) => r.cost <= 60)).toBe(true);
  });

  it("matches a club code as well as a name", () => {
    expect(filterMarket(pool, { ...base, search: "bou" })).toHaveLength(1);
  });

  it("sorts price low to high when asked", () => {
    const rows = filterMarket(pool, { ...base, sort: "price-low" });
    expect(rows[0].cost).toBeLessThanOrEqual(rows[rows.length - 1].cost);
  });
});

describe("priceOutlook", () => {
  it("calls a heavy net-in a rise", () => {
    const o = priceOutlook({ netTransfers: 175_000, costChangeEvent: 0 });
    expect(o.direction).toBe("up");
    expect(o.label).toBe("Rise tonight");
  });

  it("signs a mass exodus as a fall", () => {
    expect(priceOutlook({ netTransfers: -120_000, costChangeEvent: 0 }).direction).toBe("down");
  });

  it("says so when the price already moved this gameweek", () => {
    expect(priceOutlook({ netTransfers: 5_000, costChangeEvent: 1 }).label).toBe("Rose this GW");
  });

  it("stays flat on quiet traffic", () => {
    expect(priceOutlook({ netTransfers: 1_000, costChangeEvent: 0 }).direction).toBe("flat");
  });
});

describe("heat scale", () => {
  it("spreads a population across all six steps", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const cuts = heatCuts(values);
    expect(heatIndex(Math.min(...values), cuts)).toBe(1);
    expect(heatIndex(Math.max(...values), cuts)).toBe(6);
  });

  it("survives an empty population", () => {
    expect(heatIndex(3, heatCuts([]))).toBe(1);
  });
});

describe("buildTicker", () => {
  const clubs = [
    { id: 1, code: "ARS", name: "Arsenal", crestCode: 3 },
    { id: 2, code: "AVL", name: "Aston Villa", crestCode: 7 },
    { id: 3, code: "BOU", name: "Bournemouth", crestCode: 91 },
  ];
  const fixtures = [
    { event: 1, team_h: 1, team_a: 2, team_h_difficulty: 2, team_a_difficulty: 4 },
    { event: 2, team_h: 3, team_a: 1, team_h_difficulty: 5, team_a_difficulty: 2 },
    // Aston Villa play twice in GW2 — a double.
    { event: 2, team_h: 2, team_a: 3, team_h_difficulty: 3, team_a_difficulty: 3 },
    { event: 2, team_h: 2, team_a: 1, team_h_difficulty: 4, team_a_difficulty: 3 },
    // Beyond the window, and an unscheduled fixture — both ignored.
    { event: 9, team_h: 1, team_a: 3, team_h_difficulty: 2, team_a_difficulty: 4 },
    { event: null, team_h: 1, team_a: 2, team_h_difficulty: 2, team_a_difficulty: 4 },
  ];

  const ticker = buildTicker(fixtures, clubs, [1, 2]);

  it("gives every club a cell for every gameweek in the window", () => {
    for (const c of clubs) {
      expect(Object.keys(ticker[c.id]).map(Number).sort()).toEqual([1, 2]);
    }
  });

  it("marks a blank as an empty array rather than a missing key", () => {
    expect(ticker[3][1]).toEqual([]);
  });

  it("records both sides of a fixture with the right venue and difficulty", () => {
    expect(ticker[1][1]).toEqual([{ opp: "AVL", oppId: 2, home: true, fdr: 2 }]);
    expect(ticker[2][1]).toEqual([{ opp: "ARS", oppId: 1, home: false, fdr: 4 }]);
  });

  it("keeps both halves of a double gameweek", () => {
    expect(ticker[2][2]).toHaveLength(2);
  });

  it("ignores fixtures outside the window and ones without a gameweek", () => {
    // Arsenal's in-window fixtures: GW1 vs Villa, GW2 at Bournemouth, GW2 at Villa.
    // The GW9 tie and the unscheduled one never appear.
    expect(Object.values(ticker[1]).flat()).toHaveLength(3);
  });
});

describe("runScore", () => {
  it("adds five-minus-difficulty across a gameweek, so doubles count twice", () => {
    expect(runScore([{ opp: "AVL", oppId: 2, home: true, fdr: 2 }])).toBe(4);
    expect(
      runScore([
        { opp: "AVL", oppId: 2, home: true, fdr: 2 },
        { opp: "BOU", oppId: 3, home: false, fdr: 3 },
      ]),
    ).toBe(7);
  });

  it("scores a blank as nothing", () => {
    expect(runScore([])).toBe(0);
  });
});

describe("fdrHeatStep", () => {
  it("puts the easiest fixture at the hot end of the ramp", () => {
    expect(fdrHeatStep(1)).toBe(6);
    expect(fdrHeatStep(5)).toBe(1);
    expect(fdrHeatStep(1)).toBeGreaterThan(fdrHeatStep(3));
    expect(fdrHeatStep(3)).toBeGreaterThan(fdrHeatStep(5));
  });
});
