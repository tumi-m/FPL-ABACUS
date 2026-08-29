import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cohortEntry, cohortOwnership, cohortSnapshot } from "@/lib/db/schema";
import { cacheStore } from "@/lib/cache/store";
import { fplFetch } from "@/lib/fpl/client";
import { getStandings } from "@/lib/fpl/endpoints";
import { zPicks, type PicksResponse } from "@/lib/fpl/schemas";
import { aggregateCohort, logSpacedPages, reservoirSample, toEnginePick } from "@/lib/engines/cohortSampling";
import { twinLikelyOverlap } from "@/lib/engines/twinStudy";
import type { Pick as EnginePick } from "@/lib/engines/types";

const LEAGUE_314 = 314;
/** EO ownership sample — 2k head-dense squads keep EO tight; raising it moves
 *  upstream load without moving EO accuracy (v3 locked decision). */
const PAGE_BUDGET = 24;
const MAX_PAGE = 180_000;
const TARGET_SAMPLE = numEnv("GAFFER_EO_SAMPLE", 2000);
const PICKS_CONCURRENCY = 6;

/**
 * v3-10 second half — the 30k twin top-up. After the EO snapshot persists we
 * keep sweeping standings pages past the EO set and shortlist entries whose
 * 15-man squads overlap the requesting squads Gaffer actually serves. One
 * picks fetch per shortlisted twin at most — the honest near-twin verdict
 * (bank ±£0.5m, FT ±1) still happens in the pairing engine.
 * Rows persist under matchId so they never join the EO aggregates.
 */
const TWIN_TOPUP_TARGET = numEnv("GAFFER_TWIN_TOPUP", 30_000);
const TWIN_PAGE_BUDGET = numEnv("GAFFER_TWIN_PAGES", 600);
const TWIN_MATCHES = numEnv("GAFFER_TWIN_MATCHES", 400);
const TWIN_MAX_FETCHES = numEnv("GAFFER_TWIN_MAX_FETCHES", 60_000);
const TWIN_STORE_CAP = numEnv("GAFFER_TWIN_STORE", 3_000);
/** Overlap needed for a fetched squad to be worth a row — the honest ≥13/15
 *  verdict plus bank/FT tolerance still lives in the pairing engine. */
const TWIN_MIN_STORE = numEnv("GAFFER_TWIN_MIN_STORE", 13);

/** Per-invocation work budget. Keeps every tick comfortably inside a 60s
 *  serverless ceiling (incl. cold-start overhead); the run resumes on the
 *  next cron tick via persisted state. */
const WORK_BUDGET_MS = 20_000;

function numEnv(key: string, fallback: number): number {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export const COHORT_ID = "overall";

type Phase = RunState["phase"];

export interface CohortBuildResult {
  ok: boolean;
  gw: number;
  cohort: string;
  sampled?: number;
  squads?: number;
  elements?: number;
  ms?: number;
  skipped?: "lock-held" | "fresh" | "already-built" | "no-squads";
  partial?: { phase: Phase; pagesLeft: number; candidates: number; picksDone: number; picksTotal: number };
}

/** Resumable run state — persisted between ticks so no single invocation
 *  ever needs more than WORK_BUDGET_MS of upstream work. */
interface RunState {
  phase: "pages" | "picks" | "twin-pages" | "twin-fetch" | "done";
  pagesLeft: number[];
  candidates: number[];
  sampled: number[] | null;
  /** compact squads: [[[element, multiplier], …], …] */
  squads: number[][][] | null;
  /** v3-10: per-entry detail for the twin study (persists with the snapshot). */
  squadsDetailed: { entry: number; elements: number[]; multipliers: number[]; squadCostTenths: number; bankTenths: number; eventTransfers: number }[] | null;
  pickCursor: number;
  /**
   * How many standings pages actually answered.
   *
   * A failing page is swallowed on purpose — one bad page should shrink the
   * sample, not kill the run — but that made an FPL outage indistinguishable
   * from an empty league: both end with no candidates. Counting the successes
   * separates "there is nothing to sample yet", which is normal before the
   * first gameweek settles, from "we could not reach FPL at all", which is the
   * only one of the two worth waking anybody for.
   */
  pagesOk?: number;
  /** ── v3-10 30k top-up ── ids of the requesting squads we match twins for. */
  twinSeeds?: { entry: number; elements: number[] }[];
  twinPagesLeft?: number[];
  /** raw candidate ids from the pages sweep — squads unknown until fetched. */
  twinCandidates?: number[];
  /** fetched and confirmed near-twins awaiting insert */
  twinFound?: { matchId: number; entry: number; elements: number[]; multipliers: number[]; squadCostTenths: number; bankTenths: number; eventTransfers: number }[];
  twinFetched?: number;
  snapshotId?: number;
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
    pagesOk: 0,
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
    const stateKey = `gaffer:cohort:run:${gw}`;
    const rawState = await store.get(stateKey);
    let state: RunState;

    const existing = await db()
      .select({ id: cohortSnapshot.id })
      .from(cohortSnapshot)
      .where(eq(cohortSnapshot.event, gw))
      .limit(1);

    if (existing.length > 0) {
      // Snapshot exists — EO is settled; only the twin top-up can still run.
      if (TWIN_TOPUP_TARGET <= 0) {
        await store.set(freshMarker, String(existing[0].id), 60 * 60 * 6);
        await store.del(stateKey);
        return { ok: true, gw, cohort: COHORT_ID, skipped: "already-built" };
      }
      const twinMarker = `gaffer:cohort:twin:${gw}:${COHORT_ID}`;
      if (await store.get(twinMarker)) {
        await store.set(freshMarker, String(existing[0].id), 60 * 60 * 6);
        await store.del(stateKey);
        return { ok: true, gw, cohort: COHORT_ID, skipped: "already-built" };
      }
      state = rawState ? (JSON.parse(rawState) as RunState) : newState();
      if (!state.pagesLeft) state = newState();
      state.snapshotId = existing[0].id;
      if (state.phase === "pages" || state.phase === "picks") {
        // first twin tick after the EO persist
        state.phase = "twin-pages";
        state.twinSeeds ??= [];
        state.twinPagesLeft ??= logSpacedPages(TWIN_PAGE_BUDGET, MAX_PAGE).filter((p) => !logSpacedPages(PAGE_BUDGET, MAX_PAGE).includes(p));
        state.twinCandidates ??= [];
        state.twinFound ??= [];
        state.twinFetched ??= 0;
      }
    } else {
      state = rawState ? (JSON.parse(rawState) as RunState) : newState();
      if (!state.pagesLeft) state = newState(); // corrupt-state safety net
    }

    // ── Work loop: bounded by wall clock, resumes across ticks ──────────
    while (Date.now() - t0 < WORK_BUDGET_MS) {
      if (state.phase === "pages") {
        if (state.pagesLeft.length === 0) {
        if (state.candidates.length === 0) {
          // Pages answered and the league is empty: normal until the first
          // gameweek is final. No page answered at all: FPL is unreachable,
          // and that is a fault worth reporting.
          const reachedFpl = (state.pagesOk ?? 0) > 0;
          return { ok: reachedFpl, gw, cohort: COHORT_ID, skipped: "no-squads" };
        }
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
          state.pagesOk = (state.pagesOk ?? 0) + 1;
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

      if (state.phase === "picks") {
        const sampled = state.sampled as number[];
        if (state.pickCursor >= sampled.length) break; // fan-out complete → persist below

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
        }
        await sleep(150);
        continue;
      }

      // ── twin top-up — pages sweep entry ids past the EO set (standings
      //    pages carry no squads, so overlap is only knowable after a pick
      //    fetch); twin-fetch then confirms twins against each seed and keeps
      //    the best. Rows persist under matchId so they never join EO aggs.
      if (state.phase === "twin-pages") {
        const candidateCount = state.twinCandidates?.length ?? 0;
        if (candidateCount >= TWIN_MAX_FETCHES || (state.twinPagesLeft?.length ?? 0) === 0) {
          state.phase = "twin-fetch";
          continue;
        }
        const page = state.twinPagesLeft?.shift() as number;
        try {
          const res = await getStandings(LEAGUE_314, page);
          const seeds = new Set((state.twinSeeds ?? []).map((s) => s.entry));
          for (const r of res.standings.results) {
            if (seeds.has(r.entry)) continue; // a seed never needs a twin of itself
            state.twinCandidates?.push(r.entry);
          }
          try {
            const { rememberEntries } = await import("@/lib/server/entryDirectory");
            await rememberEntries(
              res.standings.results.map((x) => ({
                entry: x.entry, teamName: x.entry_name ?? "",
                managerName: x.player_name ?? "", rank: x.rank ?? null,
              })),
              "cohort",
            );
          } catch { /* directory is best-effort */ }
        } catch {
          // failing pages skip silently; the phase still advances
        }
        await sleep(120);
        continue;
      }

      if (state.phase === "twin-fetch") {
        const candidates = state.twinCandidates ?? [];
        const doneCount = state.twinFetched ?? 0;
        if (candidates.length === 0 || doneCount >= TWIN_MAX_FETCHES || (state.twinFound?.length ?? 0) >= TWIN_TOPUP_TARGET) {
          // queue drained or spent → persist what's confirmed and finish
          await flushTwins(state);
          await store.set(`gaffer:cohort:twin:${gw}:${COHORT_ID}`, String(Date.now()), 60 * 60 * 6);
          state.phase = "done";
          continue;
        }
        const batch = candidates.splice(0, PICKS_CONCURRENCY);
        const fetched = await Promise.all(
          batch.map(async (entry) => {
            try {
              return { entry, picks: await fplFetch(`/entry/${entry}/event/${gw}/picks/`, zPicks) };
            } catch {
              return null;
            }
          }),
        );
        state.twinFetched = (state.twinFetched ?? 0) + batch.length;
        for (const f of fetched) {
          if (!f || f.picks.picks.length < 11) continue;
          const elements = f.picks.picks.map((p) => p.element);
          for (const seed of state.twinSeeds ?? []) {
            if (f.entry === seed.entry) continue;
            if ((state.twinFound?.length ?? 0) >= TWIN_TOPUP_TARGET) break;
            if (twinLikelyOverlap(new Set(seed.elements), elements) >= TWIN_MIN_STORE) {
              state.twinFound?.push({
                matchId: seed.entry,
                entry: f.entry,
                elements,
                multipliers: f.picks.picks.map((p) => p.multiplier),
                squadCostTenths: f.picks.entry_history.value - f.picks.entry_history.bank,
                bankTenths: f.picks.entry_history.bank,
                eventTransfers: f.picks.entry_history.event_transfers,
              });
            }
          }
        }
        // honour the store cap: a per-seed twin cache that fits in one JSON state
        if ((state.twinFound?.length ?? 0) >= TWIN_STORE_CAP) {
          await flushTwins(state);
          state.twinFound = [];
        }
        await sleep(150);
        continue;
      }

      if (state.phase === "done") break;
    }

    // ── Done ⇒ either the EO persist just ran, or the twin queue drained ───
    if (state.snapshotId != null || state.squads == null) {
      // twin top-up complete (or never started with a snapshot): finish
      await store.del(stateKey);
      await store.set(freshMarker, String(state.snapshotId ?? 0), 60 * 60 * 6);
      return {
        ok: true, gw, cohort: COHORT_ID,
        sampled: state.sampled?.length ?? 0, squads: state.squads?.length ?? 0,
        elements: 0, ms: Date.now() - t0,
      };
    }

    const engineSquads: EnginePick[][] = ((state.squads as number[][][]) ?? []).map((squad) =>
      squad.map(([element, multiplier]) => toEnginePick({ element, position: 1, multiplier })),
    );
    if (engineSquads.length === 0) {
      // Candidates existed but none of their picks came back — nobody has set
      // a side for this gameweek yet. The run resets and tries again next
      // tick; there is nothing here for a human to fix.
      await store.del(stateKey);
      return { ok: true, gw, cohort: COHORT_ID, skipped: "no-squads" };
    }

    // ── Budget exhausted mid-run → persist state, resume next tick ──────
    if (state.phase !== "done") {
      await store.set(stateKey, JSON.stringify(state), 60 * 60 * 6);
      return {
        ok: true, gw, cohort: COHORT_ID, partial: {
          phase: state.phase,
          pagesLeft: state.pagesLeft.length,
          candidates: state.candidates.length,
          picksDone: state.pickCursor,
          picksTotal: state.sampled?.length ?? 0,
        }, ms: Date.now() - t0,
      };
    }

    // ── EO fan-out complete → aggregate + persist (once per GW) ────────────
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

    // ── top-up: parked state resumes twin-pages on the next tick ───────────
    if (TWIN_TOPUP_TARGET <= 0) {
      await store.del(stateKey);
      await store.set(freshMarker, String(snap.id), 60 * 60 * 6);
      return {
        ok: true, gw, cohort: COHORT_ID,
        sampled: state.sampled?.length ?? 0, squads: engineSquads.length,
        elements: aggregated.length, ms: Date.now() - t0,
      };
    }

    // top-up pending — park so the next cron tick starts twin-pages with the
    // snapshot id; the fresh marker only fires once twins finish (twin-done).
    state.snapshotId = snap.id;
    state.phase = "twin-pages";
    state.twinSeeds = (state.squadsDetailed ?? [])
      .slice(0, TWIN_MATCHES)
      .map((s) => ({ entry: s.entry, elements: s.elements }));
    state.twinPagesLeft = logSpacedPages(TWIN_PAGE_BUDGET, MAX_PAGE)
      .filter((p) => !logSpacedPages(PAGE_BUDGET, MAX_PAGE).includes(p));
    state.twinCandidates = [];
    state.twinFound = [];
    state.twinFetched = 0;
    await store.set(stateKey, JSON.stringify(state), 60 * 60 * 6);

    return {
      ok: true, gw, cohort: COHORT_ID,
      sampled: state.sampled?.length ?? 0, squads: engineSquads.length,
      elements: aggregated.length, ms: Date.now() - t0,
    };
  } finally {
    await store.del(lockKey);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Persist confirmed twins found so far under the run's snapshot, keyed by
 *  matchId; onConflictDoNothing keeps repeats from the overlap of seeds. */
async function flushTwins(state: RunState): Promise<void> {
  const found = state.twinFound ?? [];
  if (!found.length || state.snapshotId == null) return;
  const rows = found.map((t) => ({
    snapshotId: state.snapshotId as number,
    entry: t.entry,
    elements: t.elements,
    counts: [15, t.multipliers.filter((m) => m > 0).length, t.multipliers.filter((m) => m >= 2).length] as [number, number, number],
    squadCostTenths: t.squadCostTenths,
    bankTenths: t.bankTenths,
    eventTransfers: t.eventTransfers,
    matchId: t.matchId,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    await db().insert(cohortEntry).values(rows.slice(i, i + 500)).onConflictDoNothing();
  }
}
