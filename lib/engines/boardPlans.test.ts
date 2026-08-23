import { describe, expect, it } from "vitest";
import {
  addPlan,
  activePlan,
  emptyPlans,
  loadPlans,
  MAX_PLANS,
  removePlan,
  withActive,
} from "./boardPlans";

describe("loadPlans", () => {
  it("wraps a legacy v1 desk into a single Plan A, preserving moves and chips", () => {
    const legacy = JSON.stringify({ moves: [{ out: 1, in: 2 }], chips: { wc1: 24 } });
    const s = loadPlans(legacy);
    expect(s.plans).toHaveLength(1);
    expect(s.active).toBe("a");
    expect(s.plans[0].name).toBe("Plan A");
    expect(s.plans[0].moves).toEqual([{ out: 1, in: 2 }]);
    expect(s.plans[0].chips).toEqual({ wc1: 24 });
  });

  it("reads the multi-plan shape and honours a valid active id", () => {
    const raw = JSON.stringify({
      plans: [
        { id: "a", name: "ignored-custom-name", moves: [{ out: 9, in: 8 }], chips: {} },
        { id: "b", name: "whatever", moves: [], chips: { fh: 25 } },
      ],
      active: "b",
    });
    const s = loadPlans(raw);
    expect(s.plans.map((p) => p.id)).toEqual(["a", "b"]);
    expect(activePlan(s).id).toBe("b");
    expect(activePlan(s).chips).toEqual({ fh: 25 });
    expect(s.plans[0].moves).toEqual([{ out: 9, in: 8 }]);
  });

  it("falls back to the first plan when the active id is unknown", () => {
    const raw = JSON.stringify({
      plans: [{ id: "a", moves: [], chips: {} }],
      active: "zz",
    });
    expect(loadPlans(raw).active).toBe("a");
  });

  it("returns a fresh desk for garbage, corruption or empty input", () => {
    for (const raw of [null, undefined, "", "{not json", '"just a string"', "{}", '{"plans":[]}']) {
      const s = loadPlans(raw as string | null | undefined);
      expect(s).toEqual(emptyPlans());
    }
  });

  it("drops plans whose slot id is not a letter slot and sanitises entries", () => {
    const raw = JSON.stringify({
      plans: [
        { id: "zzz", moves: [], chips: {} },
        { id: "B", moves: [{ out: "x" as unknown as number }, { out: 3, in: 4 }], chips: { bad: "x", ok: 2 } },
      ],
      active: "b",
    });
    const s = loadPlans(raw);
    expect(s.plans.map((p) => p.id)).toEqual(["b"]);
    expect(s.plans[0].moves).toEqual([{ out: 3, in: 4 }]);
    expect(s.plans[0].chips).toEqual({ ok: 2 });
  });
});

describe("plan slots", () => {
  it("withActive mutates only the active plan", () => {
    let s = loadPlans(
      JSON.stringify({
        plans: [
          { id: "a", moves: [], chips: {} },
          { id: "b", moves: [], chips: {} },
        ],
        active: "b",
      }),
    );
    s = withActive(s, (p) => ({ ...p, moves: [...p.moves, { out: 1, in: 2 }] }));
    expect(s.plans[0].moves).toHaveLength(0);
    expect(s.plans[1].moves).toEqual([{ out: 1, in: 2 }]);
    expect(activePlan(s).moves).toEqual([{ out: 1, in: 2 }]);
  });

  it("addPlan fills the first free slot letter and activates it", () => {
    const start = loadPlans(
      JSON.stringify({
        plans: [
          { id: "a", moves: [], chips: {} },
          { id: "c", moves: [], chips: {} },
        ],
        active: "a",
      }),
    );
    const next = addPlan(start);
    expect(next.plans.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(next.active).toBe("b");
    expect(activePlan(next).moves).toEqual([]);
  });

  it("addPlan is a no-op at the cap", () => {
    let s = emptyPlans();
    for (let i = 1; i < MAX_PLANS; i++) s = addPlan(s);
    expect(s.plans).toHaveLength(MAX_PLANS);
    const full = addPlan(s);
    expect(full).toBe(s);
  });

  it("removePlan retargets active to the first survivor and never empties the desk", () => {
    let s = loadPlans(
      JSON.stringify({
        plans: [
          { id: "a", moves: [{ out: 1, in: 2 }], chips: {} },
          { id: "b", moves: [], chips: {} },
          { id: "c", moves: [], chips: {} },
        ],
        active: "a",
      }),
    );
    s = removePlan(s, "a");
    expect(s.plans.map((p) => p.id)).toEqual(["b", "c"]);
    expect(s.active).toBe("b");
    s = removePlan(removePlan(s, "b"), "c");
    expect(s).toEqual(emptyPlans());
  });

  it("removing a non-active plan keeps the active target", () => {
    const s = loadPlans(
      JSON.stringify({
        plans: [
          { id: "a", moves: [], chips: {} },
          { id: "b", moves: [], chips: {} },
        ],
        active: "a",
      }),
    );
    const next = removePlan(s, "b");
    expect(next.active).toBe("a");
    expect(next.plans.map((p) => p.id)).toEqual(["a"]);
  });
});
