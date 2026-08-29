import { NextRequest, NextResponse } from "next/server";
import { cronGuard } from "@/lib/server/cronGuard";
import { hasDb } from "@/lib/env";
import { explainDbError } from "@/lib/db";
import { buildCohortSnapshot } from "@/lib/server/cohortBuilder";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";

export const maxDuration = 60;

/** Every 10 min: builds the sampled cohort EO snapshot for the live gameweek.
 *  The builder is resumable — each invocation does ≤20s of upstream work and
 *  persists its progress, so this fits any plan's function limit. Fast paths
 *  (lock/fresh/already-built/partial) return immediately; no-ops without DB. */
export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;

  if (!hasDb) {
    // DECISION: without Postgres the cohort snapshot has nowhere durable to
    // live; the app falls back to estimated EO and this job is a no-op.
    return NextResponse.json({ ok: true, skipped: "no-database-configured" });
  }

  try {
    const boot = await getBootstrapLite();
    const gw = boot.events.find((e) => e.is_current)?.id ?? boot.events.find((e) => e.is_next)?.id;
    if (!gw) return NextResponse.json({ ok: false, error: "no current or next event" }, { status: 502 });

    const result = await buildCohortSnapshot(gw);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: explainDbError(err) }, { status: 502 });
  }
}
