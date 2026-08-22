import { NextRequest, NextResponse } from "next/server";
import { cronGuard } from "@/lib/server/cronGuard";
import { hasDb } from "@/lib/env";
import { getBootstrap } from "@/lib/fpl/endpoints";
import { cacheStore } from "@/lib/cache/store";

interface CompactSnapshot {
  [elementId: number]: { c: number };
}

/** Hourly price job: diffs against the previous snapshot, records changes.
 *  Persists to Postgres when DATABASE_URL is configured. */
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

    return NextResponse.json({
      ok: true,
      persisted: hasDb,
      elements: Object.keys(current).length,
      changes,
      note: hasDb ? undefined : "no-database-configured; changes reported but not stored",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
