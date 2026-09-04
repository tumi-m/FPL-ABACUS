import "server-only";

/**
 * Server composition for the Deadline Cockpit (v10 A1).
 *
 * Reuses `buildPlanner` — the same market, squad, bank and horizon
 * projections the Planner reads — because a verdict that disagrees with the
 * Planner about what a move is worth is worse than no verdict. That also
 * makes this the most expensive composition in the app, so the projection
 * is an *enhancement*: `withDeadline` bounds it, and every block degrades to
 * an honest unpriced line when the desk misses the bus. The squad read is
 * NOT an enhancement — no picks, no cockpit.
 *
 * Verdicts come from `lib/engines/cockpit.ts` (pure, tested); this file only
 * fetches, feeds and degrades.
 */
import { buildPlanner } from "@/lib/server/buildPlanner";
import { withDeadline, ENHANCEMENT_MS } from "@/lib/server/deadline";
import { suggestTransfers } from "@/lib/engines/suggest";
import { defaultMinutesFloor } from "@/lib/engines/performance";
import { composeCockpit, type CockpitResult, type CockpitSlot } from "@/lib/engines/cockpit";
import type { PlannerData } from "@/lib/server/buildPlanner";

/** FPL's published chance of playing this round, when there is one. */
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";

export interface CockpitData {
  teamId: number;
  cockpit: CockpitResult;
  /** True when the planner projection missed its deadline — blocks degrade honestly. */
  projectionMissed: boolean;
  /** Pass-through for the countdown and the calendar strip. */
  nextDeadline: string | null;
  bankTenths: number;
  squadValueTenths: number;
}

/**
 * Compose the cockpit for a team.
 *
 * The planner is the whole input. One call, bounded: if it cannot answer in
 * time we render the deadline clock and an honest "not priced" line rather
 * than a spinner for twenty-two seconds (C1 measured /planner at 22.7 s).
 * Bootstrap is cheap and cached; it carries the chance-of-playing percentage
 * the flagged evidence quotes.
 */
export async function buildCockpit(teamId: number): Promise<CockpitData> {
  // The planner is the whole input. One call, bounded: if it cannot answer in
  // time we render the deadline clock and an honest "not priced" line rather
  // than a spinner for twenty-two seconds (C1 measured /planner at 22.7 s).
  const [planner, boot] = await Promise.all([
    withDeadline(
      buildPlanner(teamId).catch(() => null as PlannerData | null),
      ENHANCEMENT_MS * 2,
      null as PlannerData | null,
    ),
    getBootstrapLite().catch(() => null),
  ]);

  const projection = planner && !planner.squadUnavailable ? priceProjection(planner) : null;

  // FPL's chance-of-playing is a bootstrap field, not a planner field, and it
  // is the percentage the cockpit's flagged evidence quotes — one read, keyed
  // by element id.
  const chanceOf = new Map<number, number | null>();
  for (const sl of planner?.squad ?? []) {
    const el = boot?.elements[sl.element];
    if (el) chanceOf.set(sl.element, el.chance_of_playing_this_round);
  }

  const slots: CockpitSlot[] =
    planner == null || planner.squadUnavailable
      ? []
      : planner.squad.map((sl) => {
          const el = planner.players.find((p) => p.id === sl.element);
          return {
            id: sl.element,
            name: el?.name ?? "?",
            pos: el?.pos ?? 0,
            slot: sl.slot,
            isCaptain: sl.isCaptain,
            status: el?.status ?? "a",
            news: el?.news ?? "",
            chanceOfPlaying: chanceOf.get(sl.element) ?? null,
            horizon: el?.horizon ?? null,
            netTransfers: el?.netTransfers ?? 0,
            costChangeEvent: el?.costChangeEvent ?? 0,
          };
        });

  const cockpit = composeCockpit({
    squadUnavailable: planner == null || planner.squadUnavailable,
    slots,
    freeTransfers: planner?.freeTransfers ?? 1,
    projection,
  });

  // The countdown wants the ISO timestamp, not the planner's day-month label.
  const currentGw =
    boot?.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot?.events.find((e) => e.is_next)?.id ?? 2) - 1);
  const nextEvent =
    boot?.events.find((e) => e.is_next) ?? boot?.events.find((e) => e.id >= currentGw);

  return {
    teamId,
    cockpit,
    projectionMissed: projection == null,
    nextDeadline: nextEvent?.deadline_time ?? null,
    bankTenths: planner?.bankTenths ?? 0,
    squadValueTenths: planner?.squadValueTenths ?? 0,
  };
}

/** The one suggestion the cockpit names, priced by the same engine the Board uses. */
function priceProjection(planner: PlannerData) {
  const byId = new Map(planner.players.map((p) => [p.id, p]));
  const sellOf = new Map(planner.squad.map((sl) => [sl.element, sl.sellPrice]));
  const mine = planner.squad
    .map((sl) => byId.get(sl.element))
    .filter((p): p is NonNullable<typeof p> => p != null);
  const [best] = suggestTransfers({
    squad: mine,
    market: planner.players,
    bankTenths: planner.bankTenths,
    sellPriceOf: (id) => sellOf.get(id) ?? byId.get(id)?.cost ?? 0,
    weeks: planner.gws.length,
    minMinutes: defaultMinutesFloor(planner.players),
  });
  if (!best) {
    return { weeks: planner.gws.length, suggestion: null, hitCost: 4 };
  }
  const out = byId.get(best.outId);
  const incoming = byId.get(best.inId);
  if (!out || !incoming) return { weeks: planner.gws.length, suggestion: null, hitCost: 4 };
  return {
    weeks: planner.gws.length,
    hitCost: 4,
    suggestion: {
      outId: best.outId,
      inId: best.inId,
      outName: out.name,
      inName: incoming.name,
      gain: best.gain,
    },
  };
}