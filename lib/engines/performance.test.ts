import { describe, expect, it } from "vitest";
import {
  bonusEfficiency,
  bonusRate,
  cardRate,
  creation,
  defaultMinutesFloor,
  defconHitsEstimate,
  defconThreshold,
  defending,
  expectedCleanSheets,
  finishing,
  involvement,
  meetsMinutes,
  per90,
  percentile,
  positionalDelta,
  rankBoard,
  sampleWeight,
  valuePerMillion,
  verdict,
  type PerfPlayer,
} from "@/lib/engines/performance";

function player(over: Partial<PerfPlayer> & { id: number }): PerfPlayer {
  return {
    name: `P${over.id}`,
    pos: 4,
    teamId: 1,
    code: "ARS",
    photo: "",
    cost: 70,
    minutes: 1800,
    starts: 20,
    points: 100,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    goalsConceded: 0,
    saves: 0,
    bonus: 0,
    bps: 0,
    defcon: 0,
    tackles: 0,
    recoveries: 0,
    cbi: 0,
    yellowCards: 0,
    redCards: 0,
    xg: 0,
    xa: 0,
    xgi: 0,
    xgc: 0,
    owned: 5,
    ...over,
  };
}

describe("per90", () => {
  it("rates a total over the minutes played", () => {
    expect(per90(10, 900)).toBe(1);
    expect(per90(5, 1800)).toBe(0.25);
  });

  it("returns zero rather than infinity for a player who never played", () => {
    expect(per90(3, 0)).toBe(0);
  });
});

describe("sampleWeight", () => {
  it("trusts a full season far more than a cameo", () => {
    expect(sampleWeight(90)).toBeLessThan(0.15);
    expect(sampleWeight(900)).toBeCloseTo(0.5, 5);
    expect(sampleWeight(3400)).toBeGreaterThan(0.78);
  });

  it("is zero with no minutes", () => {
    expect(sampleWeight(0)).toBe(0);
  });
});

describe("finishing", () => {
  it("reads a clinical season as overperformance", () => {
    const d = finishing(player({ id: 1, goals: 14, xg: 9, minutes: 2700 }));
    expect(d.raw).toBe(5);
    expect(d.actual).toBe(14);
    expect(d.expected).toBe(9);
    expect(d.index).toBeGreaterThan(0);
  });

  it("reads a wasteful season as underperformance", () => {
    expect(finishing(player({ id: 2, goals: 3, xg: 8.5 })).raw).toBe(-5.5);
  });

  it("shrinks a small sample toward zero", () => {
    const cameo = finishing(player({ id: 3, goals: 3, xg: 0.4, minutes: 90 }));
    const season = finishing(player({ id: 4, goals: 3, xg: 0.4, minutes: 2700 }));
    expect(cameo.raw).toBe(season.raw);
    expect(Math.abs(cameo.index)).toBeLessThan(Math.abs(season.index));
  });
});

describe("creation and involvement", () => {
  it("compares assists with expected assists", () => {
    expect(creation(player({ id: 5, assists: 9, xa: 6 })).raw).toBe(3);
  });

  it("compares goals plus assists with expected involvement", () => {
    expect(involvement(player({ id: 6, goals: 5, assists: 4, xgi: 7.5 })).raw).toBe(1.5);
  });
});

describe("expectedCleanSheets", () => {
  it("uses the Poisson shutout probability across starts", () => {
    // 1.0 xGC per 90 over 20 starts → 20 · e^-1 ≈ 7.36
    const p = player({ id: 7, pos: 2, minutes: 1800, starts: 20, xgc: 20 });
    expect(expectedCleanSheets(p)).toBeCloseTo(7.36, 1);
  });

  it("rewards a stingy defence with a higher expectation", () => {
    const tight = player({ id: 8, pos: 2, minutes: 1800, starts: 20, xgc: 12 });
    const leaky = player({ id: 9, pos: 2, minutes: 1800, starts: 20, xgc: 34 });
    expect(expectedCleanSheets(tight)).toBeGreaterThan(expectedCleanSheets(leaky));
  });

  it("is zero for a player who has not started", () => {
    expect(expectedCleanSheets(player({ id: 10, minutes: 0, starts: 0 }))).toBe(0);
  });

  it("falls back to whole matches when starts are missing", () => {
    const p = player({ id: 11, pos: 2, minutes: 900, starts: 0, xgc: 9 });
    expect(expectedCleanSheets(p)).toBeGreaterThan(0);
  });
});

describe("defending", () => {
  it("scores a defence that beat its expectation", () => {
    const d = defending(player({ id: 12, pos: 2, cleanSheets: 11, minutes: 1800, starts: 20, xgc: 20 }));
    expect(d.actual).toBe(11);
    expect(d.raw).toBeGreaterThan(0);
  });
});

describe("positionalDelta", () => {
  it("judges keepers and defenders on shutouts", () => {
    expect(positionalDelta(player({ id: 13, pos: 1 })).key).toBe("defending");
    expect(positionalDelta(player({ id: 14, pos: 2 })).key).toBe("defending");
  });

  it("judges midfielders on total involvement", () => {
    expect(positionalDelta(player({ id: 15, pos: 3 })).key).toBe("involvement");
  });

  it("judges forwards on finishing", () => {
    expect(positionalDelta(player({ id: 16, pos: 4 })).key).toBe("finishing");
  });
});

describe("verdict", () => {
  it("keeps a small gap at par", () => {
    expect(verdict(0.3)).toBe("par");
    expect(verdict(-0.5)).toBe("par");
  });

  it("calls a clear gap in either direction", () => {
    expect(verdict(2.4)).toBe("over");
    expect(verdict(-2.4)).toBe("under");
  });
});

describe("DEFCON", () => {
  it("uses ten for defenders and twelve for everyone else", () => {
    expect(defconThreshold(2)).toBe(10);
    expect(defconThreshold(3)).toBe(12);
    expect(defconThreshold(1)).toBe(12);
  });

  it("estimates hits from the season total", () => {
    // 20 starts, 95 contributions, threshold 10 → at most 9 hits.
    expect(defconHitsEstimate(player({ id: 17, pos: 2, defcon: 95, starts: 20 }))).toBe(9);
  });

  it("never claims more hits than appearances", () => {
    expect(defconHitsEstimate(player({ id: 18, pos: 2, defcon: 500, starts: 3 }))).toBe(3);
  });

  it("is zero for a player who has not appeared", () => {
    expect(defconHitsEstimate(player({ id: 19, defcon: 40, starts: 0, minutes: 0 }))).toBe(0);
  });
});

describe("rates", () => {
  it("counts reds alongside yellows in the booking rate", () => {
    expect(cardRate(player({ id: 20, yellowCards: 8, redCards: 1, minutes: 1800 }))).toBe(0.45);
  });

  it("rates bonus per ninety", () => {
    expect(bonusRate(player({ id: 21, bonus: 10, minutes: 1800 }))).toBe(0.5);
  });

  it("reports BPS spent per bonus point, or nothing before the first", () => {
    expect(bonusEfficiency(player({ id: 22, bonus: 10, bps: 600 }))).toBe(60);
    expect(bonusEfficiency(player({ id: 23, bonus: 0, bps: 400 }))).toBeNull();
  });

  it("prices points against the current cost", () => {
    expect(valuePerMillion(player({ id: 24, points: 120, cost: 80 }))).toBe(15);
    expect(valuePerMillion(player({ id: 25, cost: 0 }))).toBe(0);
  });
});

describe("percentile", () => {
  it("puts the top of a population near one and the bottom near zero", () => {
    const pop = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(10, pop)).toBeGreaterThan(0.9);
    expect(percentile(1, pop)).toBeLessThan(0.1);
  });

  it("splits ties at the midpoint", () => {
    expect(percentile(5, [5, 5, 5, 5])).toBe(0.5);
  });

  it("survives an empty population", () => {
    expect(percentile(3, [])).toBe(0);
  });
});

describe("rankBoard", () => {
  const pool = [
    player({ id: 1, goals: 12, minutes: 2700, points: 150, pos: 4, teamId: 1, code: "ARS" }),
    player({ id: 2, goals: 9, minutes: 2400, points: 120, pos: 3, teamId: 2, code: "AVL", name: "Watkins" }),
    player({ id: 3, goals: 20, minutes: 120, points: 30, pos: 4, teamId: 3, code: "BOU" }),
  ];

  it("keeps a cameo off the board with the minutes floor", () => {
    const board = rankBoard(pool, { minMinutes: 900, score: (p) => p.goals, limit: 10 });
    expect(board.rows.map((r) => r.id)).toEqual([1, 2]);
    expect(board.eligible).toBe(2);
  });

  it("sorts ascending when fewest is the achievement", () => {
    const board = rankBoard(pool, { minMinutes: 0, score: (p) => p.goals, ascending: true, limit: 3 });
    expect(board.rows[0].goals).toBe(9);
  });

  it("filters by position, club and search", () => {
    expect(rankBoard(pool, { minMinutes: 0, score: (p) => p.goals, limit: 10, pos: 3 }).rows).toHaveLength(1);
    expect(rankBoard(pool, { minMinutes: 0, score: (p) => p.goals, limit: 10, teamId: 3 }).rows).toHaveLength(1);
    expect(rankBoard(pool, { minMinutes: 0, score: (p) => p.goals, limit: 10, search: "watk" }).rows).toHaveLength(1);
    expect(rankBoard(pool, { minMinutes: 0, score: (p) => p.goals, limit: 10, search: "BOU" }).rows).toHaveLength(1);
  });

  it("breaks ties on season points", () => {
    const tied = [player({ id: 4, goals: 5, points: 80 }), player({ id: 5, goals: 5, points: 110 })];
    expect(rankBoard(tied, { minMinutes: 0, score: (p) => p.goals, limit: 2 }).rows[0].id).toBe(5);
  });
});

describe("meetsMinutes", () => {
  it("is inclusive at the floor", () => {
    expect(meetsMinutes(player({ id: 26, minutes: 900 }), 900)).toBe(true);
    expect(meetsMinutes(player({ id: 27, minutes: 899 }), 900)).toBe(false);
  });
});

describe("defaultMinutesFloor", () => {
  it("scales to how much football has been played", () => {
    const august = [{ minutes: 90 }, { minutes: 60 }];
    const march = [{ minutes: 2600 }, { minutes: 1800 }];
    expect(defaultMinutesFloor(august)).toBeLessThan(defaultMinutesFloor(march));
  });

  it("never drops below half a match once anyone has played", () => {
    // Two contributions in fourteen minutes rates at 12.9 per 90 — a floor of
    // zero would put that at the top of every rate board.
    expect(defaultMinutesFloor([{ minutes: 90 }])).toBe(45);
    expect(defaultMinutesFloor([{ minutes: 14 }])).toBe(45);
  });

  it("stays at zero before a ball is kicked", () => {
    expect(defaultMinutesFloor([{ minutes: 0 }, { minutes: 0 }])).toBe(0);
    expect(defaultMinutesFloor([])).toBe(0);
  });

  it("caps so a long season does not exclude squad players", () => {
    expect(defaultMinutesFloor([{ minutes: 3400 }])).toBe(450);
    expect(defaultMinutesFloor([{ minutes: 3400 }], 900)).toBe(900);
  });
});
