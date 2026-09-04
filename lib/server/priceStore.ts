import "server-only";

/**
 * Price store — the only module that reads price history from Postgres.
 * Feeds lib/engines/price.ts pressure(): recent per-player snapshots plus the
 * last confirmed change, and the daily rises/falls ledger for the history
 * section.
 *
 * Every read goes through `dbRead`, so no database, an unmigrated one, or a
 * failing query all land in the same place: empty. The price model already
 * says so honestly ("stored hourly snapshots have not covered this player
 * yet") rather than the caller seeing a Postgres error.
 */
import { desc, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { dbRead } from "@/lib/db/read";
import { priceChange, priceSnapshot } from "@/lib/db/schema";
import type { PriceSnapshot } from "@/lib/engines/price";

export interface PlayerPriceHistory {
  snapshots: PriceSnapshot[];
  lastChangeAt: Date | null;
  lastChange: { direction: "up" | "down"; from: number; to: number } | null;
}

/** Recent snapshot rows for the given elements (bounded, newest last). */
export async function loadSnapshots(
  elements: number[],
  maxAgeDays = 14,
): Promise<Map<number, PriceSnapshot[]>> {
  if (elements.length === 0) return new Map();
  return dbRead("price snapshots", () => new Map<number, PriceSnapshot[]>(), async () => {
    const out = new Map<number, PriceSnapshot[]>();
    const since = new Date(Date.now() - maxAgeDays * 86_400_000);
    const rows = await db()
      .select({
        element: priceSnapshot.element,
        capturedAt: priceSnapshot.capturedAt,
        transfersIn: priceSnapshot.transfersIn,
        transfersOut: priceSnapshot.transfersOut,
      })
      .from(priceSnapshot)
      .where(gte(priceSnapshot.capturedAt, since))
      .orderBy(desc(priceSnapshot.capturedAt))
      .limit(60_000);
    const wanted = new Set(elements);
    for (const r of rows) {
      if (!wanted.has(r.element)) continue;
      const list = out.get(r.element) ?? [];
      if (list.length < 48) {
        list.push({ capturedAt: r.capturedAt, transfersIn: r.transfersIn, transfersOut: r.transfersOut });
      }
      out.set(r.element, list);
    }
    for (const list of out.values()) list.reverse();
    return out;
  });
}

/** Last confirmed change per element + the daily rises/falls ledger. */
export async function loadChangeLedger(
  maxAgeDays = 14,
): Promise<{ lastByElement: Map<number, { at: Date; direction: "up" | "down"; from: number; to: number }>; byDay: Map<string, { rises: number[]; falls: number[] }> }> {
  const empty = () => ({
    lastByElement: new Map<number, { at: Date; direction: "up" | "down"; from: number; to: number }>(),
    byDay: new Map<string, { rises: number[]; falls: number[] }>(),
  });
  return dbRead("price change ledger", empty, async () => {
    const { lastByElement, byDay } = empty();
    const since = new Date(Date.now() - maxAgeDays * 86_400_000);
    const rows = await db()
      .select({
        element: priceChange.element,
        changedAt: priceChange.changedAt,
        direction: priceChange.direction,
        from: priceChange.from,
        to: priceChange.to,
      })
      .from(priceChange)
      .where(gte(priceChange.changedAt, since))
      .orderBy(desc(priceChange.changedAt))
      .limit(5_000);
    for (const r of rows) {
      const direction = r.direction === "up" ? "up" : "down";
      if (!lastByElement.has(r.element)) {
        lastByElement.set(r.element, { at: r.changedAt, direction, from: r.from, to: r.to });
      }
      const day = r.changedAt.toISOString().slice(0, 10);
      const entry = byDay.get(day) ?? { rises: [], falls: [] };
      (direction === "up" ? entry.rises : entry.falls).push(r.element);
      byDay.set(day, entry);
    }
    return { lastByElement, byDay };
  });
}
