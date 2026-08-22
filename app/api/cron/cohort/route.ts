import { NextRequest, NextResponse } from "next/server";
import { cronGuard } from "@/lib/server/cronGuard";
import { hasDb } from "@/lib/env";
import { buildCohortSnapshot } from "@/lib/server/cohortBuilder";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";

export const maxDuration = 300;

/** Every 10 min: builds the sampled cohort EO snapshot for the live gameweek.
 *  Fast-paths (lock/fresh/already-built) return immediately; the heavy sweep
 *  only runs once per GW. No-ops without DATABASE_URL. */
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
    return NextResponse.json({ ok: false, error: String(err instanceof Error ? err.message : err) }, { status: 502 });
  }
}
