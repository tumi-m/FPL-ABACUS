import type { EventStatus, Fixture, FplEvent, GwPhase } from "@/lib/fpl/schemas";

export function getGwPhase(
  event: FplEvent,
  fixtures: Fixture[],
  status: EventStatus,
  now = Date.now(),
): GwPhase {
  if (event.data_checked) return "final";
  if (new Date(event.deadline_time).getTime() > now) return "pre_deadline";
  const started = fixtures.filter((f) => f.started);
  if (started.length === 0) return "awaiting_kickoff";
  if (started.some((f) => !f.finished_provisional)) return "live";
  const days = status.status.filter((s) => s.event === event.id);
  return days.length > 0 && days.every((d) => d.bonus_added) ? "bonus_added" : "provisional";
}

export const isPolling = (p: GwPhase) => p === "live" || p === "provisional";

export function bonusAddedDays(status: EventStatus, gw: number): Set<string> {
  return new Set(status.status.filter((s) => s.event === gw && s.bonus_added).map((s) => s.date));
}
