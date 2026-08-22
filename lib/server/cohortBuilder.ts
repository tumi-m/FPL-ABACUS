import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cohortOwnership, cohortSnapshot } from "@/lib/db/schema";
import { cacheStore } from "@/lib/cache/store";
import { fplFetch } from "@/lib/fpl/client";
import { getStandings } from "@/lib/fpl/endpoints";
import { zPicks, type PicksResponse } from "@/lib/fpl/schemas";
import { aggregateCohort, logSpacedPages, reservoirSample, toEnginePick } from "@/lib/engines/cohortSampling";
import type { Pick as EnginePick } from "@/lib/engines/types";

const LEAGUE_314 = 314;
/** Same head-dense strata as the rank curve so EO and the curve cover the same field. */
const PAGE_BUDGET = 24;
const MAX_PAGE = 180_000;
const TARGET_SAMPLE = 2000;
const PICKS_CONCURRENCY = 6;

export const COHORT_ID = "overall";

export interface CohortBuildResult {
  ok: boolean;
  gw: number;
  cohort: string;
  sampled?: number;
  squads?: number;
  elements?: number;
  ms?: number;
  skipped?: "lock-held" | "fresh" | "already-built" | "no-squads";
}

/**
 * Builds one cohort EO snapshot for a gameweek:
 * log-spaced standings sweep → reservoir sample → picks fan-out → aggregate → persist.
 * Idempotent per (gw, cohort); overlap-guarded by a cache lock since the cron
 * fires every 10 minutes.
 */
export async function buildCohortSnapshot(gw: number): Promise<CohortBuildResult> {
  const started = Date.now();
  const store = cacheStore();

  // Fresh-marker fast path (set after a successful build).
  const freshMarker = `gaffer:cohort:built:${gw}:${COHORT_ID}`;
  if (await store.get(freshMarker)) return { ok: true, gw, cohort: COHORT_ID, skipped: "fresh" };

  // Overlap guard. Not atomic across instances, but crons are single-instance
  // on this deployment; worst case two builders race and the second upsert wins.
  const lockKey = `gaffer:cohort:lock:${gw}`;
  if (await store.get(lockKey)) return { ok: true, gw, cohort: COHORT_ID, skipped: "lock-held" };
  await store.set(lockKey, String(started), 60 * 15);

  try {
    // DB-level idempotency: never rebuild within a gameweek unless told to.
    const existing = await db()
      .select({ id: cohortSnapshot.id })
      .from(cohortSnapshot)
      .where(eq(cohortSnapshot.event, gw))
      .limit(1);
    if (existing.length > 0) {
      await store.set(freshMarker, String(existing[0].id), 60 * 60 * 6);
      return { ok: true, gw, cohort: COHORT_ID, skipped: "already-built" };
    }

    // 1) Stratified candidate sweep.
    const candidates = new Map<number, number>(); // entryId -> rank
    for (const page of logSpacedPages(PAGE_BUDGET, MAX_PAGE)) {
      try {
        const res = await getStandings(LEAGUE_314, page);
        for (const r of res.standings.results) {
          if (!candidates.has(r.entry)) candidates.set(r.entry, r.rank);
        }
      } catch {
        // a failing page shrinks the sample; never fatal
      }
      await sleep(120);
    }
    if (candidates.size === 0) return { ok: false, gw, cohort: COHORT_ID, skipped: "no-squads" };

    // 2) Reservoir down to the target.
    const sampled = reservoirSample(candidates.keys(), Math.min(TARGET_SAMPLE, candidates.size));

    // 3) Picks fan-out with bounded concurrency. Raw fetches (not cached()) —
    // thousands of per-entry payloads must not flood the SWR cache store.
    const squads: EnginePick[][] = [];
    let cursor = 0;
    while (cursor < sampled.length) {
      const batch = sampled.slice(cursor, cursor + PICKS_CONCURRENCY);
      cursor += PICKS_CONCURRENCY;
      const results = await Promise.all(
        batch.map(async (entryId): Promise<PicksResponse | null> => {
          try {
            return await fplFetch(`/entry/${entryId}/event/${gw}/picks/`, zPicks);
          } catch {
            return null;
          }
        }),
      );
      for (const picks of results) {
        if (!picks || picks.picks.length < 11) continue; // unset/partial squads
        squads.push(picks.picks.map(toEnginePick));
      }
      await sleep(150);
    }
    if (squads.length === 0) return { ok: false, gw, cohort: COHORT_ID, skipped: "no-squads" };

    // 4) Aggregate.
    const aggregated = [...aggregateCohort(squads, squads.length).values()];

    // 5) Persist: upsert snapshot → replace ownership rows.
    const [snap] = await db()
      .insert(cohortSnapshot)
      .values({ event: gw, cohort: COHORT_ID, sampleSize: squads.length })
      .onConflictDoUpdate({
        target: [cohortSnapshot.event, cohortSnapshot.cohort],
        set: { sampleSize: squads.length, builtAt: new Date() },
      })
      .returning({ id: cohortSnapshot.id });

    await db().delete(cohortOwnership).where(eq(cohortOwnership.snapshotId, snap.id));
    for (let i = 0; i < aggregated.length; i += 500) {
      await db().insert(cohortOwnership).values(aggregated.slice(i, i + 500).map((r) => ({ ...r, snapshotId: snap.id })));
    }

    await store.set(freshMarker, String(snap.id), 60 * 60 * 6);

    return {
      ok: true,
      gw,
      cohort: COHORT_ID,
      sampled: sampled.length,
      squads: squads.length,
      elements: aggregated.length,
      ms: Date.now() - started,
    };
  } finally {
    await store.del(lockKey);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
