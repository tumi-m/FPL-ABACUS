import { describe, expect, it } from "vitest";
import { computeDna, computeSellRegret, computeTransferPnl } from "@/lib/engines/dna";
import type { GwRecord, TransferRow } from "@/lib/engines/dna";

function t(over: Partial<TransferRow>): TransferRow {
  return {
    event: 1,
    elementIn: 101,
    elementOut: 102,
    hitShare: 0,
    inPointsNext5: null,
    outPointsNext5: null,
    outPointsAfterSale: null,
    roseBeforeBuy: null,
    ...over,
  };
}

function gw(over: Partial<GwRecord>): GwRecord {
  return {
    event: 1,
    points: 50,
    overallRank: 100_000,
    benchCost: 0,
    transfersCost: 0,
    chip: null,
    ...over,
  };
}

describe("computeTransferPnl", () => {
  it("nets in-minus-out over the attribution window and ranks rows", () => {
    const good = t({ event: 1, inPointsNext5: 10, outPointsNext5: 2 }); // pnl +8
    const mid = t({ event: 2, inPointsNext5: 4, outPointsNext5: 4 }); // pnl 0
    const bad = t({ event: 3, inPointsNext5: 1, outPointsNext5: 9, hitShare: 4 }); // pnl −12
    const res = computeTransferPnl([good, mid, bad]);

    expect(res.net).toBe(8 + 0 - 12);
    expect(res.hitsPaid).toBe(4);
    expect(res.best[0]).toBe(good);
    expect(res.worst[0]).toBe(bad);
  });

  it("rows with unknown points are excluded from net but still pay hits", () => {
    const scored = t({ inPointsNext5: 6, outPointsNext5: 0 });
    const unscored = t({ event: 3, hitShare: 4 });
    const res = computeTransferPnl([scored, unscored]);

    expect(res.net).toBe(6);
    expect(res.hitsPaid).toBe(4);
    expect(res.best).toHaveLength(1);
  });

  it("recoveredFromHits clamps at zero when net is negative", () => {
    const res = computeTransferPnl([t({ inPointsNext5: 0, outPointsNext5: 10 })]);
    expect(res.net).toBeLessThan(0);
    expect(res.recoveredFromHits).toBe(0);
  });
});

describe("computeSellRegret", () => {
  it("sums post-sale points of sold players, worst first", () => {
    const a = t({ outPointsAfterSale: 15 });
    const b = t({ event: 2, outPointsAfterSale: 5 });
    const ignored = t({ event: 3 });
    const res = computeSellRegret([a, b, ignored]);

    expect(res.points).toBe(20);
    expect(res.worst[0]).toBe(a);
  });
});

describe("computeDna", () => {
  it("classifies risk appetite from average starting-XI EO", () => {
    expect(computeDna(emptyWith({ avgXioEByGw: [60] })).riskAppetite.label).toBe("Template");
    expect(computeDna(emptyWith({ avgXioEByGw: [30] })).riskAppetite.label).toBe("Maverick");
    // nulls are filtered before averaging
    expect(computeDna(emptyWith({ avgXioEByGw: [50, null] })).riskAppetite.label).toBe("Balanced");
  });

  it("excludes bench-boost gameweeks from bench cost", () => {
    const dna = computeDna(
      emptyWith({
        gwRecords: [
          gw({ event: 1, benchCost: 12 }),
          gw({ event: 2, benchCost: 30, chip: "bboost" }),
          gw({ event: 3, benchCost: 4 }),
        ],
      }),
    );
    expect(dna.benchCost.points).toBe(16);
    expect(dna.benchCost.worstGw).toBe(1);
  });

  it("computes consistency spread and percentiles from raw points", () => {
    const dna = computeDna(
      emptyWith({ gwRecords: [gw({ points: 60 }), gw({ points: 40 })] }),
    );
    expect(dna.consistency.sd).toBe(10);
    expect(dna.consistency.floor).toBe(40);
    expect(dna.consistency.ceiling).toBe(60);
  });

  it("aggregates captaincy alpha across gameweeks", () => {
    const dna = computeDna(
      emptyWith({
        captainAlphaByGw: [
          { event: 3, alpha: 7 },
          { event: 5, alpha: -4 },
        ],
      }),
    );
    expect(dna.captaincyAlpha.points).toBe(3);
    expect(dna.captaincyAlpha.bestGw).toBe(3);
    expect(dna.captaincyAlpha.worstGw).toBe(5);
  });

  it("degrades gracefully on empty history", () => {
    const dna = computeDna(emptyWith({}));
    expect(dna.riskAppetite.label).toBe("Balanced");
    expect(dna.riskAppetite.score).toBe(50);
    expect(dna.consistency.sd).toBe(0);
    expect(dna.benchCost.worstGw).toBe(0);
    expect(dna.chipEfficiency.vsAverage).toBe(0);
  });
});

function emptyWith(over: Partial<Parameters<typeof computeDna>[0]>): Parameters<typeof computeDna>[0] {
  return {
    gwRecords: [],
    transfers: [],
    avgXioEByGw: [],
    captainAlphaByGw: [],
    chipAverages: new Map(),
    ...over,
  };
}
