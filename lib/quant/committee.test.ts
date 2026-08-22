import { describe, expect, it } from "vitest";
import { evaluateCompetition, type Competition, type GwRecord } from "@/lib/quant/committee";

function rec(partial: Partial<GwRecord> & { gw: number }): GwRecord {
  return {
    points: 50,
    netPoints: 50,
    benchPoints: 0,
    captainPoints: 20,
    differentialPoints: 0,
    defconPoints: 0,
    overallRank: 500_000,
    rankDelta: null,
    transfers: 1,
    hitsCost: 0,
    chipUsed: null,
    teamValue: 1000,
    ...partial,
  };
}

const entries = [
  {
    entryId: 1,
    seasonTotal: 1200,
    records: [
      rec({ gw: 1, points: 70, netPoints: 66, hitsCost: 4 }),
      rec({ gw: 2, points: 40 }),
      rec({ gw: 3, points: 85, chipUsed: "wildcard" }),
    ],
  },
  {
    entryId: 2,
    seasonTotal: 1150,
    records: [
      rec({ gw: 1, points: 55 }),
      rec({ gw: 2, points: 58 }),
      rec({ gw: 3, points: 60 }),
    ],
  },
];

describe("evaluateCompetition (feature 21)", () => {
  it("ranks by summed metric over a gw window", () => {
    const comp: Competition = {
      id: "c1",
      name: "Three-week grind",
      window: { kind: "gw", from: 1, to: 3 },
      metric: "points",
      agg: "sum",
      order: "desc",
      tieBreak: ["season_total"],
    };
    const standings = evaluateCompetition(comp, entries);
    expect(standings[0].entryId).toBe(1); // 195 vs 173
    expect(standings[1].value).toBe(173);
  });

  it("honours asc metrics like fewest hits", () => {
    const comp: Competition = {
      id: "c2",
      name: "Clean hands",
      window: { kind: "gw", from: 1, to: 3 },
      metric: "hits_cost",
      agg: "sum",
      order: "asc",
      tieBreak: ["season_total"],
    };
    expect(evaluateCompetition(comp, entries)[0].entryId).toBe(2);
  });

  it("filters chip gameweeks only", () => {
    const comp: Competition = {
      id: "c3",
      name: "Wildcard week",
      window: { kind: "season" },
      metric: "points",
      agg: "max",
      order: "desc",
      filters: [{ chipUsed: "wildcard" }],
      tieBreak: ["season_total"],
    };
    const standings = evaluateCompetition(comp, entries);
    expect(standings[0].entryId).toBe(1);
    expect(standings).toHaveLength(1);
    expect(standings[0].value).toBe(85);
  });

  it("splits prize shares across the podium deterministically", () => {
    const comp: Competition = {
      id: "c4",
      name: "Monthly",
      window: { kind: "rolling", last: 2 },
      metric: "net_points",
      agg: "sum",
      order: "desc",
      topN: 2,
      tieBreak: ["fewest_transfers", "overall_rank"],
      prizeShare: 1,
    };
    const standings = evaluateCompetition(comp, entries);
    expect(standings).toHaveLength(2);
    expect(standings[0].prizeShare).toBeCloseTo(0.5);
    expect(standings[1].prizeShare).toBeCloseTo(0.5);
    // ledger only — shares are fractions of a pot the app never holds
    expect(standings.reduce((s, x) => s + (x.prizeShare ?? 0), 0)).toBeCloseTo(1);
  });

  it("breaks ties on season total before entry id", () => {
    const tied = [
      { entryId: 7, seasonTotal: 900, records: [rec({ gw: 1, points: 60 })] },
      { entryId: 3, seasonTotal: 950, records: [rec({ gw: 1, points: 60 })] },
    ];
    const comp: Competition = {
      id: "c5",
      name: "Tied",
      window: { kind: "gw", from: 1, to: 1 },
      metric: "points",
      agg: "max",
      order: "desc",
      tieBreak: ["season_total"],
    };
    expect(evaluateCompetition(comp, tied)[0].entryId).toBe(3);
  });
});
