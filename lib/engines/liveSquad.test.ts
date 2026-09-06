import { describe, expect, it } from "vitest";
import { buildLiveSquad } from "@/lib/engines/liveSquad";
import type { BootstrapLite } from "@/lib/fpl/bootstrapLite";
import type { Fixture, Live, PicksResponse } from "@/lib/fpl/schemas";

/*
 * The per-fixture split is what lets a scoreboard say "this match gave you
 * fourteen". Every case below is one way the naive version — put the whole
 * score on the player's first fixture — states something false.
 */

function fixture(over: Partial<Fixture> & { id: number; team_h: number; team_a: number }): Fixture {
  return {
    code: over.id,
    event: 1,
    kickoff_time: "2026-08-15T14:00:00Z",
    started: true,
    finished: true,
    finished_provisional: true,
    minutes: 90,
    provisional_start_time: false,
    team_h_score: 1,
    team_a_score: 0,
    team_h_difficulty: 3,
    team_a_difficulty: 3,
    stats: [],
    pulse_id: over.id,
    ...over,
  } as Fixture;
}

function liveElement(
  id: number,
  totalPoints: number,
  explain: { fixture: number; points: number }[],
  over: Partial<Live["elements"][number]["stats"]> = {},
): Live["elements"][number] {
  return {
    id,
    stats: {
      minutes: 90, goals_scored: 0, assists: 0, clean_sheets: 0, goals_conceded: 0,
      own_goals: 0, penalties_saved: 0, penalties_missed: 0, yellow_cards: 0,
      red_cards: 0, saves: 0, bonus: 0, bps: 0, influence: 0, creativity: 0,
      threat: 0, ict_index: 0, clearances_blocks_interceptions: 0, recoveries: 0,
      tackles: 0, defensive_contribution: 0, starts: 1, expected_goals: 0,
      expected_assists: 0, expected_goal_involvements: 0, expected_goals_conceded: 0,
      total_points: totalPoints, in_dreamteam: false, played: true,
      ...over,
    },
    explain: explain.map((e) => ({
      fixture: e.fixture,
      stats: [{ identifier: "minutes", points: e.points, value: 90, points_modification: 0 }],
    })),
  } as Live["elements"][number];
}

/** Fifteen players, ids 1–15: 2 GK, 5 DEF, 5 MID, 3 FWD. */
const POS = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4];

function boot(teamOf: (id: number) => number): BootstrapLite {
  const elements: BootstrapLite["elements"] = {};
  for (let i = 1; i <= 15; i++) {
    elements[i] = {
      id: i, web_name: `P${i}`, team: teamOf(i), element_type: POS[i - 1],
    } as BootstrapLite["elements"][number];
  }
  return {
    elements,
    elementTypes: [
      { id: 1, squad_min_play: 1 }, { id: 2, squad_min_play: 3 },
      { id: 3, squad_min_play: 2 }, { id: 4, squad_min_play: 1 },
    ],
  } as unknown as BootstrapLite;
}

function picks(over: Partial<PicksResponse["entry_history"]> = {}): PicksResponse {
  return {
    active_chip: null,
    automatic_subs: [],
    entry_history: {
      event: 1, points: 0, total_points: 0, rank: null, rank_sort: null,
      overall_rank: null, bank: 0, value: 1000, event_transfers: 0,
      event_transfers_cost: 0, points_on_bench: 0, ...over,
    },
    picks: Array.from({ length: 15 }, (_, i) => ({
      element: i + 1,
      position: i + 1,
      multiplier: i + 1 === 1 ? 2 : i < 11 ? 1 : 0,
      is_captain: i === 0,
      is_vice_captain: i === 1,
    })),
  } as PicksResponse;
}

describe("points are attributed to the fixture that produced them", () => {
  it("puts a single-fixture player's whole score on his match", () => {
    const fixtures = [fixture({ id: 10, team_h: 1, team_a: 2 })];
    const live: Live = { elements: [liveElement(3, 6, [{ fixture: 10, points: 6 }])] };
    const squad = buildLiveSquad({ picks: picks(), live, fixtures, boot: boot(() => 1) });
    expect(squad.players.get(3)!.pointsByFixture.get(10)).toBe(6);
  });

  it("splits a double gameweek across both matches instead of banking it on the first", () => {
    // The bug: 9 points on fixture 10 and nothing on 11, so a scoreboard read
    // during the second match showed a blank for a player who had just scored.
    const fixtures = [
      fixture({ id: 10, team_h: 1, team_a: 2 }),
      fixture({ id: 11, team_h: 3, team_a: 1 }),
    ];
    const live: Live = {
      elements: [liveElement(3, 9, [{ fixture: 10, points: 2 }, { fixture: 11, points: 7 }])],
    };
    const squad = buildLiveSquad({ picks: picks(), live, fixtures, boot: boot(() => 1) });
    const split = squad.players.get(3)!.pointsByFixture;
    expect(split.get(10)).toBe(2);
    expect(split.get(11)).toBe(7);
  });

  it("never loses a point the feed did not explain", () => {
    // total_points says 8, explain accounts for 5. The missing 3 goes on the
    // last fixture rather than vanishing: the scoreboard has to add up to the
    // number the manager can read on their own FPL page.
    const fixtures = [fixture({ id: 10, team_h: 1, team_a: 2 })];
    const live: Live = { elements: [liveElement(3, 8, [{ fixture: 10, points: 5 }])] };
    const squad = buildLiveSquad({ picks: picks(), live, fixtures, boot: boot(() => 1) });
    const player = squad.players.get(3)!;
    expect(player.pointsByFixture.get(10)).toBe(8);
    expect(sum(player.pointsByFixture)).toBe(player.livePoints);
  });

  it("attributes projected bonus to the match whose bps race earned it", () => {
    const bpsFixture = fixture({
      id: 11, team_h: 3, team_a: 1, finished: false, finished_provisional: false,
      stats: [{ identifier: "bps", h: [], a: [{ element: 3, value: 40 }] }],
    });
    const fixtures = [fixture({ id: 10, team_h: 1, team_a: 2 }), bpsFixture];
    const live: Live = {
      elements: [liveElement(3, 4, [{ fixture: 10, points: 2 }, { fixture: 11, points: 2 }])],
    };
    const squad = buildLiveSquad({ picks: picks(), live, fixtures, boot: boot(() => 1) });
    const player = squad.players.get(3)!;
    expect(player.provisionalBonus).toBe(3);
    // The bonus lands on 11, the fixture still being played — not on 10.
    expect(player.pointsByFixture.get(10)).toBe(2);
    expect(player.pointsByFixture.get(11)).toBe(5);
    expect(sum(player.pointsByFixture)).toBe(player.livePoints);
  });

  it("attributes nothing for a player whose club has no fixture", () => {
    const fixtures = [fixture({ id: 10, team_h: 1, team_a: 2 })];
    const live: Live = { elements: [liveElement(3, 0, [])] };
    const squad = buildLiveSquad({ picks: picks(), live, fixtures, boot: boot(() => 9) });
    expect(squad.players.get(3)!.pointsByFixture.size).toBe(0);
  });

  it("every player's split sums to his live points", () => {
    const fixtures = [
      fixture({ id: 10, team_h: 1, team_a: 2 }),
      fixture({ id: 11, team_h: 3, team_a: 4 }),
    ];
    const live: Live = {
      elements: Array.from({ length: 15 }, (_, i) =>
        liveElement(i + 1, i, [{ fixture: i % 2 === 0 ? 10 : 11, points: i }]),
      ),
    };
    const teamOf = (id: number) => (id % 2 === 0 ? 1 : 3);
    const squad = buildLiveSquad({ picks: picks(), live, fixtures, boot: boot(teamOf) });
    for (const player of squad.players.values()) {
      expect(sum(player.pointsByFixture), `element ${player.id}`).toBe(player.livePoints);
    }
  });
});

const sum = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0);
