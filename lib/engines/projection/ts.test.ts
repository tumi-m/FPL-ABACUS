import { describe, expect, it } from "vitest";
import { shrink, projectPlayer } from "@/lib/engines/projection/ts";
import { TsProjectionEngine } from "@/lib/engines/projection";
import type { ProjectionInput } from "@/lib/engines/projection/ts";

const scoring = { goals: { 1: 10, 2: 6, 3: 5, 4: 4 }, cleanSheet: { 1: 4, 2: 4, 3: 1, 4: 0 }, assist: 3 };

function input(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  return {
    elementId: 1,
    pos: 4,
    status: "a",
    chanceOfPlaying: null,
    startRate: 0.9,
    avgMinutesStarted: 75,
    xg: 2.1,
    xa: 1.4,
    minutesPlayed: 450,
    teamAttackHome: 130,
    teamAttackAway: 120,
    oppDefenceHome: 125,
    oppDefenceStrength: 115,
    isHome: true,
    leagueAvgAttack: 125,
    leagueAvgDefence: 125,
    teamXgcPerMatch: 1.2,
    matchesPlayed: 5,
    defconHitRate: 0.2,
    ...overrides,
  };
}

describe("projection", () => {
  it("shrinkage pulls small samples toward the prior", () => {
    const shrunk = shrink(0.0, 10, 0.15, 180);
    expect(shrunk).toBeCloseTo((10 * 0 + 180 * 0.15) / 190, 6);
    const none = shrink(0.3, 0, 0.15);
    expect(none).toBe(0.15);
  });

  it("injured players project zero appearance probability", () => {
    const p = projectPlayer({ input: input({ status: "i" }) }, scoring);
    expect(p.pAppear).toBe(0);
    expect(p.xP).toBeLessThan(0.5);
  });

  it("xP for a healthy starter is sane (0–12)", () => {
    const p = projectPlayer({ input: input() }, scoring);
    expect(p.xP).toBeGreaterThan(0);
    expect(p.xP).toBeLessThan(12);
    expect(p.breakdown.goals).toBeGreaterThan(0);
  });

  it("TsProjectionEngine passes through the gw", async () => {
    const engine = new TsProjectionEngine();
    const p = await engine.playerGw({ input: input() }, 3, scoring);
    expect(p.gw).toBe(3);
  });
});
