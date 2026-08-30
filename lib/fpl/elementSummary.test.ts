import { describe, expect, it } from "vitest";
import { zElementSummary } from "@/lib/fpl/schemas";

/** A history row as FPL sends it today, trimmed to what the app reads. */
function row(over: Record<string, unknown> = {}) {
  return {
    element: 402,
    fixture: 12,
    round: 1,
    minutes: 78,
    total_points: 1,
    opponent_team: 3,
    was_home: true,
    kickoff_time: "2026-08-16T14:00:00Z",
    goals_scored: 0,
    assists: 0,
    bps: 9,
    expected_goals: "0.31",
    expected_assists: "0.08",
    defensive_contribution: 4,
    recoveries: 5,
    ...over,
  };
}

const summary = (history: unknown[]) => ({ fixtures: [], history, history_past: [] });

describe("element-summary parsing survives FPL drift", () => {
  it("parses a normal row and coerces the string-typed expected figures", () => {
    const r = zElementSummary.parse(summary([row()]));
    expect(r.history[0].expected_goals).toBe(0.31);
    expect(r.history[0].total_points).toBe(1);
  });

  it("a field FPL drops no longer blanks the whole player page", () => {
    // The bug: thirty-five keys were required per row, so one renamed or
    // removed field failed the parse, the page caught it, and every player in
    // the game reported "No match history yet this season".
    const stripped = row();
    delete (stripped as Record<string, unknown>).bps;
    delete (stripped as Record<string, unknown>).defensive_contribution;
    delete (stripped as Record<string, unknown>).was_home;
    const r = zElementSummary.parse(summary([stripped]));
    expect(r.history).toHaveLength(1);
    expect(r.history[0].bps).toBe(0);
    expect(r.history[0].defensive_contribution).toBe(0);
    expect(r.history[0].was_home).toBe(false);
  });

  it("a field FPL adds is carried rather than rejected", () => {
    const r = zElementSummary.parse(summary([row({ some_new_2027_stat: 4 })]));
    expect(r.history).toHaveLength(1);
  });

  it("still refuses a row that cannot be placed or read", () => {
    // Resilience is not "accept anything": without a round or minutes there is
    // no row to draw, and silently defaulting those would invent a gameweek.
    const noRound = row();
    delete (noRound as Record<string, unknown>).round;
    expect(() => zElementSummary.parse(summary([noRound]))).toThrow();

    const noMinutes = row();
    delete (noMinutes as Record<string, unknown>).minutes;
    expect(() => zElementSummary.parse(summary([noMinutes]))).toThrow();
  });

  it("tolerates history_past going missing entirely", () => {
    const r = zElementSummary.parse({ fixtures: [], history: [row()] });
    expect(r.history_past).toEqual([]);
  });

  it("keeps a fixture whose optional trimmings are absent", () => {
    const r = zElementSummary.parse({
      fixtures: [{ id: 9, event: 3, team_h: 1, team_a: 2, is_home: true, difficulty: 3 }],
      history: [],
      history_past: [],
    });
    expect(r.fixtures[0].kickoff_time).toBeNull();
    expect(r.fixtures[0].finished).toBe(false);
  });
});
