import { describe, expect, it } from "vitest";
import type { Fixture } from "@/lib/fpl/schemas";
import {
  buildFixtureModel,
  easiness,
  projectFixture,
} from "@/lib/engines/fixtureModel";

function fx(partial: Partial<Fixture> & { team_h: number; team_a: number }): Fixture {
  return {
    event: 1,
    finished: true,
    team_h_score: 1,
    team_a_score: 0,
    ...partial,
  } as Fixture;
}

/** Ten rounds: strong/leaky/blunt/draw sides plus a shootout pair and two blanks. */
function sampleFixtures(): Fixture[] {
  const out: Fixture[] = [];
  for (let gw = 1; gw <= 10; gw++) {
    out.push(fx({ event: gw, team_h: 1, team_a: 100 + gw, team_h_score: 3, team_a_score: 0 }));
    out.push(fx({ event: gw, team_h: 200 + gw, team_a: 2, team_h_score: 3, team_a_score: 0 }));
    out.push(fx({ event: gw, team_h: 300 + gw, team_a: 400 + gw, team_h_score: 1, team_a_score: 1 }));
    // 50/51 shoot themselves into form: free-scoring AND leaky
    out.push(fx({ event: gw, team_h: 50, team_a: 51, team_h_score: 4, team_a_score: 3 }));
    // 70/71 grind out blanks: blunt AND tight
    out.push(fx({ event: gw, team_h: 70, team_a: 71, team_h_score: 0, team_a_score: 0 }));
  }
  return out;
}

describe("buildFixtureModel", () => {
  it("ranks a high-scoring team above a leaky one on attack", () => {
    const model = buildFixtureModel(sampleFixtures(), { upToGw: 10 });
    const strong = model.teams.get(1)!;
    const weak = model.teams.get(2)!;
    expect(strong.sample).toBe(10);
    expect(strong.attack90).toBeGreaterThan(weak.attack90);
    expect(strong.defence90).toBeLessThan(weak.defence90);
  });

  it("shrinks a tiny sample toward the league mean", () => {
    const full = buildFixtureModel(sampleFixtures(), { upToGw: 10 });
    const one = buildFixtureModel(sampleFixtures(), { upToGw: 1 });
    const fullStrong = full.teams.get(1)!;
    const oneStrong = one.teams.get(1)!;
    // with n=1 and k=6 the shrunk rate sits far closer to the mean
    const distFull = Math.abs(fullStrong.attack90 - full.league.meanAttack90);
    const distOne = Math.abs(oneStrong.attack90 - one.league.meanAttack90);
    expect(distOne).toBeLessThan(distFull);
  });

  it("derives a home factor above its away counterpart", () => {
    const model = buildFixtureModel(sampleFixtures(), { upToGw: 10 });
    expect(model.league.homeFactor).toBeGreaterThan(model.league.awayFactor);
  });

  it("ignores unplayed fixtures", () => {
    const model = buildFixtureModel(
      [...sampleFixtures(), fx({ event: 11, team_h: 1, team_a: 9, team_h_score: null, team_a_score: null })],
      { upToGw: 11 },
    );
    expect(model.teams.get(1)!.sample).toBe(10);
  });
});

describe("projectFixture", () => {
  const model = buildFixtureModel(sampleFixtures(), { upToGw: 10 });

  it("projects more goals against a leaky defence than a tight one", () => {
    const vsWeak = projectFixture(model, 1, 2, false);
    const vsStrong = projectFixture(model, 1, 300, false);
    void vsStrong;
    const vsTight = projectFixture(model, 1, 301, false);
    expect(vsWeak.xgFor).toBeGreaterThan(vsTight.xgFor);
  });

  it("boosts the same pairing at home versus away", () => {
    const home = projectFixture(model, 1, 2, true);
    const away = projectFixture(model, 1, 2, false);
    expect(home.xgFor).toBeGreaterThan(away.xgFor);
    expect(home.xgAgainst).toBeLessThan(away.xgAgainst);
  });

  it("falls back to league means for unseen teams", () => {
    const p = projectFixture(model, 999, 998, true);
    expect(Number.isFinite(p.xgFor)).toBe(true);
    expect(Number.isFinite(p.xgAgainst)).toBe(true);
  });
});

describe("easiness — the Gabriel ≠ Watkins acceptance test", () => {
  it("ranks the same two opponents in opposite order for DEF and FWD", () => {
    const model = buildFixtureModel(sampleFixtures(), { upToGw: 10 });
    // Opponent X (50): free-scoring AND leaky. Opponent Y (70): blunt AND tight.
    const faceX = projectFixture(model, 5, 50, true);
    const faceY = projectFixture(model, 5, 70, true);
    // Forwards prefer the leaky defence; defenders prefer the blunt attack.
    expect(easiness(faceX, 4)).toBeGreaterThan(easiness(faceY, 4));
    expect(easiness(faceY, 2)).toBeGreaterThan(easiness(faceX, 2));
  });

  it("uses −xgAgainst for GK/DEF and +xgFor for MID/FWD", () => {
    const p = { xgFor: 1.4, xgAgainst: 0.9 };
    expect(easiness(p, 1)).toBe(-0.9);
    expect(easiness(p, 2)).toBe(-0.9);
    expect(easiness(p, 3)).toBe(1.4);
    expect(easiness(p, 4)).toBe(1.4);
  });
});

