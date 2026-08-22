import { NextRequest, NextResponse } from "next/server";
import { cronGuard } from "@/lib/server/cronGuard";
import { hasDb } from "@/lib/env";

export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;

  if (!hasDb) {
    // DECISION: without Postgres the cohort snapshot has nowhere durable to
    // live; the app falls back to estimated EO and this job is a no-op.
    return NextResponse.json({ ok: true, skipped: "no-database-configured" });
  }

  // Full cohort sampling (stratified pages + reservoir + picks fan-out) lands
  // with the Neon wiring in the deploy phase.
  return NextResponse.json({ ok: true, skipped: "cohort-builder-pending-db-wiring" });
}
