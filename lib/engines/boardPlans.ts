/**
 * Multi-plan desk slots — pure state for BoardDesk's persisted shape.
 * One commit per plan slot; the desk holds up to MAX_PLANS device-local plans
 * (patient vs aggressive side by side). Legacy v1 desks ({moves, chips})
 * migrate into a single Plan A.
 */

export interface DeskMove {
  out: number;
  in: number;
}

export interface DeskPlan {
  /** Stable slot id — a lowercase letter a–d. */
  id: string;
  name: string;
  moves: DeskMove[];
  /** chipKey → gw. */
  chips: Record<string, number>;
}

export interface PlansState {
  plans: DeskPlan[];
  active: string;
}

export const MAX_PLANS = 4;

const LETTERS = ["a", "b", "c", "d"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function planName(id: string): string {
  return `Plan ${id.toUpperCase()}`;
}

function sanitizeMoves(v: unknown): DeskMove[] {
  if (!Array.isArray(v)) return [];
  const moves: DeskMove[] = [];
  for (const m of v) {
    if (isRecord(m) && typeof m.out === "number" && typeof m.in === "number") {
      moves.push({ out: m.out, in: m.in });
    }
  }
  return moves;
}

function sanitizeChips(v: unknown): Record<string, number> {
  const chips: Record<string, number> = {};
  if (isRecord(v)) {
    for (const [k, n] of Object.entries(v)) {
      if (typeof n === "number") chips[k] = n;
    }
  }
  return chips;
}

function sanitizePlan(v: Record<string, unknown>): DeskPlan | null {
  const id = typeof v.id === "string" ? v.id.toLowerCase() : "";
  if (!LETTERS.includes(id)) return null;
  return { id, name: planName(id), moves: sanitizeMoves(v.moves), chips: sanitizeChips(v.chips) };
}

export function emptyPlans(): PlansState {
  return { plans: [{ id: "a", name: "Plan A", moves: [], chips: {} }], active: "a" };
}

/** Tolerant loader — current shape, legacy single-desk shape, or garbage → fresh. */
export function loadPlans(raw: string | null | undefined): PlansState {
  if (!raw) return emptyPlans();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyPlans();
  }
  if (!isRecord(parsed)) return emptyPlans();

  if (Array.isArray(parsed.plans)) {
    const plans = parsed.plans
      .map((p) => (isRecord(p) ? sanitizePlan(p) : null))
      .filter((p): p is DeskPlan => p !== null);
    if (plans.length > 0) {
      const active =
        typeof parsed.active === "string" && plans.some((p) => p.id === parsed.active)
          ? parsed.active
          : plans[0].id;
      return { plans, active };
    }
    return emptyPlans();
  }

  if (Array.isArray(parsed.moves) || isRecord(parsed.chips)) {
    return {
      plans: [
        {
          id: "a",
          name: planName("a"),
          moves: sanitizeMoves(parsed.moves),
          chips: sanitizeChips(parsed.chips),
        },
      ],
      active: "a",
    };
  }

  return emptyPlans();
}

export function activePlan(s: PlansState): DeskPlan {
  return s.plans.find((p) => p.id === s.active) ?? s.plans[0];
}

/** Map a mutation over the active plan only. */
export function withActive(s: PlansState, f: (p: DeskPlan) => DeskPlan): PlansState {
  return { ...s, plans: s.plans.map((p) => (p.id === s.active ? f(p) : p)) };
}

/** First free slot letter becomes the new active plan; slots stay letter-ordered. */
export function addPlan(s: PlansState): PlansState {
  const used = new Set(s.plans.map((p) => p.id));
  for (const id of LETTERS) {
    if (!used.has(id)) {
      const plans = [...s.plans, { id, name: planName(id), moves: [], chips: {} }].sort(
        (x, y) => LETTERS.indexOf(x.id) - LETTERS.indexOf(y.id),
      );
      return { plans, active: id };
    }
  }
  return s;
}

/** Never leaves zero plans — the last removal resets to one empty Plan A. */
export function removePlan(s: PlansState, id: string): PlansState {
  const remaining = s.plans.filter((p) => p.id !== id);
  if (remaining.length === 0) return emptyPlans();
  return { plans: remaining, active: s.active === id ? remaining[0].id : s.active };
}
