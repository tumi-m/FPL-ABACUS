import { describe, expect, it } from "vitest";
import { buildRankCurve, liveRank, rankForTotal, ranksPerPoint, samplePages, totalForRank } from "@/lib/engines/rankModel";

function syntheticCurve(): ReturnType<typeof buildRankCurve> {
  const samples: { rank: number; total: number }[] = [];
  for (let i = 0; i < 120; i++) {
    const total = 80 - i * 0.5;
    const rank = Math.round(Math.pow(10, 2 + (i / 120) * 4));
    samples.push({ rank, total });
  }
  return buildRankCurve(samples);
}

describe("rankModel", () => {
  it("samplePages are unique, sorted, log-spaced-ish", () => {
    const pages = samplePages(9_000_000, 120);
    expect(new Set(pages).size).toBe(pages.length);
    expect(pages[0]).toBe(1);
    for (let i = 1; i < pages.length; i++) expect(pages[i]).toBeGreaterThan(pages[i - 1]);
    expect(pages[pages.length - 1]).toBe(Math.ceil(9_000_000 / 50));
  });

  it("rankForTotal is monotone decreasing in total and clamps at both ends", () => {
    const curve = syntheticCurve();
    const r1 = rankForTotal(curve, 80);
    const r2 = rankForTotal(curve, 60);
    const r3 = rankForTotal(curve, 20);
    expect(r1).toBeLessThanOrEqual(r2);
    expect(r2).toBeLessThanOrEqual(r3);
    expect(rankForTotal(curve, 999)).toBe(curve.points[0].rank);
    expect(rankForTotal(curve, -5)).toBe(curve.points[curve.points.length - 1].rank);
  });

  it("ranksPerPoint > 0 across the range", () => {
    const curve = syntheticCurve();
    for (const t of [79, 65, 50, 35, 21]) {
      expect(ranksPerPoint(curve, t)).toBeGreaterThan(0);
    }
  });

  it("totalForRank inverts rankForTotal within tolerance", () => {
    const curve = syntheticCurve();
    const midRank = curve.points[60].rank;
    const total = totalForRank(curve, midRank);
    const back = rankForTotal(curve, total);
    expect(back).toBeLessThan(midRank * 1.25);
    expect(back).toBeGreaterThan(midRank * 0.8);
  });

  it("liveRank confidence degrades with minutes remaining", () => {
    const curve = syntheticCurve();
    const args = { curve, yourPreTotal: 50, yourLiveGwScore: 30, fieldLiveAverage: 20, fieldLiveSd: 12 };
    expect(liveRank({ ...args, minutesRemainingFraction: 0.05 }).confidence).toBe("high");
    expect(liveRank({ ...args, minutesRemainingFraction: 0.9 }).confidence).toBe("low");
  });
});
