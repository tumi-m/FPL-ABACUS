import { describe, expect, it } from "vitest";
import { generateSquad } from "@/lib/genui/squadGen";
import type { ElementLite } from "@/lib/fpl/bootstrapLite";

function el(id: number, pos: number, cost: number, ep: number, team: number, own = 10): ElementLite {
  return {
    id,
    web_name: `P${id}`,
    element_type: pos,
    team,
    team_code: team,
    now_cost: cost,
    status: "a" as const,
    news: "",
    chance_of_playing_this_round: null,
    chance_of_playing_next_round: null,
    selected_by_percent: own,
    form: 0,
    ep_next: ep,
    photo: "",
    code: id,
    minutes: 500,
    xg90: null,
    xa90: null,
    ppg: 3,
    total_points: 50,
    event_points: 0,
    goals_scored: 0,
    assists: 0,
    bonus: 0,
    bps: 0,
    transfersInEvent: 0,
    transfersOutEvent: 0,
  };
}

/** A full fake player universe: premiums and fillers at every position. */
function universe(): ElementLite[] {
  const out: ElementLite[] = [];
  const counts = { 1: 8, 2: 20, 3: 20, 4: 12 } as Record<number, number>;
  for (const [posStr, n] of Object.entries(counts)) {
    const pos = Number(posStr);
    for (let i = 0; i < n; i++) {
      // premiums early (expensive, high ep); spread across clubs so the
      // ≤3-per-club rule never blocks them in this fixture
      const premium = i < Math.ceil(n / 4);
      const team = premium ? (((pos - 1) * 5 + i) % 18) + 1 : (i % 15) + 1;
      out.push(el(100 * pos + i, pos, premium ? 55 + i : 45, premium ? 6 + i * 0.2 : 2.5, team, premium ? 30 + i : 3));
    }
  }
  // a genuine differential: mid-price output nobody owns
  out.push(el(999, 4, 45, 4.5, 15, 1));
  return out;
}

describe("generateSquad", () => {
  it("fields a legal 15 under all constraints", () => {
    const squad = generateSquad(universe());
    expect(squad).not.toBeNull();
    expect(squad!.picks).toHaveLength(15);
    for (const pos of [1, 2, 3, 4]) {
      const SLOTS: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 };
      expect(squad!.picks.filter((p) => p.pos === pos)).toHaveLength(SLOTS[pos]);
    }
    expect(squad!.totalCost).toBeLessThanOrEqual(1000);
    // ≤3 per club
    const byClub = new Map<number, number>();
    for (const p of squad!.picks) byClub.set(p.teamId, (byClub.get(p.teamId) ?? 0) + 1);
    expect(Math.max(...byClub.values())).toBeLessThanOrEqual(3);
  });

  it("prefers premiums when they fit", () => {
    const squad = generateSquad(universe());
    // The best £55+ players score highest — several should appear.
    expect(squad!.picks.filter((p) => p.cost > 45).length).toBeGreaterThanOrEqual(3);
  });

  it("differential risk picks the unowned talent balanced mode overlooks", () => {
    const diff = generateSquad(universe(), { risk: "differential" })!;
    // P999: 5.9 xP at 1% owned — differential scoring lifts him into the XI
    expect(diff.picks.some((p) => p.elementId === 999)).toBe(true);
    const balanced = generateSquad(universe(), { risk: "balanced" })!;
    expect(balanced.picks.some((p) => p.elementId === 999)).toBe(false);
  });

  it("respects a tighter budget", () => {
    const squad = generateSquad(universe(), { budgetTenths: 820 });
    expect(squad).not.toBeNull();
    expect(squad!.totalCost).toBeLessThanOrEqual(820);
  });

  it("is deterministic", () => {
    expect(generateSquad(universe())).toEqual(generateSquad(universe()));
  });

  it("returns null when no legal squad can be built", () => {
    // only goalkeepers exist → cannot field
    const gksOnly = universe().filter((e) => e.element_type === 1);
    expect(generateSquad(gksOnly)).toBeNull();
  });
});
