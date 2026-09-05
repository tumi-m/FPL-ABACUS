/**
 * solver/beam — the branching multi-gameweek transfer planner (v10 D6).
 *
 * The gap Solio and FPL Review own: GAFFER priced one window, they optimise
 * across a branching gameweek tree with risk as an explicit parameter. This
 * closes it without a MILP and without a browser-hosted optimizer: a beam
 * search over the tree, scored by projected points with an explicit risk
 * trade, pruned to the top-K states per gameweek so a six-week horizon
 * stays inside a request budget.
 *
 * State = (squad ids, bank, free transfers left, hits taken, gameweek).
 * Branch = every legal move from checkSwap, plus "roll". Legality is
 * `checkSwap` — the Planner's own engine — so a plan the beam returns is a
 * plan you can actually make.
 *
 * Score = Σ projected points over the horizon − 4 × hits, with a risk
 * adjustment: λ (0 = maximise the mean, 1 = shield the tail) trades
 * expected points against the worst week. λ is the persona posture from
 * B3 — "ask Ana" — never a slider of jargon.
 *
 * The result is the best plan FOUND, not the best possible — beam search is
 * a heuristic, and the UI says so: it states the horizon, the beam width
 * and that the search is not a proof of optimality. Claiming optimality you
 * cannot prove is the same sin as inventing a number.
 *
 * Deterministic: a fixed squad and fixed projections return a stable plan.
 * Pure functions only.
 */
import { checkSwap, windowPoints, type PlannerPlayer } from "@/lib/engines/planner";

/** How many states survive each gameweek's cut. */
export const BEAM_WIDTH = 50;
/** FPL's cost per transferred point — the hit price, in points. */
export const HIT_POINTS = 4;

export interface SolverMove {
  out: number;
  in: number;
  /** The gameweek the move is made for, 1-indexed within the horizon. */
  gw: number;
}

export interface SolverState {
  /** Working fifteen, in no order. */
  squadIds: number[];
  bankTenths: number;
  freeTransfers: number;
  hits: number;
  /** Moves so far, in order. */
  moves: SolverMove[];
  /** Σ projected points over the horizon so far, hits priced in. */
  score: number;
  /** Per-horizon-gameweek points of the working squad's best XI. */
  perGw: number[];
}

export interface SolveInput {
  squad: PlannerPlayer[];
  market: PlannerPlayer[];
  bankTenths: number;
  /** What FPL would credit for one of yours, in tenths. */
  sellPriceOf: (id: number) => number;
  /** Gameweeks of horizon. */
  weeks: number;
  /**
   * Risk posture: 0 maximises expected points, 1 shields the worst week.
   * Passed as the persona posture — named in the UI, never a bare number.
   */
  risk: number;
  /** Beam width override — tests pin it. */
  beamWidth?: number;
  /** Ignore candidates under this many minutes. */
  minMinutes?: number;
}

export interface SolveResult {
  /** The best plan found. */
  moves: SolverMove[];
  /** Its Σ points over the horizon, hits priced in. */
  score: number;
  /** The per-gameweek points of the working squad along the plan. */
  perGw: number[];
  /** The worst horizon week of the returned plan. */
  worstGwPoints: number;
  /** Hits the plan takes, priced. */
  hits: number;
  /** The heuristic's own honest disclaimer inputs. */
  horizon: number;
  beamWidth: number;
  /** States the beam expanded in total — "the best found" evidence. */
  explored: number;
}

interface Ctx {
  byId: Map<number, PlannerPlayer>;
  sellPriceOf: (id: number) => number;
  weeks: number;
  risk: number;
  beamWidth: number;
  minMinutes: number;
  explored: number;
}

/**
 * Solve the multi-gameweek plan.
 *
 * One gameweek per step. Each state branches into: no move (roll), and
 * every legal one-for-one swap — priced as a hit when the free transfers
 * are spent. States are cut to the beam; the winner is the best leaf.
 */
export function solvePlan(input: SolveInput): SolveResult {
  const beamWidth = input.beamWidth ?? BEAM_WIDTH;
  const ctx: Ctx = {
    byId: new Map<number, PlannerPlayer>(),
    sellPriceOf: input.sellPriceOf,
    weeks: input.weeks,
    risk: input.risk,
    beamWidth,
    minMinutes: input.minMinutes ?? 0,
    explored: 0,
  };
  for (const p of [...input.market, ...input.squad]) ctx.byId.set(p.id, p);

  const start: SolverState = {
    squadIds: input.squad.map((p) => p.id),
    bankTenths: input.bankTenths,
    freeTransfers: 1,
    hits: 0,
    moves: [],
    score: 0,
    perGw: [],
  };

  let beam: SolverState[] = [start];
  for (let gw = 1; gw <= input.weeks; gw++) {
    const next: SolverState[] = [];
    for (const state of beam) {
      next.push(...expand(state, gw, ctx));
    }
    ctx.explored += next.length;
    beam = prune(next, beamWidth);
  }

  const best = beam.reduce((a, b) => (finalScore(b, ctx.risk) > finalScore(a, ctx.risk) ? b : a));
  return {
    moves: best.moves,
    score: round1(best.score),
    perGw: best.perGw.map(round1),
    worstGwPoints: best.perGw.length ? round1(Math.min(...best.perGw)) : 0,
    hits: best.hits,
    horizon: input.weeks,
    beamWidth,
    explored: ctx.explored,
  };
}

/** Every successor of one state at one gameweek. */
function expand(state: SolverState, gw: number, ctx: Ctx): SolverState[] {
  const out: SolverState[] = [];
  const owned = new Set(state.squadIds);
  const byId = ctx.byId;
  const remaining = ctx.weeks - (gw - 1);

  // Roll — hold, bank the transfer.
  const rolled: SolverState = {
    ...state,
    freeTransfers: Math.min(5, state.freeTransfers + 1),
    perGw: [...state.perGw, teamPoints(state.squadIds, gw, ctx)],
  };
  rolled.score += rolled.perGw[rolled.perGw.length - 1];
  out.push(rolled);

  const squad = state.squadIds
    .map((id) => byId.get(id))
    .filter((p): p is PlannerPlayer => p != null);
  const candidates = [...byId.values()]
    .filter((p) => !owned.has(p.id))
    .filter((p) => p.minutes >= ctx.minMinutes)
    // A flagged player is a gamble, not a plan.
    .filter((p) => p.status === "a");

  for (const outP of squad) {
    const sell = ctx.sellPriceOf(outP.id);
    const outPoints = windowPoints(outP.horizon, remaining);
    for (const inc of candidates) {
      if (inc.pos !== outP.pos) continue;
      if (inc.cost > state.bankTenths + sell) continue;
      // Legality — the Planner's own rule, never re-derived here.
      if (
        !checkSwap(outP.id, inc.id, {
          squadIds: state.squadIds,
          bankTenths: state.bankTenths + sell,
          playerOf: (id) => byId.get(id),
          sellPriceOf: ctx.sellPriceOf,
        }).ok
      ) {
        continue;
      }

      const gain = windowPoints(inc.horizon, remaining) - outPoints;
      const asHit = state.freeTransfers <= 0;
      // A hit has to pay for itself — a move that cannot clear the −4 in
      // the remaining weeks is not a branch worth holding.
      if (asHit && gain < HIT_POINTS * 0.75) continue;

      const squadIds = state.squadIds.map((id) => (id === outP.id ? inc.id : id));
      const weekPts = teamPoints(squadIds, gw, ctx);
      const hitCost = asHit ? HIT_POINTS : 0;
      const next: SolverState = {
        squadIds,
        bankTenths: state.bankTenths + sell - inc.cost,
        freeTransfers: asHit ? 1 : state.freeTransfers - 1,
        hits: state.hits + (asHit ? 1 : 0),
        moves: [...state.moves, { out: outP.id, in: inc.id, gw }],
        score: state.score + weekPts - hitCost,
        perGw: [...state.perGw, weekPts - hitCost],
      };
      out.push(next);
    }
  }

  return out;
}

/**
 * One gameweek's projected points for a squad — its best XI.
 *
 * The better keeper plays; the ten highest outfield projections fill the
 * rest of the XI. Formation is an approximation (the real XI is the
 * Field's job; this is a planning surface and the UI says so) — but a
 * keeper is never benched for a striker, which is the one formation rule
 * that would badly distort the plan if ignored.
 */
function teamPoints(squadIds: number[], gw: number, ctx: Ctx): number {
  const idx = gw - 1;
  const keeperRows: number[] = [];
  const outfield: number[] = [];
  for (const id of squadIds) {
    const p = ctx.byId.get(id);
    if (!p) continue;
    const pts = p.horizon?.[idx] ?? 0;
    if (p.pos === 1) keeperRows.push(pts);
    else outfield.push(pts);
  }
  keeperRows.sort((a, b) => b - a);
  outfield.sort((a, b) => b - a);
  const keeper = keeperRows[0] ?? 0;
  return round1(keeper + outfield.slice(0, 10).reduce((a, b) => a + b, 0));
}

function finalScore(s: SolverState, risk: number): number {
  // The risk trade: the mean is already the score; the penalty scales with
  // the worst week's shortfall. λ=0 maximises the mean, λ=1 shields the
  // tail — a plan with a 0-point week loses the tie even on equal mean.
  if (risk <= 0 || s.perGw.length === 0) return s.score;
  const worst = Math.min(...s.perGw);
  const mean = s.score / s.perGw.length;
  const shortfall = Math.max(0, mean - worst);
  return s.score - risk * shortfall;
}

function prune(states: SolverState[], width: number): SolverState[] {
  if (states.length <= width) return states;
  return states
    .sort((a, b) => finalScore(b, 0) - finalScore(a, 0))
    .slice(0, width);
}

const round1 = (v: number) => Math.round(v * 10) / 10;