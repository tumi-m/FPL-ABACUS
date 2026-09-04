import "server-only";
import { cacheStore } from "@/lib/cache/store";
import { diffFixtures, type RawEvent, type StatIdentifier } from "@/lib/engines/swing";
import type { Fixture } from "@/lib/fpl/schemas";

interface CompactStat {
  i: StatIdentifier;
  h: [number, number][];
  a: [number, number][];
}

/** Parse the event list, or discard it when corrupt — a feed is re-warmable;
 *  a 500 on this endpoint is not recoverable by the caller. */
function safeParseList(raw: string): RawEvent[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RawEvent[]) : [];
  } catch {
    return [];
  }
}

function snapshot(fixtures: Fixture[]): Record<number, CompactStat[]> {
  const out: Record<number, CompactStat[]> = {};
  for (const f of fixtures) {
    out[f.id] = f.stats.map((s) => ({
      i: s.identifier,
      h: s.h.map((e) => [e.element, e.value] as [number, number]),
      a: s.a.map((e) => [e.element, e.value] as [number, number]),
    }));
  }
  return out;
}

/**
 * Diffs the current fixtures payload against the last-seen snapshot and
 * accumulates scoring events. Survives cold starts via the cache store.
 */
export async function collectEvents(gw: number, fixtures: Fixture[]): Promise<RawEvent[]> {
  const store = cacheStore();
  const snapKey = `gaffer:evsnap:${gw}`;
  const listKey = `gaffer:events:${gw}`;

  const rawPrev = await store.get(snapKey);
  let events: RawEvent[] = [];
  if (rawPrev) {
    try {
      const prevSnap = JSON.parse(rawPrev) as Record<number, CompactStat[]>;
      const prevFixtures: Fixture[] = Object.entries(prevSnap).map(([id, stats]) => ({
        id: Number(id),
        code: 0,
        event: gw,
        kickoff_time: null,
        started: true,
        finished: false,
        finished_provisional: false,
        minutes: 0,
        provisional_start_time: false,
        team_h: 0,
        team_a: 0,
        team_h_score: null,
        team_a_score: null,
        team_h_difficulty: 0,
        team_a_difficulty: 0,
        pulse_id: 0,
        stats: stats.map((s) => ({
          identifier: s.i,
          h: s.h.map(([element, value]) => ({ element, value })),
          a: s.a.map(([element, value]) => ({ element, value })),
        })),
      }));
      events = diffFixtures(prevFixtures, fixtures);
    } catch {
      events = [];
    }
  }

  await store.set(snapKey, JSON.stringify(snapshot(fixtures)), 60 * 60 * 30);

  if (events.length > 0) {
    const rawList = await store.get(listKey);
    // A corrupt list resets the feed rather than taking the endpoint down —
    // the snapshot parse above already follows this contract.
    let list: RawEvent[] = rawList ? safeParseList(rawList) : [];
    const seen = new Set(list.map((e) => `${e.fixture}:${e.element}:${e.identifier}:${e.value}`));
    const fresh = events.filter((e) => !seen.has(`${e.fixture}:${e.element}:${e.identifier}:${e.value}`));
    list = [...fresh, ...list].slice(0, 300);
    await store.set(listKey, JSON.stringify(list), 60 * 60 * 30);
  }

  const rawList = await store.get(listKey);
  return rawList ? safeParseList(rawList) : [];
}
