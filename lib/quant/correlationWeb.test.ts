import { describe, expect, it } from "vitest";
import { fitDixonColes } from "@/lib/quant/strength";
import { drawScore, marginalRisk, simulateWeb, type WebPlayer } from "@/lib/quant/correlationWeb";
import { mulberry32 } from "@/lib/engines/simulate";

const FIT = fitDixonColes([
  { homeTeam: 10, awayTeam: 20, gh: 2, ga: 1, ageDays: 7 },
  { homeTeam: 10, awayTeam: 30, gh: 1, ga: 1, ageDays: 14 },
  { homeTeam: 20, awayTeam: 10, gh: 0, ga: 2, ageDays: 21 },
  { homeTeam: 20, awayTeam: 30, gh: 1, ga: 0, ageDays: 28 },
]);

function player(elementId: number, teamId: number, pos: 1 | 2 | 3 | 4, goalShare = 0.25): WebPlayer {
  return {
    elementId,
    teamId,
    pos,
    goalShare,
    assistShare: goalShare * 0.6,
    minutesProb: 0.95,
    defconRate: pos === 2 ? 0.3 : 0.05,
  };
}

describe("drawScore", () => {
  it("is reproducible under the same rng stream", () => {
    const a = drawScore(FIT, 10, 20, mulberry32(5));
    const b = drawScore(FIT, 10, 20, mulberry32(5));
    expect(a).toEqual(b);
  });

  it("keeps scores in sane ranges", () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 200; i++) {
      const { gh, ga } = drawScore(FIT, 10, 20, rng);
      expect(gh).toBeGreaterThanOrEqual(0);
      expect(ga).toBeLessThan(15);
    }
  });
});

describe("simulateWeb — players are not independent", () => {
  it("correlates same-fixture teammates positively", () => {
    const squad = [
      player(101, 10, 4, 0.35),
      player(102, 10, 3, 0.25),
    ];
    const fixtures = [
      { elementId: 101, homeTeam: 10, awayTeam: 20, isHome: true },
      { elementId: 102, homeTeam: 10, awayTeam: 20, isHome: true },
    ];
    const web = simulateWeb(squad, fixtures, FIT, undefined, { M: 1500, seed: 42 });
    const rho = web.correlation.get("101|102")!;
    expect(rho).toBeGreaterThan(0.05);
  });

  it("gives near-zero correlation across independent fixtures", () => {
    const squad = [player(201, 40, 3), player(202, 50, 3)];
    const fixtures = [
      { elementId: 201, homeTeam: 40, awayTeam: 60, isHome: true },
      { elementId: 202, homeTeam: 50, awayTeam: 70, isHome: true },
    ];
    const web = simulateWeb(squad, fixtures, FIT, undefined, { M: 1500, seed: 7 });
    expect(Math.abs(web.correlation.get("201|202")!)).toBeLessThan(0.12);
  });

  it("counts stacked squads as fewer effective bets than spread ones", () => {
    // stack: four assets all riding one fixture
    const stack = [
      player(301, 10, 4, 0.4),
      player(302, 10, 3, 0.3),
      player(303, 10, 2, 0.08),
      player(304, 10, 1, 0),
    ];
    const stackFx = (id: number) => ({ elementId: id, homeTeam: 10, awayTeam: 20, isHome: true });
    const stacked = simulateWeb(stack, stack.map((p) => stackFx(p.elementId)), FIT, undefined, { M: 1200, seed: 3 });

    // spread: same four players in unrelated fixtures
    const spreadSquad = [
      player(311, 10, 4),
      player(312, 20, 3),
      player(313, 30, 2),
      player(314, 40, 1),
    ];
    const spreadFx = [
      { elementId: 311, homeTeam: 10, awayTeam: 50, isHome: true },
      { elementId: 312, homeTeam: 60, awayTeam: 20, isHome: false },
      { elementId: 313, homeTeam: 70, awayTeam: 30, isHome: false },
      { elementId: 314, homeTeam: 80, awayTeam: 40, isHome: false },
    ];
    const spread = simulateWeb(spreadSquad, spreadFx, FIT, undefined, { M: 1200, seed: 3 });

    expect(stacked.effectiveBets).toBeLessThan(spread.effectiveBets);
    expect(stacked.effectiveBets).toBeGreaterThan(0);
    expect(spread.effectiveBets).toBeLessThanOrEqual(4);
  });

  it("produces finite means and respects determinism", () => {
    const squad = [player(401, 10, 3), player(402, 20, 4)];
    const fixtures = [
      { elementId: 401, homeTeam: 10, awayTeam: 20, isHome: true },
      { elementId: 402, homeTeam: 20, awayTeam: 10, isHome: false },
    ];
    const a = simulateWeb(squad, fixtures, FIT, undefined, { M: 800, seed: 99 });
    const b = simulateWeb(squad, fixtures, FIT, undefined, { M: 800, seed: 99 });
    expect(a.meanPoints).toEqual(b.meanPoints);
    for (const v of a.meanPoints.values()) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("simulateWeb — variance export (v4 mode 6 feed)", () => {
  it("returns non-negative variance for every player and matches determinism", () => {
    const squad = [player(501, 10, 4, 0.35), player(502, 10, 2, 0.1), player(503, 30, 3)];
    const fixtures = [
      { elementId: 501, homeTeam: 10, awayTeam: 20, isHome: true },
      { elementId: 502, homeTeam: 10, awayTeam: 20, isHome: true },
      { elementId: 503, homeTeam: 30, awayTeam: 40, isHome: false },
    ];
    const a = simulateWeb(squad, fixtures, FIT, undefined, { M: 1500, seed: 12 });
    const b = simulateWeb(squad, fixtures, FIT, undefined, { M: 1500, seed: 12 });
    expect(a.variance).toEqual(b.variance);
    for (const v of a.variance.values()) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("marginalRisk — wᵢ(Σw)ᵢ / w′Σw (v4 mode 6)", () => {
  it("splits exactly equally between independent equal-variance players", () => {
    const squad = [player(601, 10, 3), player(602, 20, 3), player(603, 30, 3)];
    const variance = new Map([
      [601, 4],
      [602, 4],
      [603, 4],
    ]);
    const risk = marginalRisk(squad, new Map(), variance);
    const shares = [...risk.share.values()];
    expect(shares.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
    for (const s of shares) expect(s).toBeCloseTo(1 / 3, 9);
    expect(risk.portfolioSd).toBeCloseTo(Math.sqrt(12), 9);
  });

  it("weights by variance among independents", () => {
    const squad = [player(651, 10, 4), player(652, 20, 2)];
    const variance = new Map([
      [651, 9],
      [652, 1],
    ]);
    const risk = marginalRisk(squad, new Map(), variance);
    expect(risk.share.get(651)!).toBeCloseTo(0.9, 9);
    expect(risk.share.get(652)!).toBeCloseTo(0.1, 9);
  });

  it("correlated pairs carry more marginal risk than their variance alone", () => {
    const squad = [player(661, 10, 4), player(662, 10, 3), player(663, 20, 3)];
    const variance = new Map([
      [661, 4],
      [662, 4],
      [663, 4],
    ]);
    // 661 and 662 perfectly correlated; 663 independent of both
    const correlation = new Map([
      ["661|662", 1],
    ]);
    const risk = marginalRisk(squad, correlation, variance);
    // pair contributes 8 each, singleton 4 → shares 8/20 = .4, .4, .2
    expect(risk.share.get(661)!).toBeCloseTo(0.4, 6);
    expect(risk.share.get(662)!).toBeCloseTo(0.4, 6);
    expect(risk.share.get(663)!).toBeCloseTo(0.2, 6);
    expect(risk.portfolioSd).toBeCloseTo(Math.sqrt(20), 6);
  });

  it("hedges clamp to zero share, never negative", () => {
    const squad = [player(671, 10, 4), player(672, 20, 4)];
    const variance = new Map([
      [671, 4],
      [672, 4],
    ]);
    const correlation = new Map([["671|672", -1]]);
    const risk = marginalRisk(squad, correlation, variance);
    // perfectly offsetting — zero portfolio risk, zero shares
    expect(risk.portfolioSd).toBe(0);
    expect(risk.share.get(671)).toBe(0);
    expect(risk.share.get(672)).toBe(0);
  });

  it("integrates with simulateWeb output — shares sum to one and stay in bounds", () => {
    const squad = [player(681, 10, 4, 0.35), player(682, 10, 2, 0.1), player(683, 30, 3)];
    const fixtures = [
      { elementId: 681, homeTeam: 10, awayTeam: 20, isHome: true },
      { elementId: 682, homeTeam: 10, awayTeam: 20, isHome: true },
      { elementId: 683, homeTeam: 30, awayTeam: 40, isHome: false },
    ];
    const web = simulateWeb(squad, fixtures, FIT, undefined, { M: 2000, seed: 21 });
    const risk = marginalRisk(squad, web.correlation, web.variance);
    const shares = [...risk.share.values()];
    expect(shares.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 5);
    for (const s of shares) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
    expect(risk.portfolioSd).toBeGreaterThan(0);
  });

  it("degrades to all-zero shares when there is nothing to vary", () => {
    const dead = marginalRisk([player(901, 10, 3)], new Map(), new Map([[901, 0]]));
    expect(dead.share.get(901)).toBe(0);
    expect(dead.portfolioSd).toBe(0);
  });
});
