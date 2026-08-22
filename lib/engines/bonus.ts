import type { Fixture } from "@/lib/fpl/schemas";

/**
 * Award rule (handles ties exactly as FPL does):
 *   group players by BPS descending; hand out 3, then 2, then 1 to
 *   successive groups; a group of size k consumes k award slots.
 */
export function bonusForFixture(bpsByElement: Map<number, number>): Map<number, number> {
  const groups = new Map<number, number[]>();
  for (const [el, bps] of bpsByElement) {
    const list = groups.get(bps);
    if (list) list.push(el);
    else groups.set(bps, [el]);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[0] - a[0]);

  const AWARDS = [3, 2, 1];
  const out = new Map<number, number>();
  let slot = 0;
  for (const [, elements] of sorted) {
    if (slot >= AWARDS.length) break;
    const award = AWARDS[slot];
    for (const el of elements) out.set(el, award);
    slot += elements.length;
  }
  return out;
}

/** Provisional bonus only becomes meaningful once a fixture has passed 20'. */
export const BONUS_VISIBLE_FROM_MINUTE = 20;

function bpsMapForFixture(f: Fixture): Map<number, number> | null {
  const stat = f.stats.find((s) => s.identifier === "bps");
  if (!stat) return null;
  const map = new Map<number, number>();
  for (const e of stat.h) map.set(e.element, e.value);
  for (const e of stat.a) map.set(e.element, e.value);
  return map;
}

/**
 * Summed provisional bonus per element across the gameweek's fixtures.
 * Skips fixtures whose match day already has official bonus added AND that
 * have finished — FPL's own numbers are authoritative there.
 */
export function provisionalBonus(fixtures: Fixture[], bonusAddedDays: Set<string>): Map<number, number> {
  const result = new Map<number, number>();
  for (const f of fixtures) {
    if (!f.started || f.minutes < BONUS_VISIBLE_FROM_MINUTE) continue;
    const day = f.kickoff_time?.slice(0, 10);
    if (day && bonusAddedDays.has(day) && f.finished) continue;
    const map = bpsMapForFixture(f);
    if (!map) continue;
    for (const [el, b] of bonusForFixture(map)) {
      result.set(el, (result.get(el) ?? 0) + b);
    }
  }
  return result;
}
