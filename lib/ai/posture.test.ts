import { describe, expect, it } from "vitest";
import { POSTURES, applyPosture, fixtureEaseOf, postureScore, type PosturePlayer } from "./posture";

function player(over: Partial<PosturePlayer> & { id: number }): PosturePlayer {
  return {
    name: `P${over.id}`,
    pos: 3,
    team: 1,
    code: "AAA",
    cost: 50,
    photo: "",
    form: 3,
    ppg: 3,
    points: 30,
    owned: 5,
    minutes: 900,
    status: "a",
    news: "",
    horizon: [2, 2, 2, 2, 2, 2],
    costChangeEvent: 0,
    costChangeStart: 0,
    netTransfers: 0,
    fixtureEase: 0.5,
    ...over,
  };
}

describe("POSTURES — the numeric half of the four gaffers", () => {
  it("carries one posture per persona, each with its own weighting", () => {
    expect(Object.keys(POSTURES).sort()).toEqual(["ana", "kofi", "mei", "oleg"]);
    // No two personas share a full weighting — otherwise two gaffers would
    // be one gaffer with two voices.
    const sig = (p: (typeof POSTURES)[keyof typeof POSTURES]) =>
      [p.gain, p.fixture, p.form, p.minutes, p.differential, p.momentum, p.value].join(",");
    expect(new Set(Object.values(POSTURES).map(sig)).size).toBe(4);
  });

  it("weights sit in the 0..1 band the score normalises to", () => {
    for (const p of Object.values(POSTURES)) {
      for (const w of [p.gain, p.fixture, p.form, p.minutes, p.differential, p.momentum, p.value]) {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      }
      expect(p.reason.length).toBeGreaterThan(20);
    }
  });

  it("each persona's dominant weight matches what its reason names", () => {
    expect(POSTURES.ana.fixture).toBe(1);
    expect(POSTURES.ana.reason).toMatch(/fixture/i);
    expect(POSTURES.kofi.differential).toBeGreaterThanOrEqual(0.8);
    expect(POSTURES.kofi.reason).toMatch(/differential/i);
    expect(POSTURES.mei.value).toBeGreaterThanOrEqual(0.9);
    expect(POSTURES.mei.reason).toMatch(/value/i);
    expect(POSTURES.oleg.differential).toBe(0);
    expect(POSTURES.oleg.reason).toMatch(/template/i);
  });
});

describe("postureScore — the same facts ranked differently", () => {
  // The template pick: high ownership, proven minutes, mild form.
  const template = player({ id: 10, owned: 45, minutes: 1400, form: 4, fixtureEase: 0.6, points: 60, cost: 90 });
  // The differential: low ownership, hot form, few minutes.
  const differential = player({ id: 11, owned: 3, minutes: 500, form: 6, fixtureEase: 0.5, points: 25, cost: 45 });
  // The value pick: cheap, proven minutes, clearly the best output per £m.
  const value = player({ id: 12, owned: 12, minutes: 1300, form: 3, fixtureEase: 0.5, points: 70, cost: 45 });

  it("the tactician prefers the template, the maverick the differential", () => {
    const swap = { outPoints: 5, inPoints: 9 };
    const oleg = postureScore(swap, template, POSTURES.oleg);
    const olegDiff = postureScore(swap, differential, POSTURES.oleg);
    const kofi = postureScore(swap, differential, POSTURES.kofi);
    const kofiTpl = postureScore(swap, template, POSTURES.kofi);
    // Oleg's comfort: template ≥ differential. Kofi's: differential beats template.
    expect(oleg - olegDiff).toBeGreaterThan(0);
    expect(kofi - kofiTpl).toBeGreaterThan(0);
  });

  it("the scout prefers value with proven minutes, and rejects unproven minutes", () => {
    const swap = { outPoints: 5, inPoints: 9 };
    const meiValue = postureScore(swap, value, POSTURES.mei);
    const meiDiff = postureScore(swap, differential, POSTURES.mei);
    expect(meiValue - meiDiff).toBeGreaterThan(0);
    // A punt with no minutes loses the scout entirely — minutes certainty
    // outweighs the projection for Mei.
    const unproven = player({ id: 13, minutes: 60, owned: 3, form: 6, fixtureEase: 0.6, points: 25 });
    expect(postureScore(swap, value, POSTURES.mei)).toBeGreaterThan(postureScore(swap, unproven, POSTURES.mei));
  });

  it("the fixture specialist rewards momentum and ease over form", () => {
    // Ease and a price tick against cold form — Ana's exact bet.
    const rising = player({ id: 14, costChangeEvent: 2, fixtureEase: 0.95, form: 2, minutes: 700 });
    // Hot form against a brutal run and a falling price.
    const falling = player({ id: 15, costChangeEvent: -2, fixtureEase: 0.15, form: 6, minutes: 700 });
    const swap = { outPoints: 5, inPoints: 8 };
    expect(postureScore(swap, rising, POSTURES.ana)).toBeGreaterThan(postureScore(swap, falling, POSTURES.ana));

    // The same two players, the scout reads the other way: proven minutes
    // and output beat a fixture swing for Mei.
    const proven = player({ id: 16, costChangeEvent: -2, fixtureEase: 0.3, form: 6, minutes: 1400, owned: 45, points: 70, cost: 90 });
    expect(postureScore(swap, rising, POSTURES.ana)).toBeGreaterThan(postureScore(swap, proven, POSTURES.ana));
    expect(postureScore(swap, proven, POSTURES.mei)).toBeGreaterThan(postureScore(swap, rising, POSTURES.mei));
  });
});

describe("applyPosture — the desk's legality, the persona's ranking", () => {
  const rows = [
    { outId: 1, inId: 10, outPoints: 5, inPoints: 9, gain: 4 },
    { outId: 2, inId: 11, outPoints: 5, inPoints: 9, gain: 4 },
    { outId: 3, inId: 12, outPoints: 5, inPoints: 9, gain: 4 },
  ];
  const incomingOf = (id: number) => {
    if (id === 10) return player({ id: 10, owned: 45, minutes: 1400, form: 4, fixtureEase: 0.6, points: 60, cost: 90 });
    if (id === 11) return player({ id: 11, owned: 3, minutes: 500, form: 6, fixtureEase: 0.5, points: 25, cost: 45 });
    // The scout's pick: the clearest points-per-£m of the three, with the
    // minutes to trust it.
    return player({ id: 12, owned: 12, minutes: 1300, form: 3, fixtureEase: 0.5, points: 70, cost: 45 });
  };

  it("at least two personas return a different top recommendation", () => {
    const oleg = applyPosture(rows, incomingOf, POSTURES.oleg)[0];
    const kofi = applyPosture(rows, incomingOf, POSTURES.kofi)[0];
    const mei = applyPosture(rows, incomingOf, POSTURES.mei)[0];
    const tops = new Set([oleg.inId, kofi.inId, mei.inId]);
    expect(tops.size).toBeGreaterThanOrEqual(2);
    expect(oleg.inId).toBe(10); // template
    expect(kofi.inId).toBe(11); // differential
    expect(mei.inId).toBe(12); // value
  });

  it("every returned row is the desk's row — posture re-ranks, never invents", () => {
    const ranked = applyPosture(rows, incomingOf, POSTURES.kofi);
    for (const r of ranked) {
      expect(rows.some((orig) => orig.outId === r.outId && orig.inId === r.inId)).toBe(true);
    }
    expect(ranked).toHaveLength(rows.length);
  });

  it("keeps the desk's order on a full tie", () => {
    const tie = [
      { outId: 5, inId: 20, outPoints: 4, inPoints: 8, gain: 4 },
      { outId: 6, inId: 21, outPoints: 4, inPoints: 8, gain: 4 },
    ];
    const same = (id: number) => player({ id, owned: 10, minutes: 900, form: 3, fixtureEase: 0.5, points: 40, cost: 50 });
    const ranked = applyPosture(tie, same, POSTURES.oleg);
    expect(ranked.map((r) => r.inId)).toEqual([20, 21]);
  });
});

describe("fixtureEaseOf", () => {
  it("scales the projection against the player's own base", () => {
    // A 6-gw horizon of 3s against a base of 3/gw is exactly parity.
    expect(fixtureEaseOf([3, 3, 3, 3, 3, 3], 6, 3)).toBeCloseTo(1);
    // A blank-heavy window scores low, not zero — the player is real.
    expect(fixtureEaseOf([0, 0, 3, 0, 0, 0], 6, 3)).toBeCloseTo(1 / 6);
  });

  it("refuses to speak without a horizon or a base", () => {
    expect(fixtureEaseOf(undefined, 6, 3)).toBe(0);
    expect(fixtureEaseOf([], 6, 3)).toBe(0);
    expect(fixtureEaseOf([3, 3], 6, 0)).toBe(0);
  });
});