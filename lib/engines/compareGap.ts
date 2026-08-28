/**
 * Where the gap against a rival actually comes from.
 *
 * The compare pitch marks who differs. It never says what those differences
 * are worth, so you can look at two elevens, see a six-point deficit, and have
 * no idea whether it is their captain, a player you sold, or an auto-sub.
 *
 * The decomposition is exact and it is arithmetic, not a model: a manager's
 * score is the sum over his squad of points x multiplier, so the difference
 * between two managers is the sum over the UNION of their squads of the
 * difference in that product. Every point of the gap is attributable to
 * exactly one player, and the parts add up to the whole — there is a test for
 * that, because a decomposition that does not reconcile is worse than none.
 *
 * The subtlety worth naming: "shared" is about ownership, not about
 * contribution. Both of you owning Haaland means nothing if one of you
 * captained him — the same player is then worth a different amount to each
 * side, and that is very often the entire story of the week. Splitting by
 * ownership alone would hide the single biggest cause of a gap.
 */

export interface GapInput {
  element: number;
  webName: string;
  teamId: number;
  /** Raw FPL points for the player this gameweek, before any multiplier. */
  livePoints: number;
  /** 0 on the bench, 1 starting, 2 captained, 3 triple-captained. */
  multiplier: number;
}

export type GapReason = "only-you" | "only-them" | "captaincy" | "benching";

export interface GapRow {
  element: number;
  webName: string;
  teamId: number;
  /** What he scored for you, multiplier included. */
  yours: number;
  /** What he scored for them. */
  theirs: number;
  /** yours - theirs. Positive is in your favour. */
  delta: number;
  reason: GapReason;
}

const contribution = (row: GapInput): number => row.livePoints * row.multiplier;

/**
 * Why a player is worth a different amount to the two of you.
 *
 * Ownership first, because "they have someone you do not" is the plainest
 * reading. Where both own him, a differing multiplier is either a captaincy
 * call or a bench call, and those are different mistakes: one is a guess about
 * who scores, the other about who plays.
 */
function reasonFor(mine: GapInput | undefined, theirs: GapInput | undefined): GapReason {
  if (!theirs) return "only-you";
  if (!mine) return "only-them";
  const benched = mine.multiplier === 0 || theirs.multiplier === 0;
  return benched ? "benching" : "captaincy";
}

/**
 * Itemise the gap, biggest absolute swing first.
 *
 * Players who cost neither of you anything are dropped: a shared starter both
 * of you played is a genuine nil, and listing thirty nils to find the four
 * that matter is the problem this is meant to solve.
 */
export function itemiseGap(
  mine: GapInput[],
  theirs: GapInput[],
): { rows: GapRow[]; total: number } {
  const byMe = new Map(mine.map((r) => [r.element, r]));
  const byThem = new Map(theirs.map((r) => [r.element, r]));

  const rows: GapRow[] = [];
  for (const element of new Set([...byMe.keys(), ...byThem.keys()])) {
    const a = byMe.get(element);
    const b = byThem.get(element);
    const yours = a ? contribution(a) : 0;
    const opp = b ? contribution(b) : 0;
    const delta = yours - opp;
    if (delta === 0) continue;
    rows.push({
      element,
      // Either side can be the one who names him; they are the same player.
      webName: (a ?? b)!.webName,
      teamId: (a ?? b)!.teamId,
      yours,
      theirs: opp,
      delta,
      reason: reasonFor(a, b),
    });
  }

  rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || x.element - y.element);
  const total =
    mine.reduce((sum, r) => sum + contribution(r), 0) -
    theirs.reduce((sum, r) => sum + contribution(r), 0);
  return { rows, total };
}

/** The few that account for most of it — the headline, not the ledger. */
export function topSwings(rows: GapRow[], take = 3): GapRow[] {
  return rows.slice(0, take);
}

/** Plain words for a reason, in the second person. */
export function describeReason(row: GapRow): string {
  switch (row.reason) {
    case "only-you":
      return "only you own him";
    case "only-them":
      return "only they own him";
    case "captaincy":
      return row.yours > row.theirs ? "your captain" : "their captain";
    case "benching":
      return row.yours > row.theirs ? "they benched him" : "you benched him";
  }
}
