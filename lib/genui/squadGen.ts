/**
 * v5-D — deterministic squad generator behind the assistant's "build me a
 * squad" intent. The model may set strategy params ONLY; this module picks
 * the actual players from cached bootstrap data under full FPL constraints:
 * 15 squad, 2 GK / 5 DEF / 5 MID / 3 FWD, ≤3 per club, within budget.
 */
import type { ElementLite } from "@/lib/fpl/bootstrapLite";

export interface GenParams {
  /** Budget in tenths (default £100.0m). */
  budgetTenths?: number;
  /** safe → weight ownership; balanced → raw projection; differential → boost rarity. */
  risk?: "safe" | "balanced" | "differential";
}

export interface GeneratedSquad {
  picks: { elementId: number; webName: string; pos: number; teamId: number; cost: number; epNext: number | null }[];
  totalCost: number;
  totalEpNext: number;
}

const SLOTS: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 };

/**
 * Greedy value fill with a feasibility reserve: every pick must leave enough
 * of the budget for the cheapest available filler in each still-unfilled
 * slot. Deterministic — same input, same squad.
 */
export function generateSquad(
  elements: ElementLite[],
  params: GenParams = {},
): GeneratedSquad | null {
  const budget = params.budgetTenths ?? 1000;
  const risk = params.risk ?? "balanced";
  const available = elements.filter((e) => e.status === "a");

  const ownPct = (e: ElementLite) => Number(e.selected_by_percent || 0);
  const scoreOf = (e: ElementLite): number => {
    const base = e.ep_next ?? e.ppg;
    if (risk === "differential") return base * (1 + Math.max(0, 40 - ownPct(e)) / 40);
    if (risk === "safe") return base * (1 + ownPct(e) / 200);
    return base;
  };
  const cheaper = (a: ElementLite, b: ElementLite) => a.now_cost - b.now_cost;

  const byPos = new Map<number, ElementLite[]>();
  for (const e of available) {
    const arr = byPos.get(e.element_type) ?? [];
    arr.push(e);
    byPos.set(e.element_type, arr);
  }
  for (const [, arr] of byPos) arr.sort((a, b) => scoreOf(b) - scoreOf(a) || cheaper(a, b));

  // Cheapest live player per position — the floor every plan must afford.
  const minPriceByPos = new Map<number, number>();
  for (const [pos, arr] of byPos) {
    minPriceByPos.set(pos, [...arr].sort(cheaper)[0]?.now_cost ?? Number.POSITIVE_INFINITY);
  }

  const picked: ElementLite[] = [];
  const clubCount = new Map<number, number>();
  let spend = 0;
  const remaining: Record<number, number> = { 1: SLOTS[1], 2: SLOTS[2], 3: SLOTS[3], 4: SLOTS[4] };

  for (const pos of [1, 2, 3, 4] as const) {
    const pool = byPos.get(pos) ?? [];
    let filled = 0;
    for (const e of pool) {
      if (filled >= SLOTS[pos]) break;
      if ((clubCount.get(e.team) ?? 0) >= 3) continue;

      // Reserve: cheapest filler for every slot still unfilled anywhere in
      // the squad, including the rest of this position after taking e.
      let reserve = 0;
      for (const p of [1, 2, 3, 4] as const) {
        const left = p === pos ? SLOTS[pos] - filled - 1 : remaining[p];
        reserve += minPriceByPos.get(p)! * Math.max(0, left);
      }
      if (spend + e.now_cost + reserve > budget) continue;

      picked.push(e);
      clubCount.set(e.team, (clubCount.get(e.team) ?? 0) + 1);
      spend += e.now_cost;
      filled++;
    }
    remaining[pos] = SLOTS[pos] - filled;
    // A position we could not field at all means no legal squad exists.
    if (remaining[pos] > 0) return null;
  }

  const totalCost = picked.reduce((s, e) => s + e.now_cost, 0);
  return {
    picks: picked.map((e) => ({
      elementId: e.id,
      webName: e.web_name,
      pos: e.element_type,
      teamId: e.team,
      cost: e.now_cost,
      epNext: e.ep_next,
    })),
    totalCost,
    totalEpNext: Number(picked.reduce((s, e) => s + (e.ep_next ?? 0), 0).toFixed(1)),
  };
}
