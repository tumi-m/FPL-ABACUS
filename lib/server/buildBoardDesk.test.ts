import { describe, expect, it } from "vitest";
import {
  computeFreeTransfers,
  computeGwProfiles,
  fixtureRun,
} from "./buildBoardDesk";

type Fx = { event: number | null; team_h: number; team_a: number };

const fullSlate: Fx[] = Array.from({ length: 10 }, (_, i) => ({
  event: 24,
  team_h: i * 2 + 1,
  team_a: i * 2 + 2,
}));

describe("computeGwProfiles", () => {
  it("reads a full slate as ten fixtures, no doubles, no byes", () => {
    expect(computeGwProfiles(fullSlate, [24])).toEqual([
      { id: 24, fixtures: 20, doubles: 0, byes: 0 },
    ]);
  });

  it("counts a club playing twice as a double", () => {
    const fx: Fx[] = [...fullSlate.slice(0, 9), { event: 24, team_h: 1, team_a: 3 }];
    const p = computeGwProfiles(fx, [24])[0];
    expect(p.doubles).toBe(2);
    expect(p.byes).toBe(2);
    expect(p.fixtures).toBe(20);
  });

  it("flags blank weeks by missing clubs", () => {
    const fx: Fx[] = fullSlate.slice(0, 8);
    const p = computeGwProfiles(fx, [24], 20)[0];
    expect(p.byes).toBe(4);
    expect(p.doubles).toBe(0);
  });

  it("ignores fixtures outside the requested gameweeks", () => {
    const p = computeGwProfiles([{ event: 23, team_h: 1, team_a: 2 }], [24]);
    expect(p[0]).toEqual({ id: 24, fixtures: 0, doubles: 0, byes: 20 });
  });
});

describe("computeFreeTransfers", () => {
  it("starts on one free transfer with no history", () => {
    expect(computeFreeTransfers([], [], 5)).toBe(1);
  });

  it("banks one per quiet week up to the cap of five", () => {
    const current = [1, 2, 3, 4, 5, 6, 7].map((event) => ({ event, event_transfers: 0 }));
    expect(computeFreeTransfers(current, [], 9)).toBe(5);
    expect(computeFreeTransfers(current.slice(0, 2), [], 4)).toBe(3);
  });

  it("spends transfers before banking", () => {
    const current = [
      { event: 1, event_transfers: 0 },
      { event: 2, event_transfers: 2 },
      { event: 3, event_transfers: 0 },
    ];
    expect(computeFreeTransfers(current, [], 5)).toBe(2);
  });

  it("never dips below zero after a bulk move", () => {
    const current = [{ event: 1, event_transfers: 4 }];
    expect(computeFreeTransfers(current, [], 3)).toBe(0);
  });

  it("resets to one in the wildcard week, then banks from there", () => {
    const current = [
      { event: 1, event_transfers: 0 },
      { event: 2, event_transfers: 0 },
      { event: 3, event_transfers: 0 },
      { event: 4, event_transfers: 0 },
    ];
    expect(computeFreeTransfers(current, [{ name: "wildcard", event: 3 }], 6)).toBe(2);
    expect(computeFreeTransfers(current, [{ name: "freehit", event: 3 }], 6)).toBe(2);
    expect(computeFreeTransfers(current, [{ name: "bboost", event: 3 }], 6)).toBe(5);
  });

  it("ignores history at or beyond the current gameweek and never goes negative", () => {
    const current = [
      { event: 7, event_transfers: 3 },
      { event: 8, event_transfers: 0 },
    ];
    expect(computeFreeTransfers(current, [], 8)).toBe(0);
  });
});

describe("fixtureRun", () => {
  const fixtures: Fx[] = [
    { event: 24, team_h: 1, team_a: 2 },
    { event: 25, team_h: 3, team_a: 1 },
    { event: 26, team_h: 1, team_a: 4 },
  ];
  const shortNameOf = (id: number) => ["", "ARS", "CHE", "LIV", "MCI"][id] ?? "?";

  it("casing marks the venue: opponent lowercase at home, uppercase away", () => {
    expect(fixtureRun(1, fixtures, [24, 25, 26], shortNameOf)).toBe("che(H) LIV(A) mci(H)");
    expect(fixtureRun(2, fixtures, [24, 25, 26], shortNameOf)).toBe("ARS(A) — —");
  });

  it("emits an em dash for blank weeks and stops at three", () => {
    expect(fixtureRun(9, fixtures, [24, 25, 26, 27], shortNameOf)).toBe("— — —");
  });
});
