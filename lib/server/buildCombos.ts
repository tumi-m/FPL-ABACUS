import "server-only";

/**
 * Server composition for the combination board.
 *
 * The pairing is quadratic, so the shortlist is the whole design. A hundred
 * players is 4,950 pairs and computes in a blink; the seven hundred in the
 * game is a quarter of a million and a page nobody waits for. The shortlist is
 * the players anybody would actually consider — enough minutes to have a
 * season behind the numbers, ranked by what they have scored — which is also
 * the only pool where a pair *means* anything.
 *
 * Only the ranked boards and the shortlist cross the wire. The pairs
 * themselves stay here.
 */
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getPicks } from "@/lib/fpl/endpoints";
import { defaultMinutesFloor } from "@/lib/engines/performance";
import {
  allPairs,
  bandLeaders,
  frontier,
  rankCombos,
  replacementRate,
  type Combo,
  type ComboPlayer,
} from "@/lib/engines/combos";
import { withDeadline, ENHANCEMENT_MS } from "@/lib/server/deadline";

/** How many players get paired. Squared, this is the work. */
const POOL = 90;
/** How many pairs each board carries. */
const TOP = 30;

export interface ComboBoard {
  gw: number;
  /** The shortlist, for the head-to-head picker. */
  pool: ComboPlayer[];
  /** The thirty best pairs by total points. */
  best: Combo[];
  /** The thirty best pairs by points per million. */
  value: Combo[];
  /** The thirty least-owned pairs among the shortlist. */
  differential: Combo[];
  /** The best pair inside each two-million bracket, cheapest first. */
  ladder: Combo[];
  /** Pairs nothing beats on both money and points. */
  frontier: Combo[];
  /** Points per million of a playing enabler — the exchange rate. */
  rate: number;
  /** Minutes a player needed to make the shortlist. */
  floor: number;
  /** Ids you already own, so the board can mark them. */
  owned: number[];
}

export async function buildComboBoard(teamId: number | null): Promise<ComboBoard> {
  const boot = await getBootstrapLite();
  const gw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);

  const everyone = Object.values(boot.elements).filter((el) => el.status !== "u");
  // Early in a season nobody has 450 minutes, and a fixed floor would empty
  // the board; the engine's own floor follows the league instead.
  const floor = defaultMinutesFloor(everyone);

  const pool: ComboPlayer[] = everyone
    .filter((el) => el.minutes >= floor && el.total_points > 0)
    .sort((a, b) => b.total_points - a.total_points)
    .slice(0, POOL)
    .map((el) => ({
      id: el.id,
      name: el.web_name,
      pos: el.element_type,
      teamId: el.team,
      cost: el.now_cost,
      points: el.total_points,
      minutes: el.minutes,
      starts: el.starts,
      goals: el.goals_scored,
      assists: el.assists,
      xg: el.xgTotal,
      xa: el.xaTotal,
      xgi: el.xgiTotal,
      bonus: el.bonus,
      owned: el.selected_by_percent,
    }));

  const pairs = allPairs(pool);
  // The exchange rate comes from the whole market, not the shortlist: the
  // shortlist has no enablers in it by construction.
  const rate = replacementRate(
    everyone.map((el) => ({
      id: el.id,
      name: el.web_name,
      pos: el.element_type,
      teamId: el.team,
      cost: el.now_cost,
      points: el.total_points,
      minutes: el.minutes,
      starts: el.starts,
      goals: el.goals_scored,
      assists: el.assists,
      xg: el.xgTotal,
      xa: el.xaTotal,
      xgi: el.xgiTotal,
      bonus: el.bonus,
      owned: el.selected_by_percent,
    })),
    55,
    Math.min(450, floor),
  );

  const owned = teamId
    ? await withDeadline(ownedIds(teamId, gw), ENHANCEMENT_MS, [])
    : [];

  return {
    gw,
    pool,
    best: rankCombos(pairs, "points", TOP),
    value: rankCombos(pairs, "ppm", TOP),
    differential: rankCombos(pairs, "differential", TOP),
    ladder: bandLeaders(pairs, "points", 2),
    frontier: frontier(pairs),
    rate,
    floor,
    owned,
  };
}

async function ownedIds(teamId: number, gw: number): Promise<number[]> {
  const picks = await getPicks(teamId, gw, true);
  return picks.picks.map((p) => p.element);
}
