import "server-only";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getEventStatus, getFixtures, getFixturesAll, getLive } from "@/lib/fpl/endpoints";
import { getGwPhase, bonusAddedDays } from "@/lib/engines/matchState";
import { weekMoment } from "@/lib/engines/weekPhase";
import type { EventStatus, Fixture, FplEvent, GwPhase, Live } from "@/lib/fpl/schemas";
import type { BootstrapLite } from "@/lib/fpl/bootstrapLite";
import type { LiveBarData } from "@/lib/ui/types";

export interface GwContext {
  boot: BootstrapLite;
  event: FplEvent;
  status: EventStatus;
  fixtures: Fixture[];
  /** Season fixture list — the fixture-model input for per-face xGC. */
  allFixtures: Fixture[];
  live: Live;
  phase: GwPhase;
  addedDays: Set<string>;
}

export async function loadGwContext(gw?: number): Promise<GwContext> {
  // Bootstrap and event status are independent upstreams — waiting on one
  // before asking for the other doubled this loader's floor latency.
  const [boot, status] = await Promise.all([getBootstrapLite(), getEventStatus()]);
  const event =
    boot.events.find((e) => e.id === gw) ??
    boot.events.find((e) => e.is_current) ??
    boot.events.find((e) => e.is_next) ??
    boot.events[0];
  const [fixtures, allFixtures, live] = await Promise.all([
    getFixtures(event.id),
    getFixturesAll(),
    getLive(event.id),
  ]);
  const phase = getGwPhase(event, fixtures, status);
  return {
    boot,
    event,
    status,
    fixtures,
    allFixtures,
    live,
    phase,
    addedDays: bonusAddedDays(status, event.id),
  };
}

/** Global matchday status for the app-wide LiveBar. */
export function liveBarData(ctx: GwContext): LiveBarData {
  const inPlay = ctx.fixtures.filter((f) => f.started === true && !f.finished_provisional);
  let latestMinute: number | null = null;
  for (const f of inPlay) {
    if (f.minutes > 0 && (latestMinute === null || f.minutes > latestMinute)) latestMinute = f.minutes;
  }
  const moment = weekMoment(ctx.phase, Date.now(), ctx.event.deadline_time);
  return {
    phase: ctx.phase,
    gameweek: ctx.event.id,
    fixturesInPlay: inPlay.length,
    latestMinute,
    moment: { key: moment.key, label: moment.label },
  };
}
