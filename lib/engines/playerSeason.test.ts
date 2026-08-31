import { describe, expect, it } from "vitest";
import { pointsByGameweek, readDefcon, splitPoints, type MatchLine } from "@/lib/engines/playerSeason";
import type { Pos, ScoringConfig } from "@/lib/engines/types";

const SCORING: ScoringConfig = {
  goals: { 1: 10, 2: 6, 3: 5, 4: 4 },
  cleanSheet: { 1: 4, 2: 4, 3: 1, 4: 0 },
  concededPer2: { 1: -1, 2: -1, 3: 0, 4: 0 },
  defconPoints: { 1: 0, 2: 2, 3: 2, 4: 2 },
  assist: 3,
  savesPer3: 1,
  penSave: 5,
  penMiss: -2,
  yellow: -1,
  red: -3,
  ownGoal: -2,
  minutesShort: 1,
  minutesLong: 2,
};

function match(over: Partial<MatchLine> = {}): MatchLine {
  return {
    round: 1,
    minutes: 90,
    total_points: 0,
    goals_scored: 0,
    assists: 0,
    clean_sheets: 0,
    goals_conceded: 0,
    own_goals: 0,
    penalties_saved: 0,
    penalties_missed: 0,
    yellow_cards: 0,
    red_cards: 0,
    saves: 0,
    bonus: 0,
    defensive_contribution: 0,
    ...over,
  };
}

describe("readDefcon", () => {
  it("pays per match cleared, not per contribution", () => {
    // The whole point: nine contributions spread thin score nothing; the same
    // nine concentrated in one match against a threshold of ten still score
    // nothing. Only clearing the line in a match pays.
    const spread = readDefcon([match({ defensive_contribution: 5 }), match({ defensive_contribution: 4 })], 2 as Pos, SCORING);
    expect(spread.total).toBe(9);
    expect(spread.hits).toBe(0);
    expect(spread.points).toBe(0);
  });

  it("counts a match at exactly the threshold", () => {
    const r = readDefcon([match({ defensive_contribution: 10 })], 2 as Pos, SCORING);
    expect(r.hits).toBe(1);
    expect(r.points).toBe(2);
  });

  it("uses the defender line for defenders and the higher one for midfielders", () => {
    const eleven = [match({ defensive_contribution: 11 })];
    expect(readDefcon(eleven, 2 as Pos, SCORING).hits).toBe(1);
    expect(readDefcon(eleven, 3 as Pos, SCORING).hits).toBe(0);
    expect(readDefcon([match({ defensive_contribution: 12 })], 3 as Pos, SCORING).hits).toBe(1);
  });

  it("does not double-count recoveries for a midfielder", () => {
    // FPL's defensive_contribution already includes recoveries where they
    // count. The player page used to add them on top, which cleared the line
    // for midfielders who had not.
    const r = readDefcon([match({ defensive_contribution: 8 })], 3 as Pos, SCORING);
    expect(r.hits).toBe(0);
  });

  it("gives a keeper no defensive lane at all", () => {
    const r = readDefcon([match({ defensive_contribution: 40 })], 1 as Pos, SCORING);
    expect(r.hits).toBe(0);
    expect(r.points).toBe(0);
  });

  it("counts matches played, not rows", () => {
    const r = readDefcon(
      [match({ minutes: 90, defensive_contribution: 10 }), match({ minutes: 0 })],
      2 as Pos,
      SCORING,
    );
    expect(r.played).toBe(1);
    expect(r.best).toBe(10);
  });

  it("is empty-safe", () => {
    const r = readDefcon([], 2 as Pos, SCORING);
    expect(r).toMatchObject({ hits: 0, played: 0, points: 0, total: 0, best: 0 });
  });
});

describe("splitPoints", () => {
  it("reconciles exactly with the real total", () => {
    // A defender: 90 minutes, a goal, a clean sheet, 3 bonus, over the line.
    // 2 + 6 + 4 + 3 + 2 = 17
    const m = match({
      minutes: 90,
      goals_scored: 1,
      clean_sheets: 1,
      bonus: 3,
      defensive_contribution: 10,
      total_points: 17,
    });
    const s = splitPoints([m], 2 as Pos, SCORING);
    expect(s.total).toBe(17);
    expect(s.sources.reduce((a, b) => a + b.points, 0)).toBe(17);
    expect(s.sources.find((x) => x.key === "other")).toBeUndefined();
    expect(s.sources.find((x) => x.key === "defcon")?.points).toBe(2);
  });

  it("shows anything it cannot account for rather than losing it", () => {
    // If FPL adds a lane we do not model, the chart must still add up.
    const s = splitPoints([match({ minutes: 90, total_points: 9 })], 3 as Pos, SCORING);
    expect(s.sources.reduce((a, b) => a + b.points, 0)).toBe(9);
    expect(s.sources.find((x) => x.key === "other")?.points).toBe(7);
  });

  it("scores saves per three within a match, not across the season", () => {
    // Two saves in each of two games is nothing, not one point.
    const two = [match({ saves: 2 }), match({ saves: 2 })];
    const s = splitPoints(two, 1 as Pos, SCORING);
    expect(s.sources.find((x) => x.key === "saves")).toBeUndefined();
    const three = splitPoints([match({ saves: 3 })], 1 as Pos, SCORING);
    expect(three.sources.find((x) => x.key === "saves")?.points).toBe(1);
  });

  it("scores goals conceded per two within a match too", () => {
    const s = splitPoints([match({ goals_conceded: 1 }), match({ goals_conceded: 1 })], 2 as Pos, SCORING);
    expect(s.sources.find((x) => x.key === "conceded")).toBeUndefined();
    const both = splitPoints([match({ goals_conceded: 2 })], 2 as Pos, SCORING);
    expect(both.sources.find((x) => x.key === "conceded")?.points).toBe(-1);
  });

  it("gives an unused appearance nothing", () => {
    const s = splitPoints([match({ minutes: 0, total_points: 0 })], 3 as Pos, SCORING);
    expect(s.sources).toEqual([]);
    expect(s.total).toBe(0);
  });

  it("separates a short appearance from a full one", () => {
    expect(splitPoints([match({ minutes: 45, total_points: 1 })], 3 as Pos, SCORING)
      .sources.find((x) => x.key === "appearance")?.points).toBe(1);
    expect(splitPoints([match({ minutes: 60, total_points: 2 })], 3 as Pos, SCORING)
      .sources.find((x) => x.key === "appearance")?.points).toBe(2);
  });

  it("drops rows that scored nothing rather than charting zeroes", () => {
    const s = splitPoints([match({ minutes: 90, total_points: 2 })], 3 as Pos, SCORING);
    expect(s.sources.map((x) => x.key)).toEqual(["appearance"]);
  });
});

describe("pointsByGameweek", () => {
  it("orders by gameweek whatever order it arrives in", () => {
    const s = pointsByGameweek([match({ round: 3, total_points: 5 }), match({ round: 1, total_points: 2 })]);
    expect(s.map((x) => x.gw)).toEqual([1, 3]);
    expect(s.map((x) => x.points)).toEqual([2, 5]);
  });
});
