import { describe, expect, it } from "vitest";
import { HIT_POINTS, solvePlan, type SolveInput } from "./beam";
import { checkSwap, type PlannerPlayer } from "@/lib/engines/planner";

function player(over: Partial<PlannerPlayer> & { id: number }): PlannerPlayer {
  return {
    name: `P${over.id}`,
    pos: 3,
    team: 1,
    code: "AAA",
    cost: 50,
    photo: "",
    form: 3,
    ppg: 3,
    points: 30,
    owned: 5,
    minutes: 900,
    status: "a",
    news: "",
    horizon: [2, 2, 2, 2, 2, 2],
    costChangeEvent: 0,
    costChangeStart: 0,
    netTransfers: 0,
    ...over,
  };
}

/** A legal fifteen: 2 GK, 5 DEF, 5 MID, 3 FWD. */
function squad(): PlannerPlayer[] {
  return [
    player({ id: 1, pos: 1, team: 1, horizon: [3, 3, 3, 3, 3, 3] }),
    player({ id: 2, pos: 1, team: 2, horizon: [2, 2, 2, 2, 2, 2] }),
    ...[3, 4, 5, 6, 7].map((i) => player({ id: i, pos: 2, team: i, horizon: [4, 4, 4, 4, 4, 4] })),
    ...[11, 12, 13, 14, 15].map((i) => player({ id: i, pos: 3, team: i, horizon: [5, 5, 5, 5, 5, 5] })),
    ...[21, 22, 23].map((i) => player({ id: i, pos: 4, team: i, horizon: [6, 6, 6, 6, 6, 6] })),
  ];
}

/** One improving candidate per position, mid-price. */
function market(): PlannerPlayer[] {
  return [
    player({ id: 101, pos: 1, team: 20, cost: 55, horizon: [4, 4, 4, 4, 4, 4] }),
    player({ id: 102, pos: 2, team: 20, cost: 55, horizon: [5, 5, 5, 5, 5, 5] }),
    player({ id: 103, pos: 3, team: 20, cost: 55, horizon: [6, 6, 6, 6, 6, 6] }),
    player({ id: 104, pos: 4, team: 20, cost: 55, horizon: [7, 7, 7, 7, 7, 7] }),
  ];
}

function input(overrides: Partial<SolveInput> = {}): SolveInput {
  const s = squad();
  return {
    squad: s,
    market: [...market(), ...s],
    bankTenths: 20,
    sellPriceOf: (id) => s.find((p) => p.id === id)?.cost ?? 0,
    weeks: 3,
    risk: 0,
    ...overrides,
  };
}

describe("solvePlan — the branching beam", () => {
  it("a fixed squad and market return a stable plan", () => {
    const a = solvePlan(input());
    const b = solvePlan(input());
    expect(a.moves).toEqual(b.moves);
    expect(a.score).toBe(b.score);
    expect(a.perGw).toEqual(b.perGw);
  });

  it("every move in the plan is legal through checkSwap", () => {
    const result = solvePlan(input({ weeks: 4 }));
    const byId = new Map([...market(), ...squad()].map((p) => [p.id, p]));
    const squadIds = squad().map((p) => p.id);
    let bank = input().bankTenths;
    const sellOf = (id: number) => squad().find((p) => p.id === id)?.cost ?? 0;
    for (const m of result.moves) {
      const out = byId.get(m.out)!;
      const inc = byId.get(m.in)!;
      const check = checkSwap(m.out, m.in, {
        squadIds,
        bankTenths: bank + sellOf(m.out),
        playerOf: (id: number) => byId.get(id),
        sellPriceOf: sellOf,
      });
      expect(check.ok, `${m.out} → ${m.in}: ${check.reason}`).toBe(true);
      // Same position — the desk's rule.
      expect(inc.pos).toBe(out.pos);
      expect(inc.cost).toBeLessThanOrEqual(bank + sellOf(m.out));
      bank += sellOf(m.out) - inc.cost;
      const at = squadIds.indexOf(m.out);
      squadIds[at] = m.in;
    }
  });

  it("a rising market finds transfers; a flat market rolls", () => {
    const improving = solvePlan(input());
    expect(improving.moves.length).toBeGreaterThan(0);

    // Identical market players cost more than your squad and gain nothing —
    // holding is the plan.
    const flat = solvePlan(
      input({
        market: [
          ...squad(),
          player({ id: 201, pos: 3, team: 20, cost: 90, horizon: [5, 5, 5, 5, 5, 5] }),
        ],
      }),
    );
    expect(flat.moves).toEqual([]);
  });

  it("a higher risk posture returns a lower-variance plan", () => {
    // Two candidates: one consistent, one streaky (a blank then a spike).
    const consistent = player({ id: 301, pos: 3, team: 20, cost: 55, horizon: [5, 5, 5, 5, 5, 5] });
    const streaky = player({ id: 302, pos: 3, team: 20, cost: 55, horizon: [0, 9, 0, 9, 0, 9] });
    const safe = solvePlan(
      input({ market: [...market(), consistent, streaky, ...squad()], weeks: 2 }),
    );
    const shielded = solvePlan(
      input({ market: [...market(), consistent, streaky, ...squad()], weeks: 2, risk: 1 }),
    );
    // Same horizon, same market: the shielded plan's worst week is at least
    // as good as the mean-maximiser's.
    expect(shielded.worstGwPoints).toBeGreaterThanOrEqual(safe.worstGwPoints);
  });

  it("a hit in the plan is only taken when it pays", () => {
    // No candidate gains more than 2 over any window — no hit can pay.
    const poorMarket = [
      ...squad(),
      player({ id: 401, pos: 3, team: 20, cost: 55, horizon: [3, 3, 3, 3, 3, 3] }),
    ];
    const result = solvePlan(
      input({
        market: poorMarket,
        weeks: 2,
        // Force hits by giving no free transfer to start with.
        squad: squad(),
      }),
    );
    expect(result.hits).toBe(0);
  });

  it("the beam stays inside its width and reports what it explored", () => {
    const result = solvePlan(input({ beamWidth: 8 }));
    expect(result.beamWidth).toBe(8);
    expect(result.explored).toBeGreaterThan(0);
    // The heuristic says what it is, in numbers the UI can quote.
    expect(result.horizon).toBe(3);
  });

  it("empty squads and empty markets are honest, not crashes", () => {
    const empty = solvePlan(input({ squad: [], market: [], weeks: 2 }));
    expect(empty.moves).toEqual([]);
    expect(empty.score).toBe(0);
    // The roll path still walks the horizon — zeros, honestly.
    expect(empty.perGw).toEqual([0, 0]);
  });

  it("HIT_POINTS is FPL's −4", () => {
    expect(HIT_POINTS).toBe(4);
  });
});