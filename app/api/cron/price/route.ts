import { NextRequest, NextResponse } from "next/server";
import { cronGuard } from "@/lib/server/cronGuard";
import { hasDb } from "@/lib/env";
import { db, explainDbError, isMissingSchema } from "@/lib/db";
import { priceChange, priceSnapshot } from "@/lib/db/schema";
import { getBootstrap } from "@/lib/fpl/endpoints";
import { cacheStore } from "@/lib/cache/store";

interface CompactSnapshot {
  [elementId: number]: { c: number };
}

const CHUNK = 400;

/** Hourly price job: diffs against the previous snapshot, records changes,
 *  persists the full snapshot (and any changes) to Postgres when configured. */
export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;

  try {
    const boot = await getBootstrap();
    const current: CompactSnapshot = {};
    for (const el of boot.elements) {
      current[el.id] = { c: el.now_cost };
    }

    const store = cacheStore();
    const key = "gaffer:pricesnap:prev";
    const rawPrev = await store.get(key);
    const changes: { element: number; from: number; to: number }[] = [];

    if (rawPrev) {
      const prev = JSON.parse(rawPrev) as CompactSnapshot;
      for (const [id, cur] of Object.entries(current)) {
        const before = prev[Number(id)];
        if (before && before.c !== cur.c) {
          changes.push({ element: Number(id), from: before.c, to: cur.c });
        }
      }
    }
    await store.set(key, JSON.stringify(current), 60 * 60 * 25);

    let persisted = false;
    let persistedError: string | null = null;
    let persistedMissingSchema = false;
    if (hasDb) {
      try {
        const now = new Date();
        for (let i = 0; i < boot.elements.length; i += CHUNK) {
          await db()
            .insert(priceSnapshot)
            .values(
              boot.elements.slice(i, i + CHUNK).map((el) => ({
                element: el.id,
                capturedAt: now,
                nowCost: el.now_cost,
                transfersIn: el.transfers_in_event,
                transfersOut: el.transfers_out_event,
                selectedBy: Number(el.selected_by_percent),
              })),
            );
        }
        if (changes.length > 0) {
          for (let i = 0; i < changes.length; i += CHUNK) {
            await db()
              .insert(priceChange)
              .values(
                changes.slice(i, i + CHUNK).map((c) => ({
                  element: c.element,
                  changedAt: now,
                  direction: c.to > c.from ? "up" : "down",
                  from: c.from,
                  to: c.to,
                })),
              );
          }
        }
        persisted = true;
      } catch (err) {
        persistedError = explainDbError(err);
        persistedMissingSchema = isMissingSchema(err);
      }
    }

    /*
     * The price read itself succeeded; only the write had nowhere to go. That
     * is the same "deployment step not yet run" as the other jobs, so it says
     * `skipped` in the same shape rather than `ok: false` under a 200 — which
     * was neither a failure the tick could act on nor a skip anything counted.
     */
    return NextResponse.json({
      ok: persistedError === null || persistedMissingSchema,
      persisted,
      skipped: persistedMissingSchema ? "no-schema" : !hasDb ? "no-database-configured" : undefined,
      elements: Object.keys(current).length,
      changes,
      note: hasDb
        ? persistedError
          ? `persist failed: ${persistedError}`
          : undefined
        : "no-database-configured; changes reported but not stored",
    });
  } catch (err) {
    /* A missing schema is a deployment step, not an outage — see the note in
       the cohort route. Skip rather than fail, so the scheduled tick does not
       go red around the clock on an unchanging fact; db-check nags daily. */
    if (isMissingSchema(err)) {
      return NextResponse.json({ ok: true, skipped: "no-schema", error: explainDbError(err) });
    }
    return NextResponse.json({ ok: false, error: explainDbError(err) }, { status: 502 });
  }
}
