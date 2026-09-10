import { type PercentileRead, type StatRow } from "@/lib/engines/playerPercentiles";

/**
 * playerRadar — six axes, the way a football card draws them.
 *
 * Percentiles are already the right shape for a radar: `buildPercentiles`
 * ranks a player inside his own position and has already inverted the axes
 * where a low number is the good one, so 100 always points outward and 0
 * always points in. Nothing here computes a figure; it selects six of them
 * and puts them in a fixed order.
 *
 * ── Why the axes differ by position
 *
 * A card for a goalkeeper does not show shooting. Neither should this, and
 * not only for taste: an axis where every player in the cohort scores zero
 * gives all of them the median by construction — `percentileOf` returns 50
 * when a pool is entirely tied — so a keeper's expected-goals axis would draw
 * at half height and read as "average finisher for a keeper" when what it
 * actually means is "nobody in this cohort has ever had a shot". A radar's
 * whole claim is that its shape means something, so an axis that cannot mean
 * anything for a position is not offered to that position.
 *
 * ── Why six
 *
 * Not an aesthetic choice either. Fewer than three has no area to read and
 * more than about eight stops being a shape and becomes a wheel of spokes
 * nobody compares. Six is what the games settled on for the same reason.
 */

export interface RadarAxis {
  /** The stat key it came from, so the panel below can be cross-referenced. */
  key: string;
  /** The full name, for the list beside the shape. */
  label: string;
  /**
   * Three or four characters, for the point of the hexagon.
   *
   * The games use PAC SHO PAS DRI DEF PHY for a reason that is not only
   * style: a word long enough to be unambiguous is long enough to overhang
   * the web and be clipped by the viewBox, which is what "ALUE" and "URNS"
   * looked like before this field existed. The full name is a few pixels away
   * in the list, so the point can afford to be terse.
   */
  short: string;
  /** 0–100, outward is better, already inverted where it needed to be. */
  percentile: number;
  /** The underlying figure, so the shape is never the only evidence. */
  display: string;
  hint: string;
}

export interface PlayerRadar {
  axes: RadarAxis[];
  /** How many same-position players the shape is drawn against. */
  cohortSize: number;
  /** Mean of the axes — one number for "how good is this shape". */
  overall: number;
}

/** Below three axes there is no area to read, so no radar is offered. */
export const MIN_AXES = 3;

/**
 * Which six, per position, and what to call them on a hexagon.
 *
 * The labels are the card's language rather than the stat panel's: the panel
 * below the radar says "Expected goals" and carries the hint, so the point of
 * the hexagon can afford to say THREAT.
 */
const OUTFIELD: { key: string; label: string; short: string }[] = [
  { key: "xg", label: "Threat", short: "THR" },
  { key: "xa", label: "Creation", short: "CRE" },
  { key: "points", label: "Returns", short: "RET" },
  { key: "bps", label: "Bonus", short: "BPS" },
  { key: "defcon", label: "Defence", short: "DEF" },
  { key: "perMillion", label: "Value", short: "VAL" },
];

const KEEPER: { key: string; label: string; short: string }[] = [
  { key: "saves", label: "Saves", short: "SAV" },
  { key: "cleanSheets", label: "Clean sheets", short: "CS" },
  // Already inverted by the percentile engine: outward means fewer conceded.
  { key: "conceded", label: "Solidity", short: "SOL" },
  { key: "bps", label: "Bonus", short: "BPS" },
  { key: "points", label: "Returns", short: "RET" },
  { key: "perMillion", label: "Value", short: "VAL" },
];

const GOALKEEPER = 1;

export function buildRadar(read: PercentileRead, position: number): PlayerRadar | null {
  const wanted = position === GOALKEEPER ? KEEPER : OUTFIELD;
  const byKey = new Map<string, StatRow>();
  for (const group of read.groups) {
    for (const row of group.rows) byKey.set(row.key, row);
  }

  const axes: RadarAxis[] = [];
  for (const { key, label, short } of wanted) {
    const row = byKey.get(key);
    // A null percentile means the cohort was too small to rank against. It is
    // dropped rather than drawn at zero, which would read as "worst in his
    // position" instead of "not enough players to say".
    if (!row || row.percentile == null) continue;
    axes.push({
      key,
      label,
      short,
      percentile: row.percentile,
      display: row.display,
      hint: row.hint,
    });
  }

  if (axes.length < MIN_AXES) return null;

  const overall = Math.round(axes.reduce((t, a) => t + a.percentile, 0) / axes.length);
  return { axes, cohortSize: read.cohortSize, overall };
}
