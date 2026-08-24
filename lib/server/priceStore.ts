import "server-only";

/**
 * Price store — the only module that reads price history from Postgres.
 * Feeds lib/engines/price.ts pressure(): recent per-player snapshots plus the
 * last confirmed change, and the daily rises/falls ledger for the history
 * section. Degrades to empty when no database is configured.
 */
import { desc, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { hasDb } from "@/lib/env";
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
  const out = new Map<number, PriceSnapshot[]>();
  if (!hasDb || elements.length === 0) return out;
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
  for (const r of rows) {
    if (!elements.includes(r.element)) continue;
    const list = out.get(r.element) ?? [];
    if (list.length < 48) list.push({ capturedAt: r.capturedAt, transfersIn: r.transfersIn, transfersOut: r.transfersOut });
    out.set(r.element, list);
  }
  for (const list of out.values()) list.reverse();
  return out;
}

/** Last confirmed change per element + the daily rises/falls ledger. */
export async function loadChangeLedger(
  maxAgeDays = 14,
): Promise<{ lastByElement: Map<number, { at: Date; direction: "up" | "down"; from: number; to: number }>; byDay: Map<string, { rises: number[]; falls: number[] }> }> {
  const lastByElement = new Map<number, { at: Date; direction: "up" | "down"; from: number; to: number }>();
  const byDay = new Map<string, { rises: number[]; falls: number[] }>();
  if (!hasDb) return { lastByElement, byDay };
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
}

/** Row count guard for the desk — how deep our history actually is. */
export async function priceCoverage(): Promise<{ snapshots: number; changes: number } | null> {
  if (!hasDb) return null;
  const [snap] = await db().select({ n: sql<number>`count(*)::int` }).from(priceSnapshot);
  const [chg] = await db().select({ n: sql<number>`count(*)::int` }).from(priceChange);
  return { snapshots: snap?.n ?? 0, changes: chg?.n ?? 0 };
}
