import { describe, expect, it } from "vitest";
import {
  DEADLINE_WINDOW_MS,
  THREAT_EO_FLOOR,
  gafferMessages,
} from "@/lib/engines/gafferMessages";
import type { MatchdayModel, SwingRow } from "@/lib/engines/matchdayModel";

const NOW = Date.parse("2026-08-15T12:00:00Z");
const AFTER = new Date(NOW - 3_600_000).toISOString();

function swing(over: Partial<SwingRow> & { id: string }): SwingRow {
  return {
    minute: 34,
    element: 4,
    webName: "Saka",
    identifier: "goals_scored",
    points: 5,
    eo: 40,
    yourMultiplier: 1,
    ranksGained: 1000,
    kind: "gain",
    ...over,
  };
}

function model(over: Partial<MatchdayModel> = {}): MatchdayModel {
  return {
    generatedAt: NOW,
    phase: "live",
    event: { id: 3, name: "Gameweek 3", deadlineTime: AFTER, latest: 3 },
    entry: { id: 1, name: "GP" },
    hero: {
      gwPoints: 48, officialEventPoints: null, officialLiveRank: null,
      estimatedLiveRank: null, confidence: "medium", rankDeltaSinceLastPoll: null,
      playersPlayed: 8, playersToPlay: 3, captainPoints: 12, benchPoints: 12,
      chip: null, transfersCost: 0,
    },
    squad: [], subs: [], swings: [],
    swingSummary: { reconciled: false, scale: null, residual: 0, observedDelta: null },
    leverage: { yours: [], threats: [], eoSource: "estimated" },
    multiverse: { results: [], regretIndex: 0, reliefIndex: 0 },
    fixturesRail: [],
    rankContext: { fieldAvg: 50, fieldSd: 10, sampleSize: 10, ranksPerPoint: 1000, curveAvailable: true },
    lastUpdatedLabel: "",
    ...over,
  } as MatchdayModel;
}

const none = new Set<string>();
const run = (prev: MatchdayModel | null, next: MatchdayModel, seen: ReadonlySet<string> = none) =>
  gafferMessages(prev, next, { now: NOW, seen });

describe("the Gaffer speaks when something happens to you", () => {
  it("announces a goal for one of yours", () => {
    const [m] = run(model(), model({ swings: [swing({ id: "1:4:goals_scored:1" })] }));
    expect(m.kind).toBe("swing");
    expect(m.headline).toBe("Saka scores");
    expect(m.detail).toBe("+5 on your score.");
    expect(m.tone).toBe("good");
  });

  it("says what the armband did to the points rather than only the raw event", () => {
    // "+5" for a captain's goal is a number the manager cannot reconcile with
    // the hero score, which moved by ten.
    const [m] = run(model(), model({ swings: [swing({ id: "a", yourMultiplier: 2 })] }));
    expect(m.label).toBe("Your captain");
    expect(m.detail).toContain("doubled to 10");
  });

  it("stays quiet about a player nobody owns", () => {
    const below = swing({ id: "b", yourMultiplier: 0, eo: THREAT_EO_FLOOR - 1, webName: "Nobody" });
    expect(run(model(), model({ swings: [below] }))).toEqual([]);
  });

  it("warns about a widely-owned player you do not have", () => {
    const threat = swing({ id: "c", yourMultiplier: 0, eo: 62, webName: "Haaland" });
    const [m] = run(model(), model({ swings: [threat] }));
    expect(m.kind).toBe("threat");
    expect(m.tone).toBe("bad");
    expect(m.detail).toContain("62%");
  });

  it("never announces the same moment twice", () => {
    const next = model({ swings: [swing({ id: "d" })] });
    expect(run(model(), next)).toHaveLength(1);
    expect(run(model(), next, new Set(["swing:d"]))).toEqual([]);
  });

  it("is silent on an event that scored nothing", () => {
    // A yellow card is worth points; a save that did not complete a set of
    // three is worth none, and there is nothing to interrupt anyone for.
    expect(run(model(), model({ swings: [swing({ id: "e", identifier: "saves", points: 0 })] }))).toEqual([]);
  });
});

describe("the Gaffer speaks when the week turns", () => {
  it("calls the auto-sub that changed the team you picked", () => {
    const squad = [
      { element: 9, webName: "Wood" },
      { element: 12, webName: "Mateta" },
    ] as MatchdayModel["squad"];
    const [m] = run(model({ squad }), model({ squad, subs: [{ out: 9, in: 12 }] }));
    expect(m.kind).toBe("autosub");
    expect(m.headline).toBe("Mateta comes on");
    expect(m.detail).toContain("Wood");
  });

  it("does not re-announce a sub that had already fired", () => {
    const subs = [{ out: 9, in: 12 }];
    expect(run(model({ subs }), model({ subs }))).toEqual([]);
  });

  it("marks the bonus settling, once", () => {
    const before = model({ phase: "provisional" });
    const after = model({ phase: "bonus_added" });
    const [m] = run(before, after);
    expect(m.kind).toBe("settled");
    expect(m.headline).toContain("48");
    expect(run(after, after)).toEqual([]);
  });

  it("does not fire settled on a first load that arrives already final", () => {
    // Opening the app on Tuesday should not celebrate Sunday's bonus.
    expect(run(null, model({ phase: "final" }))).toEqual([]);
  });
});

describe("rank moves are reported only when they are comparable", () => {
  const withRank = (official: number | null, estimated: number | null) =>
    model({ hero: { ...model().hero, officialLiveRank: official, estimatedLiveRank: estimated } });

  it("reports a climb against the previous poll", () => {
    const [m] = run(withRank(500_000, null), withRank(410_000, null));
    expect(m.kind).toBe("rank");
    expect(m.headline).toBe("Up 90,000 places");
    expect(m.tone).toBe("good");
  });

  it("reports a fall as a fall", () => {
    const [m] = run(withRank(410_000, null), withRank(500_000, null));
    expect(m.headline).toBe("Down 90,000 places");
    expect(m.tone).toBe("bad");
  });

  it("labels an estimate as an estimate", () => {
    const [m] = run(withRank(null, 500_000), withRank(null, 410_000));
    expect(m.label).toBe("Rank, estimated");
    expect(m.detail).toContain("our estimate");
  });

  it("does not call an estimate becoming official a rank move", () => {
    // The number changes because the source changed, not because you climbed.
    // Announcing it as a climb is the exact bug the honesty rules exist for.
    expect(run(withRank(null, 500_000), withRank(410_000, null))).toEqual([]);
  });
});

describe("the deadline", () => {
  const ahead = (ms: number) =>
    model({ event: { ...model().event, deadlineTime: new Date(NOW + ms).toISOString() } });

  it("is mentioned inside the window", () => {
    const [m] = run(null, ahead(90 * 60_000));
    expect(m.kind).toBe("deadline");
    expect(m.headline).toBe("1h 30m to lock in");
    expect(m.href).toBe("/deadline");
  });

  it("is not mentioned a day out", () => {
    expect(run(null, ahead(DEADLINE_WINDOW_MS + 60_000))).toEqual([]);
  });

  it("is not mentioned once it has passed", () => {
    expect(run(null, ahead(-60_000))).toEqual([]);
  });
});
