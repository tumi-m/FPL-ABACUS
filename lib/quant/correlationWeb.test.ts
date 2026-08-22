import { describe, expect, it } from "vitest";
import { fitDixonColes } from "@/lib/quant/strength";
import { drawScore, simulateWeb, type WebPlayer } from "@/lib/quant/correlationWeb";
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
