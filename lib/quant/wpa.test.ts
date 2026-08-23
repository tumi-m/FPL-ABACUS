import { describe, expect, it } from "vitest";
import { fitDixonColes } from "@/lib/quant/strength";
import { wpaPaired, type WpaSide } from "@/lib/quant/wpa";
import type { WebPlayer } from "@/lib/quant/correlationWeb";

const FIT = fitDixonColes([
  { homeTeam: 10, awayTeam: 20, gh: 2, ga: 1, ageDays: 7 },
  { homeTeam: 10, awayTeam: 30, gh: 1, ga: 1, ageDays: 14 },
  { homeTeam: 20, awayTeam: 10, gh: 0, ga: 2, ageDays: 21 },
  { homeTeam: 20, awayTeam: 30, gh: 1, ga: 0, ageDays: 28 },
]);

function striker(elementId: number, teamId: number, goalShare: number): WebPlayer {
  return {
    elementId,
    teamId,
    pos: 4,
    goalShare,
    assistShare: goalShare * 0.5,
    minutesProb: 0.95,
    defconRate: 0.05,
  };
}

function side(players: WebPlayer[], fixtures: WpaSide["fixtures"], captain?: number): WpaSide {
  const multipliers = new Map<number, number>();
  if (captain != null) multipliers.set(captain, 2);
  return { players, fixtures, multipliers };
}

const OPTS = { M: 3000, seed: 42 };

describe("wpaPaired — paired simulations", () => {
  it("is deterministic per seed", () => {
    const you = side([striker(1, 10, 0.4)], [{ elementId: 1, homeTeam: 10, awayTeam: 20, isHome: true }], 1);
    const them = side([striker(2, 30, 0.4)], [{ elementId: 2, homeTeam: 30, awayTeam: 40, isHome: true }], 2);
    const a = wpaPaired(you, them, FIT, OPTS);
    const b = wpaPaired(you, them, FIT, OPTS);
    expect(a).toEqual(b);
  });

  it("splits near 50/50 for symmetric XIs in independent fixtures", () => {
    // both sides field the same team profile (10 at home, 20 away) against
    // equally unknown opponents — independent fixture keys, equal strengths
    const you = side(
      [striker(1, 10, 0.4), striker(2, 20, 0.35)],
      [
        { elementId: 1, homeTeam: 10, awayTeam: 50, isHome: true },
        { elementId: 2, homeTeam: 60, awayTeam: 20, isHome: false },
      ],
    );
    const them = side(
      [striker(3, 10, 0.4), striker(4, 20, 0.35)],
      [
        { elementId: 3, homeTeam: 10, awayTeam: 70, isHome: true },
        { elementId: 4, homeTeam: 80, awayTeam: 20, isHome: false },
      ],
    );
    const r = wpaPaired(you, them, FIT, OPTS)!;
    expect(r.winProb).toBeGreaterThan(0.4);
    expect(r.winProb).toBeLessThan(0.6);
    expect(r.winProb + r.drawProb + r.lossProb).toBeCloseTo(1, 4);
  });

  it("gives the stacked side a dominant win probability", () => {
    const you = side(
      [striker(1, 10, 0.5), striker(2, 10, 0.4)],
      [
        { elementId: 1, homeTeam: 10, awayTeam: 50, isHome: true },
        { elementId: 2, homeTeam: 10, awayTeam: 50, isHome: true },
      ],
    );
    const them = side([striker(3, 60, 0.08)], [{ elementId: 3, homeTeam: 60, awayTeam: 90, isHome: true }]);
    const r = wpaPaired(you, them, FIT, OPTS)!;
    expect(r.winProb).toBeGreaterThan(0.65);
    expect(r.expectedPoints.you).toBeGreaterThan(r.expectedPoints.them);
  });

  it("marks your best player positive and their best player negative", () => {
    const you = side(
      [striker(1, 10, 0.5), striker(2, 10, 0.2)],
      [
        { elementId: 1, homeTeam: 10, awayTeam: 50, isHome: true },
        { elementId: 2, homeTeam: 10, awayTeam: 50, isHome: true },
      ],
    );
    const them = side(
      [striker(3, 20, 0.5), striker(4, 20, 0.2)],
      [
        { elementId: 3, homeTeam: 20, awayTeam: 60, isHome: true },
        { elementId: 4, homeTeam: 20, awayTeam: 60, isHome: true },
      ],
    );
    const r = wpaPaired(you, them, FIT, { M: 4000, seed: 7 })!;
    const yours = r.moments.filter((m) => m.side === "you");
    const theirs = r.moments.filter((m) => m.side === "them");
    expect(yours.some((m) => m.elementId === 1 && m.wpa > 0)).toBe(true);
    expect(theirs.some((m) => m.elementId === 3 && m.wpa < 0)).toBe(true);
  });

  it("shared fixtures stay paired — the same draw feeds both sides", () => {
    // you and the rival hold the SAME striker: whoever captains him wins together,
    // so the LOO swing for that shared asset is small for both sides
    const shared = striker(9, 10, 0.45);
    const you = side([shared, striker(2, 20, 0.25)], [
      { elementId: 9, homeTeam: 10, awayTeam: 50, isHome: true },
      { elementId: 2, homeTeam: 20, awayTeam: 60, isHome: true },
    ]);
    const them = side([shared, striker(4, 30, 0.25)], [
      { elementId: 9, homeTeam: 10, awayTeam: 50, isHome: true },
      { elementId: 4, homeTeam: 30, awayTeam: 70, isHome: true },
    ]);
    const r = wpaPaired(you, them, FIT, OPTS)!;
    expect(r.winProb).toBeGreaterThan(0.3);
    expect(r.winProb).toBeLessThan(0.7);
    expect(r.moments.length).toBeGreaterThan(0);
  });

  it("returns null when either side is empty", () => {
    const you = side([striker(1, 10, 0.4)], [{ elementId: 1, homeTeam: 10, awayTeam: 20, isHome: true }]);
    expect(wpaPaired(you, side([], []), FIT, OPTS)).toBeNull();
    expect(wpaPaired(side([], []), you, FIT, OPTS)).toBeNull();
  });
});
