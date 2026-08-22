import type { Pos } from "@/lib/engines/types";

export interface TemplatePlayer {
  element: number;
  pos: Pos;
  eo10k: number;
  yourMult?: number;
  xP?: number;
}

const SQUAD_MAX: Record<Pos, number> = { 1: 1, 2: 5, 3: 5, 4: 3 };
const SQUAD_MIN: Record<Pos, number> = { 1: 1, 2: 3, 3: 2, 4: 1 };

/** Greedy fill of the highest-EO players subject to a legal formation. */
export function templateXI(players: TemplatePlayer[]): Set<number> {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<Pos, number>;
  const xi = new Set<number>();
  const sorted = [...players].sort((a, b) => b.eo10k - a.eo10k);

  for (const p of sorted) {
    if (counts[p.pos] >= SQUAD_MAX[p.pos]) continue;
    xi.add(p.element);
    counts[p.pos]++;
    if (xi.size === 11) break;
  }
  for (const pos of [1, 2, 3, 4] as Pos[]) {
    let guard = 0;
    while (counts[pos] < SQUAD_MIN[pos] && guard++ < 20) {
      const next = sorted.find((p) => p.pos === pos && !xi.has(p.element));
      if (!next) break;
      xi.add(next.element);
      counts[next.pos]++;
    }
  }
  return xi.size === 11 ? xi : new Set();
}

export function overlapPct(yourXI: Set<number>, template: Set<number>): number {
  if (yourXI.size === 0 || template.size === 0) return 0;
  let shared = 0;
  for (const el of template) if (yourXI.has(el)) shared++;
  return (shared / 11) * 100;
}

/** Differential Value Score. Positive = an active bet against the field. */
export function dvs(p: { yourMult?: number; eo10k: number; xP?: number }): number {
  const mult = p.yourMult ?? 0;
  return (mult - p.eo10k / 100) * (p.xP ?? 0);
}

export interface DriftResult {
  overlap: number;
  direction: "converging" | "diverging" | "stable";
  betsFor: TemplatePlayer[];
  betsAgainst: TemplatePlayer[];
}

export function templateDrift(
  yourXI: Set<number>,
  cohortPlayers: TemplatePlayer[],
  priorOverlaps: number[],
): DriftResult {
  const template = templateXI(cohortPlayers);
  const overlap = overlapPct(yourXI, template);

  let direction: DriftResult["direction"] = "stable";
  if (priorOverlaps.length >= 2) {
    const recent = priorOverlaps.slice(-2);
    const delta = recent[1] - recent[0];
    direction = delta > 2 ? "diverging" : delta < -2 ? "converging" : "stable";
  }

  const scored = cohortPlayers
    .filter((p) => (p.xP ?? 0) > 0)
    .map((p) => ({ p, score: dvs(p) }))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  return {
    overlap,
    direction,
    betsFor: scored.filter((s) => s.score > 0).slice(0, 8).map((s) => s.p),
    betsAgainst: scored.filter((s) => s.score < 0).slice(0, 8).map((s) => s.p),
  };
}
