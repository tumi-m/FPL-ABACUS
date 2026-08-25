import { describe, expect, it } from "vitest";
import type { Fixture } from "@/lib/fpl/schemas";
import { buildFixtureModel } from "@/lib/engines/fixtureModel";
import {
  buildTicker,
  cleanSheetChance,
  fixtureValue,
  rescore,
  scoreLabel,
  tickerCuts,
  tickerHeat,
  type TickerFixture,
} from "@/lib/engines/fixtureTicker";

function fx(p: Partial<Fixture> & { team_h: number; team_a: number }): Fixture {
  return { event: 1, finished: true, team_h_score: 1, team_a_score: 0, ...p } as Fixture;
}

/**
 * Four clubs over eight completed rounds, chosen so attack and defence cannot
 * agree:
 *   1 scores freely and concedes nothing (good at both ends)
 *   2 scores nothing and concedes freely (bad at both)
 *   3 is a shootout side — scores a lot, ships a lot
 *   4 is dour — scores nothing, concedes nothing
 * Facing 3 is a fine attacking fixture and a poor defensive one; facing 4 is
 * the reverse. That is the Gabriel-is-not-Watkins case in four clubs.
 */
function history(): Fixture[] {
  const out: Fixture[] = [];
  for (let gw = 1; gw <= 8; gw++) {
    out.push(fx({ event: gw, team_h: 1, team_a: 2, team_h_score: 4, team_a_score: 0 }));
    out.push(fx({ event: gw, team_h: 3, team_a: 4, team_h_score: 3, team_a_score: 3 }));
  }
  return out;
}

/** Upcoming rounds 9–11: a double for club 1 in GW10, a blank for club 2. */
function upcoming(): Fixture[] {
  return [
    fx({ event: 9, team_h: 1, team_a: 2, team_h_score: null, team_a_score: null, finished: false }),
    fx({ event: 9, team_h: 3, team_a: 4, team_h_score: null, team_a_score: null, finished: false }),
    fx({ event: 10, team_h: 1, team_a: 3, team_h_score: null, team_a_score: null, finished: false }),
    fx({ event: 10, team_h: 4, team_a: 1, team_h_score: null, team_a_score: null, finished: false }),
    fx({ event: 11, team_h: 3, team_a: 1, team_h_score: null, team_a_score: null, finished: false }),
    fx({ event: 11, team_h: 4, team_a: 2, team_h_score: null, team_a_score: null, finished: false }),
  ];
}

const model = () => buildFixtureModel(history(), { upToGw: 8 });
const all = () => [...history(), ...upcoming()];
const GWS = [9, 10, 11];
const TEAMS = [1, 2, 3, 4];

describe("cleanSheetChance", () => {
  it("is a probability that falls as the concession rate rises", () => {
    expect(cleanSheetChance(0)).toBe(1);
    expect(cleanSheetChance(1)).toBeCloseTo(Math.exp(-1), 6);
    expect(cleanSheetChance(3)).toBeLessThan(cleanSheetChance(1));
    expect(cleanSheetChance(3)).toBeGreaterThan(0);
  });

  it("treats a nonsense rate as a shutout rather than returning NaN", () => {
    expect(cleanSheetChance(Number.NaN)).toBe(1);
    expect(cleanSheetChance(-2)).toBe(1);
  });
});

describe("fixtureValue", () => {
  const f: TickerFixture = {
    opponentId: 2,
    home: true,
    xgFor: 2.4,
    xgAgainst: 0.4,
    cleanSheet: cleanSheetChance(0.4),
  };

  it("counts goals for attack and shutout chance for defence", () => {
    expect(fixtureValue(f, "attack")).toBe(2.4);
    expect(fixtureValue(f, "defence")).toBeCloseTo(Math.exp(-0.4), 6);
  });
});

describe("buildTicker", () => {
  it("grids every club against every gameweek", () => {
    const rows = buildTicker({ model: model(), fixtures: all(), teamIds: TEAMS, gws: GWS }, "attack");
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.cells.map((c) => c.gw)).toEqual(GWS);
  });

  it("marks a double and a blank, and scores the blank as nothing", () => {
    const rows = buildTicker({ model: model(), fixtures: all(), teamIds: TEAMS, gws: GWS }, "attack");
    const one = rows.find((r) => r.teamId === 1)!;
    const two = rows.find((r) => r.teamId === 2)!;

    // club 1 plays twice in GW10
    const dgw = one.cells.find((c) => c.gw === 10)!;
    expect(dgw.kind).toBe("double");
    expect(dgw.fixtures).toHaveLength(2);

    // club 2 has no GW10 fixture
    const bgw = two.cells.find((c) => c.gw === 10)!;
    expect(bgw.kind).toBe("blank");
    expect(bgw.value).toBe(0);
  });

  it("sums a double rather than averaging it — two matches beat one", () => {
    const rows = buildTicker({ model: model(), fixtures: all(), teamIds: TEAMS, gws: GWS }, "attack");
    const one = rows.find((r) => r.teamId === 1)!;
    const dgw = one.cells.find((c) => c.gw === 10)!;
    const singles = dgw.fixtures.map((f) => f.xgFor);
    expect(dgw.value).toBeCloseTo(singles[0] + singles[1], 6);
    expect(dgw.value).toBeGreaterThan(Math.max(...singles));
  });

  it("ranks the free-scoring side top for attack", () => {
    const rows = buildTicker({ model: model(), fixtures: all(), teamIds: TEAMS, gws: GWS }, "attack");
    expect(rows.find((r) => r.teamId === 1)!.rank).toBe(1);
    expect(rows.find((r) => r.teamId === 2)!.rank).toBe(4);
  });

  it("scores one club's two fixtures in opposite orders — Gabriel is not Watkins", () => {
    // A shootout pair (10, 11) both score and concede four; a dour pair
    // (12, 13) neither score nor concede. Club 20 is the neutral middle and
    // meets one of each.
    const hist: Fixture[] = [];
    for (let gw = 1; gw <= 8; gw++) {
      hist.push(fx({ event: gw, team_h: 10, team_a: 11, team_h_score: 4, team_a_score: 4 }));
      hist.push(fx({ event: gw, team_h: 12, team_a: 13, team_h_score: 0, team_a_score: 0 }));
      hist.push(fx({ event: gw, team_h: 20, team_a: 21, team_h_score: 1, team_a_score: 1 }));
    }
    const next: Fixture[] = [
      fx({ event: 9, team_h: 20, team_a: 10, team_h_score: null, team_a_score: null, finished: false }),
      fx({ event: 10, team_h: 20, team_a: 12, team_h_score: null, team_a_score: null, finished: false }),
    ];
    const m = buildFixtureModel(hist, { upToGw: 8 });

    const atk = buildTicker(
      { model: m, fixtures: [...hist, ...next], teamIds: [20], gws: [9, 10] },
      "attack",
    )[0];
    const def = buildTicker(
      { model: m, fixtures: [...hist, ...next], teamIds: [20], gws: [9, 10] },
      "defence",
    )[0];

    // Facing the leaky shootout side is the better attacking fixture...
    expect(atk.cells[0].value).toBeGreaterThan(atk.cells[1].value);
    // ...and the worse one for a clean sheet. Same two fixtures, opposite order.
    expect(def.cells[0].value).toBeLessThan(def.cells[1].value);
  });

  it("gives every club a distinct rank from 1 to n", () => {
    const rows = buildTicker({ model: model(), fixtures: all(), teamIds: TEAMS, gws: GWS }, "attack");
    expect([...rows.map((r) => r.rank)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });
});

describe("tickerCuts and tickerHeat", () => {
  it("keeps blanks out of the ramp so they cannot drag the cut points", () => {
    const rows = buildTicker({ model: model(), fixtures: all(), teamIds: TEAMS, gws: GWS }, "attack");
    const cuts = tickerCuts(rows);
    expect(cuts).toHaveLength(5);
    expect(cuts.every((c) => c > 0)).toBe(true);

    const blank = rows.find((r) => r.teamId === 2)!.cells.find((c) => c.gw === 10)!;
    expect(tickerHeat(blank, cuts)).toBe(0);
  });

  it("puts a played cell somewhere on the 1..6 ramp", () => {
    const rows = buildTicker({ model: model(), fixtures: all(), teamIds: TEAMS, gws: GWS }, "attack");
    const cuts = tickerCuts(rows);
    for (const cell of rows.flatMap((r) => r.cells).filter((c) => c.kind !== "blank")) {
      const h = tickerHeat(cell, cuts);
      expect(h).toBeGreaterThanOrEqual(1);
      expect(h).toBeLessThanOrEqual(6);
    }
  });

  it("returns no cuts when there is nothing to grid", () => {
    expect(tickerCuts([])).toEqual([]);
  });
});

describe("rescore", () => {
  it("narrows the range and re-ranks without touching the projections", () => {
    const rows = buildTicker({ model: model(), fixtures: all(), teamIds: TEAMS, gws: GWS }, "attack");
    const narrowed = rescore(rows, "attack", [9, 10]);
    for (const r of narrowed) expect(r.cells.map((c) => c.gw)).toEqual([9, 10]);
    const one = narrowed.find((r) => r.teamId === 1)!;
    const full = rows.find((r) => r.teamId === 1)!;
    expect(one.score).toBeLessThan(full.score);
  });

  it("switches side from the same grid and agrees with a fresh build", () => {
    const built = buildTicker({ model: model(), fixtures: all(), teamIds: TEAMS, gws: GWS }, "attack");
    const flipped = rescore(built, "defence", GWS);
    const fresh = buildTicker({ model: model(), fixtures: all(), teamIds: TEAMS, gws: GWS }, "defence");
    for (const r of flipped) {
      const f = fresh.find((x) => x.teamId === r.teamId)!;
      expect(r.score).toBeCloseTo(f.score, 9);
      expect(r.rank).toBe(f.rank);
    }
  });
});

describe("scoreLabel", () => {
  it("names the unit so the number means something", () => {
    expect(scoreLabel(2.94, "attack")).toBe("2.9 goals");
    expect(scoreLabel(1.42, "defence")).toBe("1.4 clean sheets");
    expect(scoreLabel(1.0, "defence")).toBe("1.0 clean sheet");
  });
});
