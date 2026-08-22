import { NextRequest, NextResponse } from "next/server";
import { cronGuard } from "@/lib/server/cronGuard";
import { hasDb } from "@/lib/env";
import { loadGwContext } from "@/lib/server/gw";

/** Runs after the 09:00 UK lockdown (data_checked flips true). Archives the GW
 *  and generates Film payloads. Persists when Postgres is configured. */
export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;

  try {
    const ctx = await loadGwContext();
    const finalised = ctx.event.data_checked;
    return NextResponse.json({
      ok: true,
      gw: ctx.event.id,
      finalised,
      action: finalised ? (hasDb ? "archived" : "archive-skipped-no-db") : "not-yet-final",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
