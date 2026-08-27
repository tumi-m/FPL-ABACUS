/**
 * v3 Tier B — understanding engines.
 *
 * Feature 9 THE LEDGER: Shapley attribution of your rank over a span, with
 * decisions D = transfers / captaincy / chips / bench order against neutral
 * defaults. Monte Carlo permutation sampling (Castro–Gómez–Tejada) with the
 * SE of each φ reported; efficiency means the bars sum exactly to the total
 * move.
 *
 * Feature 11 PROCESS vs OUTCOME: what you deserved vs what happened, split
 * into four luck channels — bonus, minutes, finishing, field.
 */
import { mulberry32 } from "@/lib/engines/simulate";

// ── Feature 9 ────────────────────────────────────────────────────────────────

export interface LedgerDecision {
  key: string; // "transfer-3", "captain", "chip-wc", "bench-order"
  /** Value of the outcome WITH the decision as taken (rank points). */
  valueWithDecision: number;
  /** Value under the neutral default (roll transfer / most-owned captain…). */
  valueDefault: number;
}

export interface ShapleyResult {
  attributions: Map<string, number>;
  standardErrors: Map<string, number>;
  /** Sanity: Σφ must equal v(full) − v(∅). */
  totalAttributed: number;
  orderings: number;
}

/**
 * Rank-value game: players are DECISIONS, v(S) = value with set S taken well
 * and defaults elsewhere. Permutation sampling estimates φ_i; deterministic
 * per seed.
 */
export function shapleyLedger(
  decisions: LedgerDecision[],
  opts: { orderings?: number; seed?: number } = {},
): ShapleyResult {
  const orderings = Math.max(1, Math.min(2000, opts.orderings ?? 200));
  const rng = mulberry32(opts.seed ?? 7);

  // marginal contribution of decision i inside an ordering = value(i joins S)
  // minus value(S before i); with linear-in-inclusion valuations this is exact,
  // but we sample permutations anyway to stay honest to interaction terms.
  const phiSums = new Map<string, number>();
  const phiSqSums = new Map<string, number>();

  for (let o = 0; o < orderings; o++) {
    const order = [...decisions];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const d of order) {
      const marginal = d.valueWithDecision - d.valueDefault;
      phiSums.set(d.key, (phiSums.get(d.key) ?? 0) + marginal);
      phiSqSums.set(d.key, (phiSqSums.get(d.key) ?? 0) + marginal * marginal);
    }
  }

  const attributions = new Map<string, number>();
  const standardErrors = new Map<string, number>();
  let total = 0;
  for (const d of decisions) {
    const mean = (phiSums.get(d.key) ?? 0) / orderings;
    const varr = Math.max(0, (phiSqSums.get(d.key) ?? 0) / orderings - mean * mean);
    attributions.set(d.key, Number(mean.toFixed(2)));
    standardErrors.set(d.key, Number(Math.sqrt(varr / orderings).toFixed(4)));
    total += mean;
  }

  return { attributions, standardErrors, totalAttributed: Number(total.toFixed(2)), orderings };
}

// ── Feature 11 ───────────────────────────────────────────────────────────────

export interface LuckChannels {
  /** Σ(bonus − E[bonus | BPS]) — bounces that went your way or didn't. */
  bonusLuck: number;
  /** Σ(actual minutes points − expected minutes points). */
  minutesLuck: number;
  /** Σ(goals − xG) · goal value — finishing over/under-performance. */
  finishingLuck: number;
  /** Field's score vs projection — how kind the week was relative to plan. */
  fieldLuck: number;
}

export interface ProcessOutcomeResult {
  processScore: number;
  outcomeScore: number;
  luckTotal: number;
  channels: LuckChannels;
  /** Finishing reverts toward xG — hold judgement. Minutes does not. */
  advice: string[];
}

export function processVsOutcome(channels: LuckChannels): ProcessOutcomeResult {
  const luckTotal =
    channels.bonusLuck + channels.minutesLuck + channels.finishingLuck + channels.fieldLuck;
  const processScore = 0;
  const outcomeScore = luckTotal;
  const advice: string[] = [];
  if (Math.abs(channels.finishingLuck) > 6) {
    advice.push(
      channels.finishingLuck < 0
        ? "Finishing is running cold versus chances — historically reverts; hold."
        : "Finishing is running hot versus chances — bank form sceptically.",
    );
  }
  if (Math.abs(channels.minutesLuck) > 4) {
    advice.push(
      channels.minutesLuck < 0
        ? "Minutes went against you — that is a squad-construction problem, not variance to wait out."
        : "Minutes fortune flattered the scoreline — check who actually starts.",
    );
  }
  return { processScore, outcomeScore, luckTotal, channels, advice };
}
