import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectEvents } from "@/lib/server/swingStore";
import { MemoryStore, setCacheStore } from "@/lib/cache/store";
import type { Fixture } from "@/lib/fpl/schemas";

function stat(identifier: Fixture["stats"][number]["identifier"], entries: [number, number][], side: "h" | "a" = "h") {
  return {
    identifier,
    h: side === "h" ? entries.map(([element, value]) => ({ element, value })) : [],
    a: side === "a" ? entries.map(([element, value]) => ({ element, value })) : [],
  };
}

function fx(id: number, minutes: number, stats: Fixture["stats"]): Fixture {
  return {
    id,
    code: id * 1000,
    event: 1,
    kickoff_time: null,
    started: true,
    finished: false,
    finished_provisional: false,
    minutes,
    provisional_start_time: false,
    team_h: 1,
    team_a: 2,
    team_h_score: null,
    team_a_score: null,
    team_h_difficulty: 2,
    team_a_difficulty: 3,
    pulse_id: 0,
    stats,
  };
}

const GW = 1;

beforeEach(() => {
  setCacheStore(new MemoryStore());
});

afterEach(() => {
  setCacheStore(null);
});

describe("collectEvents", () => {
  it("returns no events on the first poll (no prior snapshot)", async () => {
    const events = await collectEvents(GW, [fx(100, 45, [stat("goals_scored", [[7, 1]])])]);
    expect(events).toEqual([]);
  });

  it("diffs the previous snapshot into accumulated scoring events", async () => {
    await collectEvents(GW, [fx(100, 45, [stat("goals_scored", [])])]);
    const next = [fx(100, 67, [stat("goals_scored", [[7, 1]])])];
    const events = await collectEvents(GW, next);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fixture: 100, element: 7, identifier: "goals_scored", value: 1, minute: 67 });
  });

  it("does not duplicate the same scoring event on repeated polls", async () => {
    const baseline = [fx(100, 60, [stat("goals_scored", [])])];
    const scored = [fx(100, 67, [stat("goals_scored", [[7, 1]])])];
    await collectEvents(GW, baseline);
    await collectEvents(GW, scored);
    const again = await collectEvents(GW, scored);

    expect(again.filter((e) => e.element === 7 && e.identifier === "goals_scored" && e.value === 1)).toHaveLength(1);
  });

  it("accumulates distinct events newest-first", async () => {
    await collectEvents(GW, [
      fx(100, 10, [stat("assists", [])]),
      fx(200, 20, [stat("goals_scored", [])]),
    ]);
    await collectEvents(GW, [
      fx(100, 30, [stat("assists", [[9, 1]])]),
      fx(200, 40, [stat("goals_scored", [])]),
    ]);
    const events = await collectEvents(GW, [
      fx(100, 30, [stat("assists", [[9, 1]])]),
      fx(200, 55, [stat("goals_scored", [[11, 2]], "a")]),
    ]);

    expect(events).toHaveLength(2);
    // most recent event first
    expect(events[0].fixture).toBe(200);
    expect(events[0].value).toBe(2);
    expect(events[1].identifier).toBe("assists");
  });

  it("ignores fixtures that were absent from the previous snapshot", async () => {
    await collectEvents(GW, [fx(100, 10, [stat("goals_scored", [])])]);
    const events = await collectEvents(GW, [
      fx(100, 30, [stat("goals_scored", [])]),
      fx(999, 30, [stat("goals_scored", [[5, 1]])]),
    ]);

    expect(events).toEqual([]);
  });
});
