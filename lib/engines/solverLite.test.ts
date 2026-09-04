import { describe, expect, it } from "vitest";
import {
  availabilityOf,
  blendBase,
  projectHorizon,
  type HorizonPlayer,
} from "./solverLite";
import { buildFixtureModel, type FixtureModel } from "@/lib/engines/fixtureModel";
import type { Fixture } from "@/lib/fpl/schemas";

const T = (id: number) => `2026-08-${10 + id}T12:00:00Z`;

function league(): Fixture[] {
  const out: Fixture[] = [];
  // six completed GWs: club 1 = strong attack/blunt defence, club 2 = leaky,
  // the rest average. Clubs keep fixed venues inside the window.
  const rate = (club: number): [number, number] =>
    club === 1 ? [4, 2] : club === 2 ? [1, 3] : [1.3, 1.3]; // [scores, concedes]
  for (let gw = 1; gw <= 6; gw++) {
    for (let pair = 0; pair < 5; pair++) {
      const h = pair * 2 + 1;
      const a = pair * 2 + 2;
      const [, hConcedes] = rate(h);
      const [aScores] = rate(a);
      out.push({
        event: gw,
        team_h: h,
        team_a: a,
        team_h_score: Math.round(hConcedes),
        team_a_score: Math.round(aScores),
        started: true,
        finished: true,
        kickoff_time: T(gw),
      } as unknown as Fixture);
    }
  }
  return out;
}

const model: FixtureModel = buildFixtureModel(league(), { upToGw: 6 });

const fx = (map: Record<number, { opponentId: number; wasHome: boolean }>) => (
  _teamId: number,
  gw: number,
) => (map[gw] ? [map[gw]] : []);

const avg: HorizonPlayer = { pos: 3, teamId: 5, base: 4, availability: 1 };

describe("blendBase", () => {
  it("averages ep_next with form", () => {
    expect(blendBase(6, 4)).toBe(5);
  });
  it("falls back to form without ep_next", () => {
    expect(blendBase(null, 3.5)).toBe(3.5);
  });
});

describe("availabilityOf", () => {
  it("available players take their published chance", () => {
    expect(availabilityOf("a", 100)).toBe(1);
    expect(availabilityOf("a", null)).toBe(1);
    expect(availabilityOf("a", 75)).toBe(0.75);
  });
  it("doubtful defaults to three quarters", () => {
    expect(availabilityOf("d", null)).toBe(0.75);
  });
  it("unavailable is zero", () => {
    expect(availabilityOf("i", null)).toBe(0);
  });
});

describe("projectHorizon", () => {
  it("blanks score zero for everyone", () => {
    const gws = [24, 25];
    const map = { 24: { opponentId: 9, wasHome: true } };
    expect(projectHorizon(avg, gws, model, fx(map))).toEqual([expect.any(Number), 0]);
  });

  it("an attacker gains against a leaky defence and loses against a blunt one", () => {
    const gws = [24];
    const soft = projectHorizon(avg, gws, model, fx({ 24: { opponentId: 2, wasHome: true } }));
    const hard = projectHorizon(avg, gws, model, fx({ 24: { opponentId: 1, wasHome: true } }));
    expect(soft[0]).toBeGreaterThan(hard[0]);
  });

  it("the same fixture prices a defender by opposition attack — Gabriel ≠ Watkins", () => {
    const def: HorizonPlayer = { ...avg, pos: 2 };
    const vsStrongAtt = projectHorizon(def, [24], model, fx({ 24: { opponentId: 1, wasHome: true } }));
    const vsWeakAtt = projectHorizon(def, [24], model, fx({ 24: { opponentId: 7, wasHome: true } }));
    expect(vsWeakAtt[0]).toBeGreaterThan(vsStrongAtt[0]);
    // and the midfielder's number moves with the attacker's, not the defender's
    const mid: HorizonPlayer = { ...avg, pos: 3 };
    expect(projectHorizon(mid, [24], model, fx({ 24: { opponentId: 2, wasHome: true } }))[0]).toBeGreaterThan(
      projectHorizon(mid, [24], model, fx({ 24: { opponentId: 1, wasHome: true } }))[0],
    );
  });

  it("a double week stacks both fixtures onto the same base", () => {
    const gws = [24];
    const dbl = projectHorizon(
      avg,
      gws,
      model,
      () => [{ opponentId: 9, wasHome: true }, { opponentId: 8, wasHome: true }],
    );
    const single = projectHorizon(avg, gws, model, () => [{ opponentId: 9, wasHome: true }]);
    expect(dbl[0]).toBeGreaterThan(single[0]);
    expect(dbl[0]).toBeLessThan(single[0] * 2.01); // stacked, not doubled blindly
  });

  it("venue helps at home and availability scales linearly", () => {
    const home = projectHorizon(avg, [24], model, fx({ 24: { opponentId: 9, wasHome: true } }));
    const away = projectHorizon(avg, [24], model, fx({ 24: { opponentId: 9, wasHome: false } }));
    expect(home[0]).toBeGreaterThanOrEqual(away[0]);
    const half: HorizonPlayer = { ...avg, availability: 0.5 };
    expect(projectHorizon(half, [24], model, fx({ 24: { opponentId: 9, wasHome: true } }))[0]).toBeCloseTo(
      home[0] / 2,
      1,
    );
  });
});
