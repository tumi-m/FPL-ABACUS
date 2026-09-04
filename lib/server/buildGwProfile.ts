import "server-only";

/**
 * Server composition for the personal blank/double calendar (v10 D7).
 *
 * `lib/engines/gwProfile.ts` is pure; this file fetches the squad, the
 * season fixture list and the published schedule horizon, and feeds it.
 * The squad read is allowed to fail — a guest gets the twenty-club league
 * profile rather than nothing, and a failing fixture call degrades to a
 * season of honest zeros rather than a throw.
 */
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getPicks, getFixturesAll } from "@/lib/fpl/endpoints";
import { profileGameweeks, bestBenchBoostWeek, type GwProfileRow } from "@/lib/engines/gwProfile";

export interface GwProfileData {
  rows: GwProfileRow[];
  /** The week the Bench Boost would be played, when a scheduled one is full. */
  benchBoostGw: number | null;
  /** False when the picks endpoint refused us — the calendar degrades to league-wide. */
  squadKnown: boolean;
}

/** The horizon the calendar spans: from the current week to the season's end. */
export async function buildGwProfile(teamId: number | null): Promise<GwProfileData> {
  const boot = await getBootstrapLite();
  const currentGw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);

  // FPL's fixture list is published in batches: the rounds beyond the last
  // scheduled event exist only as placeholders until cup ties are drawn.
  const gws = boot.events
    .filter((e) => e.id >= currentGw && e.id <= currentGw + 12)
    .map((e) => e.id);

  const [picksRes, fixturesRes] = await Promise.allSettled([
    teamId ? getPicks(teamId, currentGw, true) : Promise.reject(new Error("no team")),
    getFixturesAll(),
  ]);
  const fixtures = fixturesRes.status === "fulfilled" ? fixturesRes.value : [];

  // The honesty line, from the list itself: the furthest week that carries
  // fixture rows. Beyond it nothing is confirmed — a "blank" there is only
  // the absence of a schedule, and the row says "possible".
  const scheduledUpTo = fixtures.reduce(
    (max, f) => (f.event != null ? Math.max(max, f.event) : max),
    0,
  );

  if (picksRes.status === "fulfilled") {
    const clubOf = new Map<number, number>();
    for (const p of picksRes.value.picks) {
      const el = boot.elements[p.element];
      if (el) clubOf.set(p.element, el.team);
    }
    const rows = profileGameweeks({
      clubOf: (id) => clubOf.get(id) ?? null,
      squadIds: picksRes.value.picks.map((p) => p.element),
      fixtures,
      gws,
      scheduledUpTo,
    });
    return {
      rows,
      benchBoostGw: bestBenchBoostWeek(rows)?.gw ?? null,
      squadKnown: true,
    };
  }

  // No squad (guest, or FPL refused): every club counts once, which is the
  // universal Crellin view. Confidence still follows the published list.
  const leagueRows = profileGameweeks({
    clubOf: () => null,
    squadIds: [],
    fixtures,
    gws,
    scheduledUpTo,
  });
  return { rows: leagueRows, benchBoostGw: null, squadKnown: false };
}