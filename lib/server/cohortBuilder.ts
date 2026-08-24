import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cohortEntry, cohortOwnership, cohortSnapshot } from "@/lib/db/schema";
import { cacheStore } from "@/lib/cache/store";
import { fplFetch } from "@/lib/fpl/client";
import { getStandings } from "@/lib/fpl/endpoints";
import { zPicks, type PicksResponse } from "@/lib/fpl/schemas";
import { aggregateCohort, logSpacedPages, reservoirSample, toEnginePick } from "@/lib/engines/cohortSampling";
import type { Pick as EnginePick } from "@/lib/engines/types";

const LEAGUE_314 = 314;
const PAGE_BUDGET = 24;
const MAX_PAGE = 180_000;
const TARGET_SAMPLE = 2000;
const PICKS_CONCURRENCY = 6;

/** Per-invocation work budget. Keeps every tick comfortably inside a 60s
 *  serverless ceiling (incl. cold-start overhead); the run resumes on the
 *  next cron tick via persisted state. */
const WORK_BUDGET_MS = 20_000;

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
  partial?: { phase: "pages" | "picks"; pagesLeft: number; candidates: number; picksDone: number; picksTotal: number };
}

/** Resumable run state — persisted between ticks so no single invocation
 *  ever needs more than WORK_BUDGET_MS of upstream work. */
interface RunState {
  phase: "pages" | "picks";
  pagesLeft: number[];
  candidates: number[];
  sampled: number[] | null;
  /** compact squads: [[[element, multiplier], …], …] */
  squads: number[][][] | null;
  /** v3-10: per-entry detail for the twin study (persists with the snapshot). */
  squadsDetailed: { entry: number; elements: number[]; multipliers: number[]; squadCostTenths: number; bankTenths: number; eventTransfers: number }[] | null;
  pickCursor: number;
}

function newState(): RunState {
  return {
    phase: "pages",
    pagesLeft: logSpacedPages(PAGE_BUDGET, MAX_PAGE),
    candidates: [],
    sampled: null,
    squads: null,
    squadsDetailed: null,
    pickCursor: 0,
  };
}

/**
 * Builds the cohort EO snapshot for a gameweek across as many short cron
 * ticks as needed: standings sweep → reservoir sample → picks fan-out →
 * aggregate → persist. Idempotent per (gw, cohort); overlap-guarded by a
 * cache lock; safe to interrupt at any point.
 */
export async function buildCohortSnapshot(gw: number): Promise<CohortBuildResult> {
  const t0 = Date.now();
  const store = cacheStore();

  const freshMarker = `gaffer:cohort:built:${gw}:${COHORT_ID}`;
  if (await store.get(freshMarker)) return { ok: true, gw, cohort: COHORT_ID, skipped: "fresh" };

  const lockKey = `gaffer:cohort:lock:${gw}`;
  if (await store.get(lockKey)) return { ok: true, gw, cohort: COHORT_ID, skipped: "lock-held" };
  await store.set(lockKey, String(t0), 60 * 15);

  try {
    const existing = await db()
      .select({ id: cohortSnapshot.id })
      .from(cohortSnapshot)
      .where(eq(cohortSnapshot.event, gw))
      .limit(1);
    if (existing.length > 0) {
      await store.set(freshMarker, String(existing[0].id), 60 * 60 * 6);
      await store.del(`gaffer:cohort:run:${gw}`);
      return { ok: true, gw, cohort: COHORT_ID, skipped: "already-built" };
    }

    const stateKey = `gaffer:cohort:run:${gw}`;
    const rawState = await store.get(stateKey);
    let state: RunState = rawState ? (JSON.parse(rawState) as RunState) : newState();
    if (!state.pagesLeft) state = newState(); // corrupt-state safety net

    // ── Work loop: bounded by wall clock, resumes across ticks ──────────
    while (Date.now() - t0 < WORK_BUDGET_MS) {
      if (state.phase === "pages") {
        if (state.pagesLeft.length === 0) {
        if (state.candidates.length === 0) return { ok: false, gw, cohort: COHORT_ID, skipped: "no-squads" };
          state.sampled = [...reservoirSample(new Set(state.candidates), Math.min(TARGET_SAMPLE, state.candidates.length))];
          state.squads = [];
          state.squadsDetailed = [];
          state.pickCursor = 0;
          state.phase = "picks";
          continue;
        }
        const page = state.pagesLeft.shift() as number;
        try {
          const res = await getStandings(LEAGUE_314, page);
          for (const r of res.standings.results) state.candidates.push(r.entry);
          // The sweep doubles as directory growth (best-effort, never fatal).
          try {
            const { rememberEntries } = await import("@/lib/server/entryDirectory");
            await rememberEntries(
              res.standings.results.map((r) => ({
                entry: r.entry,
                teamName: r.entry_name ?? "",
                managerName: r.player_name ?? "",
                rank: r.rank ?? null,
              })),
              "cohort",
            );
          } catch {
            /* directory is best-effort */
          }
        } catch {
          // a failing page shrinks the sample; never fatal
        }
        await sleep(120);
        continue;
      }

      // phase === "picks"
      const sampled = state.sampled as number[];
      if (state.pickCursor >= sampled.length) break; // fan-out complete

      const batch = sampled.slice(state.pickCursor, state.pickCursor + PICKS_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (entryId): Promise<PicksResponse | null> => {
          try {
            return await fplFetch(`/entry/${entryId}/event/${gw}/picks/`, zPicks);
          } catch {
            return null;
          }
        }),
      );
      state.pickCursor += batch.length;
      for (const [bi, picks] of results.entries()) {
        if (!picks || picks.picks.length < 11) continue; // unset/partial squads
        const entryId = batch[bi];
        state.squads?.push(picks.picks.map((p) => [p.element, p.multiplier]));
        const started = picks.picks.filter((p) => p.multiplier > 0).length;
        const captains = picks.picks.filter((p) => p.multiplier >= 2).length;
        const squadCostTenths = picks.entry_history.value - picks.entry_history.bank;
        const bankTenths = picks.entry_history.bank;
        const eventTransfers = picks.entry_history.event_transfers;
        (state.squadsDetailed as NonNullable<RunState["squadsDetailed"]>).push({
          entry: entryId,
          elements: picks.picks.map((p) => p.element),
          multipliers: picks.picks.map((p) => p.multiplier),
          squadCostTenths,
          bankTenths,
          eventTransfers,
        });
        // keep arm counts for aggregate persistence
        void started;
        void captains;
      }
      await sleep(150);
    }

    // ── Budget exhausted mid-run → persist state, resume next tick ──────
    if (state.phase === "pages" || !state.sampled || state.pickCursor < state.sampled.length) {
      await store.set(stateKey, JSON.stringify(state), 60 * 60 * 6);
      return {
        ok: true,
        gw,
        cohort: COHORT_ID,
        partial: {
          phase: state.phase,
          pagesLeft: state.pagesLeft.length,
          candidates: state.candidates.length,
          picksDone: state.pickCursor,
          picksTotal: state.sampled?.length ?? 0,
        },
        ms: Date.now() - t0,
      };
    }

    // ── Fan-out complete → aggregate + persist ───────────────────────────
    const engineSquads: EnginePick[][] = ((state.squads as number[][][]) ?? []).map((squad) =>
      squad.map(([element, multiplier]) => toEnginePick({ element, position: 1, multiplier })),
    );
    if (engineSquads.length === 0) {
      await store.del(stateKey);
      return { ok: false, gw, cohort: COHORT_ID, skipped: "no-squads" };
    }
    const aggregated = [...aggregateCohort(engineSquads, engineSquads.length).values()];

    const [snap] = await db()
      .insert(cohortSnapshot)
      .values({ event: gw, cohort: COHORT_ID, sampleSize: engineSquads.length })
      .onConflictDoUpdate({
        target: [cohortSnapshot.event, cohortSnapshot.cohort],
        set: { sampleSize: engineSquads.length, builtAt: new Date() },
      })
      .returning({ id: cohortSnapshot.id });

    await db().delete(cohortOwnership).where(eq(cohortOwnership.snapshotId, snap.id));
    for (let i = 0; i < aggregated.length; i += 500) {
      await db().insert(cohortOwnership).values(aggregated.slice(i, i + 500).map((r) => ({ ...r, snapshotId: snap.id })));
    }

    // v3-10 twin study: per-entry rows for later pairing (settled on finalise)
    if (state.squadsDetailed?.length) {
      await db().delete(cohortEntry).where(eq(cohortEntry.snapshotId, snap.id));
      const entries = state.squadsDetailed.map((s) => ({
        snapshotId: snap.id,
        entry: s.entry,
        elements: s.elements,
        counts: [15, s.multipliers.filter((m) => m > 0).length, s.multipliers.filter((m) => m >= 2).length] as [number, number, number],
        squadCostTenths: s.squadCostTenths,
        bankTenths: s.bankTenths,
        eventTransfers: s.eventTransfers,
      }));
      for (let i = 0; i < entries.length; i += 500) {
        await db().insert(cohortEntry).values(entries.slice(i, i + 500));
      }
    }

    await store.del(stateKey);
    await store.set(freshMarker, String(snap.id), 60 * 60 * 6);

    return {
      ok: true,
      gw,
      cohort: COHORT_ID,
      sampled: state.sampled.length,
      squads: engineSquads.length,
      elements: aggregated.length,
      ms: Date.now() - t0,
    };
  } finally {
    await store.del(lockKey);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
