/**
 * gwProfile — the personal blank/double calendar (v10 D7).
 *
 * Ben Crellin's spreadsheet is the most-consulted artifact in FPL and it is
 * universal: it tells everyone the same thing. A calendar that knows your
 * fifteen tells you something — GW29 you have 9 starters, GW33 you have 14
 * and two doubles — and chip windows fall straight out of it, because the
 * best Bench Boost week is simply your fullest week.
 *
 * Two honesty rules shape everything:
 *
 * 1. **Published fixtures are facts; cup rounds are probabilities.** FPL's
 *    fixture list carries the Premier League rounds it has scheduled. A
 *    blank or a double can still be caused by an unplayed FA Cup round, and
 *    FPL does not publish those fixtures until the cup ties are drawn. So a
 *    gameweek whose fixtures are already in the list is "scheduled"; one
 *    whose status still depends on a cup round is "possible", and the label
 *    says so — never assert as confirmed what FPL has not published.
 * 2. **Your starters are your XI, not your fifteen.** A double for a bench
 *    keeper is worth nothing to your score. The profile counts the eleven
 *    who would start; the squad count rides beside it as the tie-breaker
 *    between two full weeks.
 *
 * Pure functions only.
 */
import type { Fixture } from "@/lib/fpl/schemas";

/** One gameweek's row in the personal calendar. */
export interface GwProfileRow {
  gw: number;
  /** How many of the XI have a fixture — the headline number. */
  startersPlaying: number;
  /** Doubles among the XI (players with 2+ fixtures). */
  starterDoubles: number;
  /** Blanks among the XI (players with 0 fixtures). */
  starterBlanks: number;
  /** How many of your fifteen have a fixture, for the detail row. */
  squadPlaying: number;
  /**
   * The profile's confidence, in FPL's own terms:
   *   scheduled — every fixture this row reads is in FPL's published list.
   *   possible  — the row sits beyond the scheduled horizon, where a cup
   *               round FPL has not yet scheduled can still move it.
   */
  confidence: "scheduled" | "possible";
  /** Chip suggestions the row implies — computed, never asserted as advice. */
  benchBoostScore: number;
}

export interface GwProfileInput {
  /** Element id → club id, for the fifteen. Missing ids are skipped. */
  clubOf: (elementId: number) => number | null;
  /** Squad element ids, slot order 1–15 (1–11 are the starting XI). */
  squadIds: number[];
  /** Every fixture FPL has published for the rest of the season. */
  fixtures: Fixture[];
  /** Gameweeks to profile, oldest first. */
  gws: number[];
  /**
   * The highest gameweek FPL has fully scheduled. Rows at or below it are
   * "scheduled"; rows above are "possible" — even a currently-normal week
   * can still gain a blank or a double when a cup round is pencilled in.
   */
  scheduledUpTo: number;
}

/**
 * Profile one squad across the gameweeks.
 */
export function profileGameweeks(input: GwProfileInput): GwProfileRow[] {
  const { clubOf, squadIds, fixtures, gws, scheduledUpTo } = input;
  const xi = new Set(squadIds.slice(0, 11));

  // One pass: fixtures grouped by gameweek, then counted per club.
  const byGw = new Map<number, Map<number, number>>();
  for (const f of fixtures) {
    if (f.event == null) continue;
    let perGw = byGw.get(f.event);
    if (!perGw) {
      perGw = new Map();
      byGw.set(f.event, perGw);
    }
    perGw.set(f.team_h, (perGw.get(f.team_h) ?? 0) + 1);
    perGw.set(f.team_a, (perGw.get(f.team_a) ?? 0) + 1);
  }

  return gws.map((gw) => {
    const perGw = byGw.get(gw) ?? new Map<number, number>();
    let startersPlaying = 0;
    let starterDoubles = 0;
    let starterBlanks = 0;
    let squadPlaying = 0;
    for (const id of squadIds) {
      const club = clubOf(id);
      const n = club != null ? perGw.get(club) ?? 0 : 0;
      if (n > 0) {
        squadPlaying++;
        if (xi.has(id)) startersPlaying++;
      }
      if (xi.has(id)) {
        if (n > 1) starterDoubles++;
        if (n === 0) starterBlanks++;
      }
    }
    const confidence: GwProfileRow["confidence"] =
      gw <= scheduledUpTo ? "scheduled" : "possible";
    // Bench Boost wants the XI's feet on the grass plus bench depth playing:
    // the squad count is the tie-breaker between two full weeks.
    const benchBoostScore = startersPlaying * 10 + squadPlaying;
    return {
      gw,
      startersPlaying,
      starterDoubles,
      starterBlanks,
      squadPlaying,
      confidence,
      benchBoostScore,
    };
  });
}

/** The gameweek whose row prices a Bench Boost best, by the row's own score. */
export function bestBenchBoostWeek(rows: GwProfileRow[]): GwProfileRow | null {
  const scheduled = rows.filter((r) => r.confidence === "scheduled" && r.startersPlaying > 0);
  if (scheduled.length === 0) return null;
  return scheduled.reduce((best, r) => (r.benchBoostScore > best.benchBoostScore ? r : best));
}