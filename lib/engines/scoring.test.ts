import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseScoring, pointsForOutcome } from "@/lib/engines/scoring";
import { getGwPhase } from "@/lib/engines/matchState";
import type { Bootstrap, EventStatus, Fixture, FplEvent } from "@/lib/fpl/schemas";

const fx = <T>(name: string): T =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "..", "__fixtures__", name), "utf8")) as T;

describe("scoring", () => {
  const boot = fx<Bootstrap>("bootstrap.json");
  const scoring = parseScoring(boot.game_config);

  it("resolves GK goal = 10 from the API, not a literal", () => {
    expect(scoring.goals[1]).toBe(10);
    expect(scoring.goals[2]).toBe(6);
    expect(scoring.goals[3]).toBe(5);
    expect(scoring.goals[4]).toBe(4);
  });

  it("clean sheets and assists match 2026/27 config", () => {
    expect(scoring.cleanSheet[2]).toBe(4);
    expect(scoring.cleanSheet[3]).toBe(1);
    expect(scoring.cleanSheet[4]).toBe(0);
    expect(scoring.assist).toBe(3);
    expect(scoring.defconPoints[2]).toBe(2);
  });

  it("pointsForOutcome maps positions", () => {
    expect(pointsForOutcome("goal", 1, scoring)).toBe(10);
    expect(pointsForOutcome("defcon", 3, scoring)).toBe(2);
  });
});

function makeEvent(overrides: Partial<FplEvent>): FplEvent {
  return {
    id: 1,
    name: "GW",
    deadline_time: "2026-08-21T17:30:00Z",
    average_entry_score: 0,
    finished: false,
    data_checked: false,
    highest_scoring_entry: null,
    deadline_time_epoch: 0,
    highest_score: null,
    is_previous: false,
    is_current: true,
    is_next: false,
    cup_leagues_created: false,
    h2h_ko_matches_created: false,
    chip_plays: [],
    most_selected: null,
    most_transferred_in: null,
    top_element: null,
    top_element_info: null,
    transfers_made: 0,
    most_captained: null,
    most_vice_captained: null,
    ...overrides,
  };
}

function makeFixture(overrides: Partial<Fixture>): Fixture {
  return {
    id: 1,
    code: 1,
    event: 1,
    kickoff_time: "2026-08-22T11:30:00Z",
    started: true,
    finished: false,
    finished_provisional: false,
    minutes: 45,
    provisional_start_time: false,
    team_h: 1,
    team_a: 2,
    team_h_score: 0,
    team_a_score: 0,
    team_h_difficulty: 3,
    team_a_difficulty: 3,
    stats: [],
    pulse_id: 1,
    ...overrides,
  };
}

const emptyStatus = { status: [], leagues: "" } as unknown as EventStatus;

describe("matchState", () => {
  it("covers all six phases", () => {
    expect(getGwPhase(makeEvent({ data_checked: true }), [makeFixture({})], emptyStatus)).toBe("final");

    const future = makeEvent({ deadline_time: new Date(Date.now() + 86_400_000).toISOString() });
    expect(getGwPhase(future, [], emptyStatus)).toBe("pre_deadline");

    expect(getGwPhase(makeEvent({}), [], emptyStatus)).toBe("awaiting_kickoff");

    const live = [makeFixture({ started: true, finished_provisional: false })];
    expect(getGwPhase(makeEvent({}), live, emptyStatus)).toBe("live");

    const prov = [
      makeFixture({ started: true, finished_provisional: true }),
      makeFixture({ id: 2, started: true, finished_provisional: true }),
    ];
    expect(getGwPhase(makeEvent({}), prov, emptyStatus)).toBe("provisional");

    const statusWithBonus = {
      status: [{ bonus_added: true, date: "2026-08-22", event: 1, points: "r" }],
      leagues: "",
    } as unknown as EventStatus;
    expect(getGwPhase(makeEvent({}), prov, statusWithBonus)).toBe("bonus_added");
  });
});
