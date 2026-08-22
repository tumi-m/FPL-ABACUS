import { computeEO } from "@/lib/engines/eo";
import type { Multiplier, Pick } from "@/lib/engines/types";

/** Dense at the head (where EO lives), log-spaced out to the field's tail.
 *  Shared shape with the rank-curve sampler so both cover the same strata. */
export function logSpacedPages(count: number, maxPage: number): number[] {
  const set = new Set<number>([1, 2, 3]);
  for (let i = 1; i <= count; i++) {
    set.add(Math.min(maxPage, Math.max(1, Math.round(Math.pow(maxPage, i / count)))));
  }
  return [...set].sort((a, b) => a - b);
}

/** Fisher-Yates–free Algorithm R reservoir sampling over a stream. */
export function reservoirSample<T>(items: Iterable<T>, k: number, rng: () => number = Math.random): T[] {
  const res: T[] = [];
  let seen = 0;
  for (const item of items) {
    seen++;
    if (res.length < k) {
      res.push(item);
    } else {
      const j = Math.floor(rng() * seen);
      if (j < k) res[j] = item;
    }
  }
  return res;
}

export interface CohortOwnershipRow {
  element: number;
  ownedPct: number;
  startedPct: number;
  captainPct: number;
  eo: number;
}

/**
 * Ownership + EO across a cohort of squads.
 * owned = anywhere in the 15; started = multiplier > 0 (i.e. in the XI);
 * captain = multiplier 2 or 3. EO is the existing mean-multiplier engine.
 */
export function aggregateCohort(squads: Pick[][], n: number): Map<number, CohortOwnershipRow> {
  const rows = new Map<number, CohortOwnershipRow>();
  if (n <= 0 || squads.length === 0) return rows;

  const counts = new Map<number, { owned: number; started: number; captain: number }>();
  for (const squad of squads) {
    for (const p of squad) {
      const c = counts.get(p.element) ?? { owned: 0, started: 0, captain: 0 };
      c.owned += 1;
      if (p.multiplier > 0) c.started += 1;
      if (p.multiplier === 2 || p.multiplier === 3) c.captain += 1;
      counts.set(p.element, c);
    }
  }

  const universe = [...counts.keys()];
  const eoMap = computeEO(squads, universe);

  for (const [element, c] of counts) {
    rows.set(element, {
      element,
      ownedPct: round1((c.owned / n) * 100),
      startedPct: round1((c.started / n) * 100),
      captainPct: round1((c.captain / n) * 100),
      eo: round1(eoMap.get(element) ?? 0),
    });
  }
  return rows;
}

/** Maps raw picks payloads into engine Picks (engine Pick shape). */
export function toEnginePick(p: { element: number; position: number; multiplier: number }): Pick {
  return {
    element: p.element,
    position: p.position,
    multiplier: Math.min(3, Math.max(0, Math.round(p.multiplier))) as Multiplier,
    isCaptain: p.multiplier === 2 || p.multiplier === 3,
    isViceCaptain: false,
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
