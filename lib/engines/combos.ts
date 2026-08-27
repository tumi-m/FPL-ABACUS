/**
 * combos — what two players are worth together, and against somebody else's two.
 *
 * FPL is not a game of picking good players. It is a game of picking good
 * players *for the money*, and almost every real decision is a combination
 * rather than a single name: Wirtz and Isak, or Haaland and whoever fifteen
 * million is left over will buy. A board of best players cannot answer that,
 * because the best players are the expensive ones and it says so every week.
 *
 * Two ideas do the work here.
 *
 * **A combination is scored as one asset.** Cost, points, expected
 * involvement and minutes all sum; ownership does not — two players owned by
 * 40% each are not owned by 80% of the game, so the template read is their
 * average. Clubs are counted rather than summed, because two players from one
 * club is one blank, one bad afternoon, and one manager's rotation.
 *
 * **Sides are compared at equal spend.** Comparing £14.0m of players against
 * £15.5m of players and declaring the second better is not analysis, it is
 * arithmetic with a hole in it: the cheaper side has one and a half million
 * still to spend. So the cheaper side is credited with what that money buys at
 * replacement level — the going rate of a playing enabler, measured from the
 * league rather than assumed — and only then are the two totals compared.
 *
 * Pure functions only. Composition happens on the server.
 */

export interface ComboPlayer {
  id: number;
  name: string;
  pos: number;
  teamId: number;
  /** Tenths of a million, as FPL stores it. */
  cost: number;
  points: number;
  minutes: number;
  starts: number;
  goals: number;
  assists: number;
  xg: number;
  xa: number;
  xgi: number;
  bonus: number;
  /** Percent of the game that owns him. */
  owned: number;
}

export interface Combo {
  /** Stable identity: the member ids, ascending, joined. */
  key: string;
  players: ComboPlayer[];
  /** Millions. */
  cost: number;
  points: number;
  xg: number;
  xa: number;
  xgi: number;
  goals: number;
  assists: number;
  bonus: number;
  minutes: number;
  starts: number;
  /** Points per million spent — the only figure that ranks across budgets. */
  ppm: number;
  /** Expected involvement per million. */
  xgiPerM: number;
  /** Mean ownership across the members, not the sum. */
  owned: number;
  /** Distinct clubs. Two players from one club share every blank. */
  clubs: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Score a set of players as one asset. */
export function buildCombo(players: ComboPlayer[]): Combo {
  const sum = (f: (p: ComboPlayer) => number) => players.reduce((s, p) => s + f(p), 0);
  const cost = sum((p) => p.cost) / 10;
  const points = sum((p) => p.points);
  const xgi = sum((p) => p.xgi);

  return {
    key: players.map((p) => p.id).sort((a, b) => a - b).join("-"),
    players,
    cost: round2(cost),
    points,
    xg: round2(sum((p) => p.xg)),
    xa: round2(sum((p) => p.xa)),
    xgi: round2(xgi),
    goals: sum((p) => p.goals),
    assists: sum((p) => p.assists),
    bonus: sum((p) => p.bonus),
    minutes: sum((p) => p.minutes),
    starts: sum((p) => p.starts),
    ppm: cost > 0 ? round2(points / cost) : 0,
    xgiPerM: cost > 0 ? round2(xgi / cost) : 0,
    owned: players.length ? round2(sum((p) => p.owned) / players.length) : 0,
    clubs: new Set(players.map((p) => p.teamId)).size,
  };
}

/**
 * Every pair the pool can make.
 *
 * Quadratic, which is why the pool is a shortlist rather than the market: a
 * hundred players is 4,950 pairs and instant, seven hundred is 244,650 and a
 * frozen tab. The shortlist is the caller's job.
 */
export function allPairs(pool: ComboPlayer[]): Combo[] {
  const out: Combo[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      out.push(buildCombo([pool[i], pool[j]]));
    }
  }
  return out;
}

export type ComboSort = "points" | "ppm" | "xgi" | "cheap" | "differential";

const SORTERS: Record<ComboSort, (a: Combo, b: Combo) => number> = {
  points: (a, b) => b.points - a.points,
  ppm: (a, b) => b.ppm - a.ppm,
  xgi: (a, b) => b.xgi - a.xgi,
  cheap: (a, b) => a.cost - b.cost,
  // the pair the field is least likely to already own
  differential: (a, b) => a.owned - b.owned,
};

export function rankCombos(combos: Combo[], by: ComboSort, take: number): Combo[] {
  const tie = (a: Combo, b: Combo) => b.points - a.points || a.key.localeCompare(b.key);
  return [...combos].sort((a, b) => SORTERS[by](a, b) || tie(a, b)).slice(0, take);
}

/**
 * The going rate of a bench-adjacent enabler, in points per million.
 *
 * This is what a spare million actually buys, so it is what an unequal
 * comparison has to be settled in. It is measured, not assumed: the median
 * points-per-million among cheap players who are genuinely playing. The median
 * rather than the mean, because one £4.5m defender on a hot streak should not
 * move the exchange rate for the whole board.
 *
 * A league with nobody cheap and playing — the opening weeks — returns zero,
 * which makes the comparison fall back to raw totals and say so.
 */
export function replacementRate(pool: ComboPlayer[], maxCost = 55, minMinutes = 450): number {
  const rates = pool
    .filter((p) => p.cost <= maxCost && p.minutes >= minMinutes && p.cost > 0)
    .map((p) => p.points / (p.cost / 10))
    .sort((a, b) => a - b);
  if (rates.length === 0) return 0;
  const mid = Math.floor(rates.length / 2);
  return round2(rates.length % 2 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2);
}

export interface HeadToHead {
  a: Combo;
  b: Combo;
  /** Millions the cheaper side still has in the bank. */
  spare: number;
  /** Which side the spare belongs to, or null when they cost the same. */
  spareOn: "a" | "b" | null;
  /** Points that spare buys at replacement level. */
  spareWorth: number;
  /** Each side's points once the spare is credited. */
  adjustedA: number;
  adjustedB: number;
  /** Adjusted A minus adjusted B. Positive means A wins. */
  margin: number;
  /** True when there was no replacement rate to settle the gap with. */
  unpriced: boolean;
}

/**
 * Put two sides against each other at the same spend.
 *
 * The margin is the whole point: it is what you would actually gain or lose by
 * making the swap, once the money left over has somewhere to go.
 */
export function headToHead(a: Combo, b: Combo, rate: number): HeadToHead {
  const spare = round2(Math.abs(a.cost - b.cost));
  const spareOn = a.cost === b.cost ? null : a.cost < b.cost ? "a" : "b";
  const spareWorth = round2(spare * rate);
  const adjustedA = round2(a.points + (spareOn === "a" ? spareWorth : 0));
  const adjustedB = round2(b.points + (spareOn === "b" ? spareWorth : 0));

  return {
    a,
    b,
    spare,
    spareOn,
    spareWorth,
    adjustedA,
    adjustedB,
    margin: round2(adjustedA - adjustedB),
    unpriced: rate <= 0 && spare > 0,
  };
}

/**
 * The label for a combination's budget bracket.
 *
 * Bracketing is what makes a board of pairs readable: within a bracket every
 * row is a real alternative to every other, because they cost the same money.
 */
export function costBand(cost: number, width = 2): string {
  const lo = Math.floor(cost / width) * width;
  return `£${lo.toFixed(1)}–${(lo + width).toFixed(1)}m`;
}

/**
 * The best of the affordable, bracket by bracket.
 *
 * Sorting a thousand pairs by points hands back the thousand most expensive
 * ones. Taking the leader of each bracket instead gives a ladder you can
 * actually shop from: this is the most you can get for twelve million, this is
 * the most for fourteen, and here is what the extra two million bought.
 */
export function bandLeaders(combos: Combo[], by: ComboSort = "points", width = 2): Combo[] {
  const best = new Map<string, Combo>();
  for (const c of combos) {
    const band = costBand(c.cost, width);
    const held = best.get(band);
    if (!held || SORTERS[by](c, held) < 0) best.set(band, c);
  }
  return [...best.values()].sort((a, b) => a.cost - b.cost);
}

/**
 * The pairs nothing else beats on both money and points.
 *
 * A pair that costs more AND scores less than another is never the right
 * answer, whatever your budget. What is left is the efficient frontier, and it
 * is the shortlist worth arguing about.
 */
export function frontier(combos: Combo[]): Combo[] {
  const byCost = [...combos].sort((a, b) => a.cost - b.cost || b.points - a.points);
  const out: Combo[] = [];
  let ceiling = -Infinity;
  for (const c of byCost) {
    if (c.points > ceiling) {
      out.push(c);
      ceiling = c.points;
    }
  }
  return out;
}
