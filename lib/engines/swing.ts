import type { Fixture } from "@/lib/fpl/schemas";
import type { Multiplier } from "@/lib/engines/types";

export type StatIdentifier = Fixture["stats"][number]["identifier"];

export interface RawEvent {
  fixture: number;
  element: number;
  identifier: StatIdentifier;
  value: number;
  minute: number;
}

export interface SwingEvent extends RawEvent {
  id: string;
  points: number;
  yourMultiplier: Multiplier;
  eo: number;
  ranksGained: number;
  kind: "gain" | "loss" | "neutral";
}

/** Diff two fixture snapshots → scoring events. */
export function diffFixtures(prev: Fixture[], next: Fixture[]): RawEvent[] {
  const prevMap = new Map<number, Fixture>();
  for (const f of prev) prevMap.set(f.id, f);

  const events: RawEvent[] = [];
  for (const nf of next) {
    const pf = prevMap.get(nf.id);
    if (!pf) continue;
    for (const stat of nf.stats) {
      const pStat = pf.stats.find((s) => s.identifier === stat.identifier);
      if (!pStat) continue;
      const all = [
        ...stat.h.map((e) => ({ side: "h" as const, ...e })),
        ...stat.a.map((e) => ({ side: "a" as const, ...e })),
      ];
      for (const entry of all) {
        const before = [...pStat.h, ...pStat.a].find((e) => e.element === entry.element)?.value ?? 0;
        if (entry.value > before) {
          events.push({
            fixture: nf.id,
            element: entry.element,
            identifier: stat.identifier,
            value: entry.value - before,
            minute: nf.minutes,
          });
        }
      }
    }
  }
  return events;
}

/** Points a scoring event is worth to the player. Position-specific values come
 * from ScoringConfig at the call site. */
export function eventPoints(identifier: StatIdentifier, posPoints = 5): number {
  if (identifier === "goals_scored") return posPoints;
  if (identifier === "assists") return 3;
  return 0;
}

export function swingForEvent(
  e: RawEvent,
  points: number,
  yourMult: Multiplier,
  eo: number,
  ranksPerPt: number,
): SwingEvent {
  const relative = yourMult - eo / 100;
  const ranksGained = relative * points * ranksPerPt;
  return {
    ...e,
    id: `${e.fixture}:${e.element}:${e.identifier}:${e.value}`,
    points,
    yourMultiplier: yourMult,
    eo,
    ranksGained,
    kind: ranksGained > 0 ? "gain" : ranksGained < 0 ? "loss" : "neutral",
  };
}

export interface ReconcileResult {
  events: SwingEvent[];
  residual: number;
  scale?: number;
}

/** Scale first-order deltas so they sum exactly to the observed rank change. */
export function reconcile(events: SwingEvent[], observedRankDelta: number): ReconcileResult {
  const modelled = events.reduce((s, e) => s + e.ranksGained, 0);
  if (Math.abs(modelled) < 1) {
    return { events, residual: observedRankDelta };
  }
  const k = observedRankDelta / modelled;
  return {
    events: events.map((e) => ({ ...e, ranksGained: e.ranksGained * k })),
    residual: 0,
    scale: k,
  };
}
