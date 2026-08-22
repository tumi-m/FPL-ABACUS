import { describe, expect, it } from "vitest";
import { diffFixtures, reconcile, swingForEvent } from "@/lib/engines/swing";
import type { Fixture } from "@/lib/fpl/schemas";
import type { RawEvent } from "@/lib/engines/swing";

function fixture(id: number, minutes: number, goalsSaka: number): Fixture {
  return {
    id,
    code: id,
    event: 1,
    kickoff_time: "2026-08-22T11:30:00Z",
    started: true,
    finished: false,
    finished_provisional: false,
    minutes,
    provisional_start_time: false,
    team_h: 1,
    team_a: 2,
    team_h_score: goalsSaka,
    team_a_score: 0,
    team_h_difficulty: 3,
    team_a_difficulty: 3,
    pulse_id: 1,
    stats: [
      {
        identifier: "goals_scored",
        h: [{ element: 77, value: goalsSaka }],
        a: [],
      },
      {
        identifier: "bps",
        h: [{ element: 77, value: goalsSaka * 12 }],
        a: [],
      },
    ],
  };
}

const rawEvent = (over: Partial<RawEvent> = {}): RawEvent => ({
  fixture: 1,
  element: 77,
  identifier: "goals_scored",
  value: 1,
  minute: 73,
  ...over,
});

describe("swing", () => {
  it("detects a value increase and ignores unchanged entries", () => {
    const before = [fixture(1, 60, 0)];
    const after = [fixture(1, 73, 1)];
    const events = diffFixtures(before, after);
    expect(events).toHaveLength(2); // goal + bps
    expect(events.some((e) => e.identifier === "goals_scored" && e.value === 1)).toBe(true);
    expect(diffFixtures(after, after)).toHaveLength(0);
  });

  it("positive when you own and the field does not", () => {
    const s = swingForEvent(rawEvent(), 5, 2, 10, 1000);
    expect(s.ranksGained).toBe((2 - 0.1) * 5 * 1000);
    expect(s.kind).toBe("gain");
  });

  it("negative when the field owns and you do not", () => {
    const s = swingForEvent(rawEvent(), 5, 0, 40, 1000);
    expect(s.kind).toBe("loss");
    expect(s.ranksGained).toBeLessThan(0);
  });

  it("reconcile scales events so they sum exactly to observed delta", () => {
    const e1 = swingForEvent(rawEvent(), 5, 2, 10, 1000);
    const e2 = swingForEvent(rawEvent({ element: 9 }), 5, 0, 30, 1000);
    const observed = 12345;
    const r = reconcile([e1, e2], observed);
    expect(r.residual).toBe(0);
    const sum = r.events.reduce((s, e) => s + e.ranksGained, 0);
    expect(sum).toBeCloseTo(observed, 4);
  });
});
