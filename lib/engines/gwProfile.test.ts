import { afterEach, describe, expect, it } from "vitest";
import { bestBenchBoostWeek, profileGameweeks, type GwProfileInput } from "./gwProfile";
import type { Fixture } from "@/lib/fpl/schemas";

const SQUAD_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const CLUB_OF: Record<number, number> = {
  1: 10, 2: 11, 3: 12, 4: 13, 5: 14, // XI ids 1–5
  6: 15, 7: 16, 8: 17, 9: 18, 10: 19, 11: 20, 12: 10, 13: 11, 14: 12, 15: 13, // bench ids 6–15
};

function fixture(over: Partial<Fixture> & { id: number; team_h: number; team_a: number; event: number }): Fixture {
  return {
    code: 0,
    kickoff_time: null,
    started: false,
    finished: false,
    finished_provisional: false,
    minutes: 0,
    provisional_start_time: false,
    team_h_score: null,
    team_a_score: null,
    team_h_difficulty: 3,
    team_a_difficulty: 3,
    stats: [],
    pulse_id: 0,
    ...over,
  };
}

function input(overrides: Partial<GwProfileInput> = {}): GwProfileInput {
  return {
    clubOf: (id) => CLUB_OF[id] ?? null,
    squadIds: SQUAD_IDS,
    fixtures: [],
    gws: [29, 33],
    scheduledUpTo: 38,
    ...overrides,
  };
}

afterEach(() => {});

describe("profileGameweeks", () => {
  it("a known blank produces the right starter count", () => {
    // GW29: only clubs 10 and 11 play. XI ids 1–11 → clubs 10–20, so nine of
    // the XI blank.
    const rows = profileGameweeks(
      input({
        fixtures: [fixture({ id: 1, event: 29, team_h: 10, team_a: 11 })],
      }),
    );
    const gw29 = rows[0];
    expect(gw29.gw).toBe(29);
    expect(gw29.startersPlaying).toBe(2);
    expect(gw29.starterBlanks).toBe(9);
    expect(gw29.starterDoubles).toBe(0);
    // Bench ids 12–15 (clubs 10–13) also play — four squad members in all.
    expect(gw29.squadPlaying).toBe(4);
    expect(gw29.confidence).toBe("scheduled");
  });

  it("a known double stacks — one club playing twice is a double for its owner", () => {
    const rows = profileGameweeks(
      input({
        fixtures: [
          fixture({ id: 1, event: 33, team_h: 10, team_a: 11 }),
          fixture({ id: 2, event: 33, team_h: 10, team_a: 12 }),
          fixture({ id: 3, event: 33, team_h: 14, team_a: 15 }),
        ],
      }),
    );
    const gw33 = rows[1];
    // XI (clubs 10–20): 10 doubles, 11 and 12 single, 13 blank, 14 and 15
    // single, 16–20 blank — five XI play, one of them twice.
    expect(gw33.startersPlaying).toBe(5);
    expect(gw33.starterDoubles).toBe(1);
    expect(gw33.starterBlanks).toBe(6);
    // Bench ids 12–14 (clubs 10, 11, 12) also play — squad reads eight.
    expect(gw33.squadPlaying).toBe(8);
  });

  it("a fully blank week for the squad shows zero across the row", () => {
    // A fixture between two clubs nobody owns.
    const rows = profileGameweeks(
      input({
        fixtures: [fixture({ id: 1, event: 30, team_h: 30, team_a: 31 })],
        gws: [30],
      }),
    );
    expect(rows[0].startersPlaying).toBe(0);
    expect(rows[0].squadPlaying).toBe(0);
    expect(rows[0].starterBlanks).toBe(11);
  });

  it("bench seats never count in the headline — XI only", () => {
    // GW30: clubs 19 and 20 play. XI ids 1–11 own clubs 10–20, so id 10
    // (club 19) and id 11 (club 20) are XI members and count. Bench ids
    // 12–15 own clubs 10–13 and do not play.
    const rows = profileGameweeks(
      input({
        fixtures: [fixture({ id: 1, event: 30, team_h: 19, team_a: 20 })],
        gws: [30],
      }),
    );
    expect(rows[0].startersPlaying).toBe(2);
    expect(rows[0].squadPlaying).toBe(2);
    expect(rows[0].starterBlanks).toBe(9);
  });

  it("rows beyond the scheduled horizon are 'possible', never 'scheduled'", () => {
    const rows = profileGameweeks(
      input({
        fixtures: [fixture({ id: 1, event: 36, team_h: 10, team_a: 11 })],
        gws: [36],
        scheduledUpTo: 33,
      }),
    );
    expect(rows[0].confidence).toBe("possible");
  });

  it("rows at or below the scheduled horizon stay 'scheduled'", () => {
    const rows = profileGameweeks(
      input({ gws: [29], scheduledUpTo: 29 }),
    );
    expect(rows[0].confidence).toBe("scheduled");
  });

  it("an unknown element (a sold player) counts as blank, never as an error", () => {
    const rows = profileGameweeks(
      input({
        squadIds: [99, ...SQUAD_IDS.slice(0, 14)],
        fixtures: [fixture({ id: 1, event: 29, team_h: 10, team_a: 11 })],
      }),
    );
    // The unknown id displaces the XI: ids 1–10 are now the XI and clubs
    // 12–19 blank among them.
    expect(rows[0].starterBlanks).toBe(9);
  });

  it("the Bench Boost score prefers the fullest week and the deepest bench", () => {
    const rows = profileGameweeks(
      input({
        fixtures: [
          fixture({ id: 1, event: 29, team_h: 10, team_a: 11 }),
          fixture({ id: 2, event: 33, team_h: 10, team_a: 11 }),
          fixture({ id: 3, event: 33, team_h: 14, team_a: 15 }),
        ],
      }),
    );
    const gw29 = rows[0];
    const gw33 = rows[1];
    expect(gw33.benchBoostScore).toBeGreaterThan(gw29.benchBoostScore);
  });
});

describe("bestBenchBoostWeek", () => {
  it("names the fullest scheduled week", () => {
    const rows = profileGameweeks(
      input({
        fixtures: [
          fixture({ id: 1, event: 29, team_h: 10, team_a: 11 }),
          fixture({ id: 2, event: 33, team_h: 10, team_a: 11 }),
          fixture({ id: 3, event: 33, team_h: 14, team_a: 15 }),
        ],
      }),
    );
    expect(bestBenchBoostWeek(rows)?.gw).toBe(33);
  });

  it("never names a possible week — chips are played on facts", () => {
    const rows = profileGameweeks(
      input({
        fixtures: [fixture({ id: 1, event: 36, team_h: 10, team_a: 11 })],
        gws: [36],
        scheduledUpTo: 33,
      }),
    );
    expect(bestBenchBoostWeek(rows)).toBeNull();
  });

  it("says nothing when every scheduled week is blank", () => {
    const rows = profileGameweeks(input({ gws: [29], scheduledUpTo: 29 }));
    expect(bestBenchBoostWeek(rows)).toBeNull();
  });
});