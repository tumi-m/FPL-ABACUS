import type { Pick } from "@/lib/engines/types";

/** EO = mean multiplier across a cohort, as a percentage. */
export function computeEO(cohortPicks: Pick[][], elementIds: number[]): Map<number, number> {
  const n = cohortPicks.length;
  if (n === 0) return new Map(elementIds.map((id) => [id, 0]));
  const acc = new Map<number, number>();
  for (const squad of cohortPicks) {
    for (const p of squad) {
      if (p.multiplier > 0) acc.set(p.element, (acc.get(p.element) ?? 0) + p.multiplier);
    }
  }
  return new Map(elementIds.map((id) => [id, ((acc.get(id) ?? 0) / n) * 100]));
}

/** Sampling error in percentage points at 95% confidence. */
export function eoMarginOfError(p: number, n: number): number {
  if (n <= 0) return 0;
  const prop = p / 100;
  return 1.96 * Math.sqrt((prop * (1 - prop)) / n) * 100;
}

export interface FallbackEoInput {
  selectedByPercent: number;
  pos: number;
  mostCaptainedId: number | null;
  elementId: number;
}

const START_PRIOR: Record<number, number> = { 1: 0.85, 2: 0.78, 3: 0.82, 4: 0.75 };

/**
 * Pre-cohort fallback: EO ≈ ownership × position start-rate prior,
 * plus half the owners' captaincy when this is the field's most captained.
 * Every consumer must label results "estimated".
 */
export function fallbackEO(input: FallbackEoInput): number {
  const ownedPct = input.selectedByPercent;
  const startPrior = START_PRIOR[input.pos] ?? 0.8;
  let eo = ownedPct * startPrior;
  if (input.mostCaptainedId === input.elementId && ownedPct > 0) {
    eo += ownedPct * 0.5;
  }
  return Math.round(eo * 10) / 10;
}
