import { NextRequest, NextResponse } from "next/server";
import { cronGuard } from "@/lib/server/cronGuard";
import { hasDb } from "@/lib/env";
import { db, explainDbError } from "@/lib/db";
import { rawArchive, scoreDistribution } from "@/lib/db/schema";
import { loadGwContext } from "@/lib/server/gw";
import { getRankCurveBundle } from "@/lib/server/rankCurveServer";

/** Runs after the 09:00 UK lockdown (data_checked flips true). Archives the GW:
 *  raw payloads into raw_archive + the sampled score distribution snapshot. */
export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;

  try {
    const ctx = await loadGwContext();
    const finalised = ctx.event.data_checked;
    if (!finalised) {
      return NextResponse.json({ ok: true, gw: ctx.event.id, finalised: false, action: "not-yet-final" });
    }

    if (!hasDb) {
      return NextResponse.json({ ok: true, gw: ctx.event.id, finalised: true, action: "archive-skipped-no-db" });
    }

    // Raw archive: the payloads every future replay/audit needs.
    const now = new Date();
    await db().insert(rawArchive).values([
      { endpoint: `fixtures/${ctx.event.id}`, event: ctx.event.id, capturedAt: now, body: { fixtures: ctx.fixtures } },
      { endpoint: `event-live/${ctx.event.id}`, event: ctx.event.id, capturedAt: now, body: ctx.live as unknown as Record<string, unknown> },
      { endpoint: "event-status", event: null, capturedAt: now, body: ctx.status as unknown as Record<string, unknown> },
    ]);

    // Score distribution snapshot from the sampled curve bundle.
    const bundle = await getRankCurveBundle(ctx.event.id);
    let distRows = 0;
    if (bundle.sampleSize > 0 && bundle.fieldAvg > 0) {
      await db()
        .insert(scoreDistribution)
        .values({
          event: ctx.event.id,
          kind: "sample",
          score: bundle.fieldAvg,
          cumCount: Math.round(bundle.sampleSize / 2),
          totalPop: bundle.sampleSize,
        })
        .onConflictDoUpdate({
          target: [scoreDistribution.event, scoreDistribution.kind, scoreDistribution.score],
          set: { cumCount: Math.round(bundle.sampleSize / 2), totalPop: bundle.sampleSize, updatedAt: now },
        });
      distRows = 1;
    }

    // v3-10 Twin Study settle: resolve per-entry outcomes for the sampled
    // cohort (resumable — partial progress continues on the next 09:10-09:19
    // tick until the cursor completes).
    let twin: { settled?: number; partial?: { done: number; total: number }; skipped?: string } = {};
    try {
      const { settleCohortOutcomes } = await import("@/lib/server/twinSettle");
      const r = await settleCohortOutcomes(ctx.event.id);
      twin = { settled: r.settled, partial: r.partial, skipped: r.skipped };
    } catch {
      twin = { skipped: "twin-settle-error" };
    }

    return NextResponse.json({
      ok: true,
      gw: ctx.event.id,
      finalised: true,
      action: "archived",
      archivedFixtures: ctx.fixtures.length,
      distributionRows: distRows,
      twin,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: explainDbError(err) }, { status: 502 });
  }
}
