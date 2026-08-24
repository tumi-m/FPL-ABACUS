import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cohortEntry, cohortSnapshot } from "@/lib/db/schema";
import { cacheStore } from "@/lib/cache/store";
import { fplFetch } from "@/lib/fpl/client";
import { zEntryHistory, zPicks } from "@/lib/fpl/schemas";

/**
 * v3-10 Twin Study settle pass — runs once the GW is final (data_checked).
 * For every cohort_entry of the settled GW: fetch the entry's season history
 * (one request each, resumable across ticks via the cache-store cursor) and
 * persist the outcome: gwPoints (net of hits), captainPoints, and the arm —
 * transfer | hit | chip | captain | hold — derived from the picks payload
 * (active_chip) plus event_transfers / event_transfers_cost.
 */
const WORK_BUDGET_MS = 20_000;
const BATCH = 6;

export interface TwinSettleResult {
  ok: boolean;
  gw: number;
  settled?: number;
  skipped?: "lock-held" | "no-snapshot" | "already-settled";
  partial?: { done: number; total: number };
  ms?: number;
}

export function armOf(
  eventTransfers: number,
  transferCost: number,
  activeChip: string | null,
  captainMultiplier: number | null,
): "transfer" | "hit" | "chip" | "captain" | "hold" {
  if (activeChip != null && activeChip !== "") return "chip";
  if (transferCost > 0) return "hit";
  if (captainMultiplier != null && captainMultiplier >= 3) return "captain";
  if (eventTransfers > 0) return "transfer";
  return "hold";
}

export async function settleCohortOutcomes(gw: number): Promise<TwinSettleResult> {
  const t0 = Date.now();
  const store = cacheStore();

  const snapRows = await db()
    .select({ id: cohortSnapshot.id })
    .from(cohortSnapshot)
    .where(eq(cohortSnapshot.event, gw))
    .limit(1);
  if (!snapRows.length) return { ok: true, gw, skipped: "no-snapshot" };
  const snapshotId = snapRows[0].id;

  const doneKey = `gaffer:twin:settled:${gw}`;
  if (await store.get(doneKey)) return { ok: true, gw, skipped: "already-settled" };
  const lockKey = `gaffer:twin:lock:${gw}`;
  if (await store.get(lockKey)) return { ok: true, gw, skipped: "lock-held" };
  await store.set(lockKey, String(t0), 60 * 20);

  try {
    const rows = await db()
      .select({ entry: cohortEntry.entry, matchId: cohortEntry.matchId })
      .from(cohortEntry)
      .where(eq(cohortEntry.snapshotId, snapshotId));
    const cursorKey = `gaffer:twin:cursor:${gw}`;
    const rawCursor = await store.get(cursorKey);
    let done = rawCursor ? Number(rawCursor) : 0;

    while (Date.now() - t0 < WORK_BUDGET_MS && done < rows.length) {
      const batch = rows.slice(done, done + BATCH).map((r) => r.entry);
      const settled = await Promise.all(
        batch.map(async (entryId) => {
          try {
            const [picks, history] = await Promise.all([
              fplFetch(`/entry/${entryId}/event/${gw}/picks/`, zPicks),
              fplFetch(`/entry/${entryId}/history/`, zEntryHistory),
            ]);
            const gwRow = history.current.find((h) => h.event === gw) ?? null;
            const arm = armOf(
              picks.entry_history.event_transfers,
              picks.entry_history.event_transfers_cost,
              picks.active_chip ?? null,
              picks.picks.find((p) => p.is_captain)?.multiplier ?? null,
            );
            return {
              entry: entryId,
              gwPoints: gwRow?.points ?? picks.entry_history.points,
              // captain attribution needs the live breakdown — left null here;
              // the pairing engine treats null as "unknown", not zero
              captainPoints: null as number | null,
              arm,
              hasData: gwRow != null,
            };
          } catch {
            return null;
          }
        }),
      );
      done += batch.length;

      // persist what we got — one outcome per (entry, match) row so the EO
      // sample and every requesting squad's twin rows get the same settled
      // verdict, not a single match row.
      for (const s of settled) {
        if (!s || !s.hasData) continue;
        const pairs = rows.filter((r) => r.entry === s.entry);
        for (const p of pairs) {
          await db()
            .update(cohortEntry)
            .set({ gwPoints: s.gwPoints, captainPoints: s.captainPoints, arm: s.arm })
            .where(and(
              eq(cohortEntry.snapshotId, snapshotId),
              eq(cohortEntry.entry, s.entry),
              eq(cohortEntry.matchId, p.matchId),
            ));
        }
      }
      await store.set(cursorKey, String(done), 60 * 60 * 24);
      await sleep(120);
    }

    if (done < rows.length) {
      return { ok: true, gw, partial: { done, total: rows.length }, ms: Date.now() - t0 };
    }

    await store.del(cursorKey);
    await store.set(doneKey, String(done), 60 * 60 * 24 * 30);
    return { ok: true, gw, settled: done, ms: Date.now() - t0 };
  } finally {
    await store.del(lockKey);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
