import { describe, expect, it } from "vitest";
import { effectiveMultipliers, projectAutoSubs } from "@/lib/engines/autosubs";
import type { LivePlayer, Pick, Pos } from "@/lib/engines/types";

const MIN_PLAY: Record<Pos, number> = { 1: 1, 2: 3, 3: 2, 4: 1 };

function player(id: number, pos: Pos, minutes: number, fixturesFinished = true): [number, LivePlayer] {
  return [
    id,
    {
      id,
      pos,
      teamId: 1,
      webName: `p${id}`,
      minutes,
      basePoints: minutes > 0 ? 2 : 0,
      provisionalBonus: 0,
      livePoints: minutes > 0 ? 2 : 0,
      fixtureIds: [1],
      played: minutes > 0,
      fixturesFinished,
      defcon: { count: 0, threshold: 10, hit: false },
      stats: { bps: 0, saves: 0, goalsScored: 0, assists: 0, cleanSheets: 0, conceded: 0, ownGoals: 0, penMissed: 0, cards: 0 },
    },
  ];
}

function pick(element: number, position: number, isCaptain = false, isViceCaptain = false): Pick {
  const multiplier = position <= 11 ? (isCaptain ? 2 : 1) : 0;
  return { element, position, multiplier: multiplier as Pick["multiplier"], isCaptain, isViceCaptain };
}

/** Standard 4-4-2: GK(1) DEF(2-5) MID(6-9) FWD(10-11); bench GK 12, 13,14,15 */
function basePicks() {
  return [
    pick(1, 1),
    pick(2, 2), pick(3, 3), pick(4, 4), pick(5, 5),
    pick(6, 6), pick(7, 7), pick(8, 8), pick(9, 9),
    pick(10, 10), pick(11, 11, true),
    pick(12, 12), pick(13, 13), pick(14, 14), pick(15, 15, false, true),
  ];
}

describe("projectAutoSubs", () => {
  it("subs a blanked outfielder for the first eligible bench player", () => {
    const players = new Map([
      player(1, 1, 90), player(2, 2, 90), player(3, 2, 90), player(4, 2, 90), player(5, 2, 90),
      player(6, 3, 90), player(7, 3, 90), player(8, 3, 0), player(9, 3, 90),
      player(10, 4, 90), player(11, 4, 90),
      player(12, 1, 0), player(13, 3, 67), player(14, 4, 0), player(15, 2, 80),
    ]);
    const r = projectAutoSubs(basePicks(), players, MIN_PLAY, null);
    expect(r.subs).toEqual([{ out: 8, in: 13 }]);
  });

  it("GK only replaces GK", () => {
    const players = new Map([
      player(1, 1, 0), player(2, 2, 90), player(3, 2, 90), player(4, 2, 90), player(5, 2, 90),
      player(6, 3, 90), player(7, 3, 90), player(8, 3, 90), player(9, 3, 90),
      player(10, 4, 90), player(11, 4, 90),
      player(12, 1, 90), player(13, 3, 0), player(14, 4, 0), player(15, 2, 0),
    ]);
    const r = projectAutoSubs(basePicks(), players, MIN_PLAY, null);
    expect(r.subs).toEqual([{ out: 1, in: 12 }]);
  });

  it("respects the formation floor — will not break 3-DEF minimum", () => {
    // Only 3 defenders start; one blanks. Bench has FWD/MID only — every swap
    // would leave 2 defenders, so no legal candidate exists.
    const picks = [
      pick(1, 1),
      pick(2, 2), pick(3, 2), pick(4, 2),
      pick(6, 3), pick(7, 3), pick(8, 3), pick(9, 3),
      pick(10, 4), pick(11, 4, true),
      pick(14, 14), pick(15, 15), pick(16, 16),
    ];
    const players = new Map([
      player(1, 1, 90), player(2, 2, 90), player(3, 2, 90), player(4, 2, 0),
      player(6, 3, 90), player(7, 3, 90), player(8, 3, 90), player(9, 3, 90),
      player(10, 4, 90), player(11, 4, 90),
      player(13, 3, 0), player(14, 4, 90), player(15, 4, 90), player(16, 3, 90),
    ]);
    const r = projectAutoSubs(picks, players, MIN_PLAY, null);
    expect(r.subs).toEqual([]);
  });

  it("Bench Boost disables subs", () => {
    const players = new Map([
      player(1, 1, 0), player(2, 2, 90), player(3, 2, 90), player(4, 2, 90), player(5, 2, 90),
      player(6, 3, 90), player(7, 3, 90), player(8, 3, 90), player(9, 3, 90),
      player(10, 4, 90), player(11, 4, 90),
      player(12, 1, 90), player(13, 3, 90), player(14, 4, 90), player(15, 2, 90),
    ]);
    const r = projectAutoSubs(basePicks(), players, MIN_PLAY, "bboost");
    expect(r.subs).toEqual([]);
  });

  it("moves the armband to the vice when the captain blanks and finished", () => {
    const players = new Map([
      player(1, 1, 90), player(2, 2, 90), player(3, 2, 90), player(4, 2, 90), player(5, 2, 90),
      player(6, 3, 90), player(7, 3, 90), player(8, 3, 90), player(9, 3, 90),
      player(10, 4, 90), player(11, 4, 0),
      player(12, 1, 0), player(13, 3, 90), player(14, 4, 0), player(15, 2, 90),
    ]);
    const r = projectAutoSubs(basePicks(), players, MIN_PLAY, null);
    expect(r.captainId).toBe(15);
  });

  it("does NOT sub a blank whose fixtures have not finished", () => {
    const players = new Map([
      player(1, 1, 90), player(2, 2, 90), player(3, 2, 90), player(4, 2, 90), player(5, 2, 90),
      player(6, 3, 90), player(7, 3, 90), player(8, 3, 0, false), player(9, 3, 90),
      player(10, 4, 90), player(11, 4, 90),
      player(12, 1, 0), player(13, 3, 67), player(14, 4, 0), player(15, 2, 80),
    ]);
    const r = projectAutoSubs(basePicks(), players, MIN_PLAY, null);
    expect(r.subs).toEqual([]);
  });
});

describe("effectiveMultipliers", () => {
  it("promoted vice gets ×2 even under Triple Captain", () => {
    const players = new Map([
      player(1, 1, 90), player(2, 2, 90), player(3, 2, 90), player(4, 2, 90), player(5, 2, 90),
      player(6, 3, 90), player(7, 3, 90), player(8, 3, 90), player(9, 3, 90),
      player(10, 4, 90), player(11, 4, 0),
      player(12, 1, 0), player(13, 3, 90), player(14, 4, 0), player(15, 2, 90),
    ]);
    const subs = projectAutoSubs(basePicks(), players, MIN_PLAY, "3xc");
    const mults = effectiveMultipliers(basePicks(), subs, "3xc");
    expect(mults.get(11)).toBe(0);
    expect(mults.get(15)).toBe(2);
  });

  it("Triple Captain gives ×3 to an playing captain", () => {
    const players = new Map([
      player(1, 1, 90), player(2, 2, 90), player(3, 2, 90), player(4, 2, 90), player(5, 2, 90),
      player(6, 3, 90), player(7, 3, 90), player(8, 3, 90), player(9, 3, 90),
      player(10, 4, 90), player(11, 4, 90),
      player(12, 1, 0), player(13, 3, 90), player(14, 4, 0), player(15, 2, 90),
    ]);
    const subs = projectAutoSubs(basePicks(), players, MIN_PLAY, "3xc");
    const mults = effectiveMultipliers(basePicks(), subs, "3xc");
    expect(mults.get(11)).toBe(3);
  });
});
