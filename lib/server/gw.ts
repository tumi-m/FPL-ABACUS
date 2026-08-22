import "server-only";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getEventStatus, getFixtures, getLive } from "@/lib/fpl/endpoints";
import { getGwPhase, bonusAddedDays } from "@/lib/engines/matchState";
import type { EventStatus, Fixture, FplEvent, GwPhase, Live } from "@/lib/fpl/schemas";
import type { BootstrapLite } from "@/lib/fpl/bootstrapLite";

export interface GwContext {
  boot: BootstrapLite;
  event: FplEvent;
  status: EventStatus;
  fixtures: Fixture[];
  live: Live;
  phase: GwPhase;
  addedDays: Set<string>;
}

export async function loadGwContext(gw?: number): Promise<GwContext> {
  const boot = await getBootstrapLite();
  const status = await getEventStatus();
  const event =
    boot.events.find((e) => e.id === gw) ??
    boot.events.find((e) => e.is_current) ??
    boot.events.find((e) => e.is_next) ??
    boot.events[0];
  const [fixtures, live] = await Promise.all([getFixtures(event.id), getLive(event.id)]);
  const phase = getGwPhase(event, fixtures, status);
  return { boot, event, status, fixtures, live, phase, addedDays: bonusAddedDays(status, event.id) };
}
