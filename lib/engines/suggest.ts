/**
 * suggest — the single transfers actually worth making, ranked.
 *
 * The Planner already stages moves and prices them; what it never did was
 * open with an answer. This is that answer: every legal one-for-one swap
 * priced over the horizon, best first, so the Board can end on "here is what
 * to do" rather than leaving you to find it.
 *
 * Three rules keep the list honest rather than long:
 *
 * 1. **Only legal moves.** Position, budget and the three-per-club cap all go
 *    through `checkSwap`, the same function the Planner enforces — a
 *    suggestion you cannot make is worse than no suggestion.
 * 2. **Each player appears once, on either side.** Ranking raw pairs fills the
 *    board with ten variations of "sell your worst defender", and — worse —
 *    offers the same signing against four different outgoings when you can
 *    only sign him once. The list is a greedy matching instead: best pair
 *    first, then the best pair among players neither side has used. What comes
 *    out is a set of moves you could make together, not a set of alternatives
 *    dressed up as a plan.
 * 3. **No suggestion that loses points.** A swap has to be worth the free
 *    transfer to appear at all.
 *
 * Pure functions only.
 */
import { checkSwap, windowPoints, type PlannerPlayer } from "@/lib/engines/planner";

export interface Suggestion {
  outId: number;
  inId: number;
  /** Projected points across the window for each side. */
  outPoints: number;
  inPoints: number;
  /** inPoints − outPoints, the reason to do it. */
  gain: number;
  /** Cost in tenths: positive spends money, negative frees it. */
  spend: number;
  /** Money left after the move, in tenths. */
  bankAfter: number;
}

export interface SuggestInput {
  /** Your fifteen. */
  squad: PlannerPlayer[];
  /** Everyone selectable, your fifteen included — filtered out internally. */
  market: PlannerPlayer[];
  bankTenths: number;
  /** What FPL would credit for one of yours, in tenths. */
  sellPriceOf: (id: number) => number;
  /** Gameweeks of the horizon to price over. */
  weeks: number;
  /** How many suggestions to return. */
  limit?: number;
  /**
   * Ignore anyone under this many minutes. A player with no minutes has no
   * projection worth trusting, and suggesting one is how a desk loses you a
   * gameweek — but a fixed floor empties the board in the opening weeks, when
   * nobody has played much. Callers pass a floor that scales with the season
   * (`defaultMinutesFloor`); the default of zero keeps the engine itself
   * opinion-free.
   */
  minMinutes?: number;
}

const DEFAULT_LIMIT = 5;

/** Every legal one-for-one swap worth making, best first. */
export function suggestTransfers(input: SuggestInput): Suggestion[] {
  const { squad, market, bankTenths, sellPriceOf, weeks } = input;
  const limit = input.limit ?? DEFAULT_LIMIT;
  const minMinutes = input.minMinutes ?? 0;

  const squadIds = squad.map((p) => p.id);
  const owned = new Set(squadIds);
  const byId = new Map<number, PlannerPlayer>();
  for (const p of [...market, ...squad]) byId.set(p.id, p);

  const ctx = {
    squadIds,
    bankTenths,
    playerOf: (id: number) => byId.get(id),
    sellPriceOf,
  };

  // Candidates are scored once, not once per squad player.
  const candidates = market
    .filter((p) => !owned.has(p.id))
    .filter((p) => p.minutes >= minMinutes)
    // A flagged player is a gamble, not a recommendation. The projection
    // already dampens them; this keeps them off the board entirely.
    .filter((p) => p.status === "a")
    .map((p) => ({ p, points: windowPoints(p.horizon, weeks) }));

  const pairs: Suggestion[] = [];

  for (const out of squad) {
    const outPoints = windowPoints(out.horizon, weeks);
    const sell = sellPriceOf(out.id);

    for (const { p: incoming, points } of candidates) {
      if (incoming.pos !== out.pos) continue;
      const gain = round1(points - outPoints);
      if (gain <= 0) continue;
      // Cheaper to reject on arithmetic before the full rules check.
      if (incoming.cost > bankTenths + sell) continue;
      if (!checkSwap(out.id, incoming.id, ctx).ok) continue;

      pairs.push({
        outId: out.id,
        inId: incoming.id,
        outPoints,
        inPoints: points,
        gain,
        spend: incoming.cost - sell,
        bankAfter: bankTenths + sell - incoming.cost,
      });
    }
  }

  // Greedy matching: best pair first, then the best pair among players
  // neither side has spent. Ties break on the cheaper move and then on id, so
  // the same squad and market always produce the same board.
  pairs.sort((a, b) => b.gain - a.gain || a.spend - b.spend || a.outId - b.outId || a.inId - b.inId);

  const usedOut = new Set<number>();
  const usedIn = new Set<number>();
  const chosen: Suggestion[] = [];
  for (const pair of pairs) {
    if (chosen.length >= limit) break;
    if (usedOut.has(pair.outId) || usedIn.has(pair.inId)) continue;
    usedOut.add(pair.outId);
    usedIn.add(pair.inId);
    chosen.push(pair);
  }
  return chosen;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** "£0.5m more" / "frees £1.2m" / "same price" — the money in one phrase. */
export function spendLabel(spendTenths: number): string {
  if (spendTenths === 0) return "same price";
  const m = (Math.abs(spendTenths) / 10).toFixed(1);
  return spendTenths > 0 ? `£${m}m more` : `frees £${m}m`;
}
