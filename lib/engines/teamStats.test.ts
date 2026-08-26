import { describe, expect, it } from "vitest";
import {
  buildTeamStats,
  overExpected,
  perMatch,
  resultsByTeam,
  spread,
  type StatFixture,
  type StatPlayer,
} from "@/lib/engines/teamStats";

const teams = [
  { id: 1, name: "Arsenal", short_name: "ARS" },
  { id: 2, name: "Chelsea", short_name: "CHE" },
];

const player = (over: Partial<StatPlayer> & { team: number }): StatPlayer => ({
  minutes: 900,
  goals_scored: 0,
  assists: 0,
  xgTotal: 0,
  xaTotal: 0,
  xgiTotal: 0,
  xgcTotal: 0,
  cleanSheets: 0,
  saves: 0,
  defcon: 0,
  tackles: 0,
  recoveries: 0,
  cbi: 0,
  total_points: 0,
  bps: 0,
  bonus: 0,
  yellowCards: 0,
  redCards: 0,
  ownGoals: 0,
  pensSaved: 0,
  pensMissed: 0,
  selected_by_percent: 0,
  transfersInEvent: 0,
  transfersOutEvent: 0,
  costChangeStart: 0,
  now_cost: 50,
  web_name: "Player",
  element_type: 3,
  ...over,
});

const fixture = (over: Partial<StatFixture>): StatFixture => ({
  event: 1,
  finished: true,
  team_h: 1,
  team_a: 2,
  team_h_score: 0,
  team_a_score: 0,
  ...over,
});

describe("buildTeamStats", () => {
  it("sums the figures that belong to individual players", () => {
    const rows = buildTeamStats({
      teams,
      players: [
        player({ team: 1, goals_scored: 3, xgTotal: 2.4, assists: 1, xaTotal: 0.9, bonus: 5 }),
        player({ team: 1, goals_scored: 2, xgTotal: 1.1, assists: 4, xaTotal: 3.2, bonus: 2 }),
      ],
      fixtures: [],
    });
    const ars = rows.find((r) => r.teamId === 1)!;
    expect(ars.goals).toBe(5);
    expect(ars.xg).toBeCloseTo(3.5);
    expect(ars.assists).toBe(5);
    expect(ars.xa).toBeCloseTo(4.1);
    expect(ars.gi).toBe(10);
    expect(ars.bonus).toBe(7);
  });

  it("does NOT sum goals conceded — eleven players is one team's season", () => {
    // Each player carries what the club conceded while he was on. Adding them
    // up would make a side that shipped two look like it shipped twenty-two.
    const rows = buildTeamStats({
      teams,
      players: Array.from({ length: 11 }, () => player({ team: 1, xgcTotal: 1.8 })),
      fixtures: [fixture({ team_h_score: 0, team_a_score: 2 })],
    });
    const ars = rows.find((r) => r.teamId === 1)!;
    expect(ars.conceded).toBe(2);
    expect(ars.xgc).toBeCloseTo(1.8);
  });

  it("takes expected concession from the most-played player", () => {
    const rows = buildTeamStats({
      teams,
      players: [
        player({ team: 1, minutes: 1800, xgcTotal: 22.5 }),
        player({ team: 1, minutes: 200, xgcTotal: 3.1 }),
      ],
      fixtures: [],
    });
    expect(rows.find((r) => r.teamId === 1)!.xgc).toBeCloseTo(22.5);
  });

  it("reads clean sheets as a team event, not a per-player tally", () => {
    const rows = buildTeamStats({
      teams,
      players: [
        player({ team: 1, cleanSheets: 4 }),
        player({ team: 1, cleanSheets: 4 }),
        player({ team: 1, cleanSheets: 1 }), // a squad player who missed three
      ],
      fixtures: [],
    });
    expect(rows.find((r) => r.teamId === 1)!.cleanSheets).toBe(4);
  });

  it("names the club's most-owned player", () => {
    const rows = buildTeamStats({
      teams,
      players: [
        player({ team: 1, web_name: "Saka", selected_by_percent: 42.1 }),
        player({ team: 1, web_name: "Rice", selected_by_percent: 12.0 }),
      ],
      fixtures: [],
    });
    expect(rows.find((r) => r.teamId === 1)!.topOwned).toEqual({ name: "Saka", percent: 42.1 });
  });

  it("counts risers and fallers by their move since the opener", () => {
    const rows = buildTeamStats({
      teams,
      players: [
        player({ team: 1, costChangeStart: 3 }),
        player({ team: 1, costChangeStart: -2 }),
        player({ team: 1, costChangeStart: 0 }),
      ],
      fixtures: [],
    });
    const ars = rows.find((r) => r.teamId === 1)!;
    expect(ars.risers).toBe(1);
    expect(ars.fallers).toBe(1);
  });

  it("returns a row for every club, including one with no players", () => {
    const rows = buildTeamStats({ teams, players: [], fixtures: [] });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.played === 0 && r.goals === 0)).toBe(true);
  });
});

describe("resultsByTeam", () => {
  it("counts both sides of a finished fixture", () => {
    const map = resultsByTeam([fixture({ team_h_score: 3, team_a_score: 1 })]);
    expect(map.get(1)).toEqual({ played: 1, scored: 3, conceded: 1 });
    expect(map.get(2)).toEqual({ played: 1, scored: 1, conceded: 3 });
  });

  it("ignores a fixture the API has not scored yet", () => {
    // finished with a null score is a gap in the feed, not a goalless draw
    const map = resultsByTeam([fixture({ team_h_score: null, team_a_score: null })]);
    expect(map.size).toBe(0);
  });

  it("ignores fixtures that have not finished", () => {
    const map = resultsByTeam([fixture({ finished: false, team_h_score: 1, team_a_score: 0 })]);
    expect(map.size).toBe(0);
  });

  it("stops at the gameweek asked for", () => {
    const map = resultsByTeam(
      [fixture({ event: 1, team_h_score: 1 }), fixture({ event: 5, team_h_score: 2 })],
      3,
    );
    expect(map.get(1)!.played).toBe(1);
  });
});

describe("perMatch", () => {
  it("divides by matches played", () => {
    expect(perMatch(9, 3)).toBe(3);
  });

  it("is zero before a ball is kicked rather than NaN", () => {
    expect(perMatch(0, 0)).toBe(0);
  });
});

describe("overExpected", () => {
  it("is positive when the finishing ran hot", () => {
    expect(overExpected(8, 5.2)).toBeCloseTo(2.8);
  });

  it("is negative when the chances are going begging", () => {
    expect(overExpected(3, 6.5)).toBeCloseTo(-3.5);
  });
});

describe("spread", () => {
  it("takes the largest swing either way", () => {
    expect(spread([1, -9, 4])).toBe(9);
  });

  it("survives an empty column and non-finite values", () => {
    expect(spread([])).toBe(0);
    expect(spread([Number.NaN, Number.POSITIVE_INFINITY, 2])).toBe(2);
  });
});
