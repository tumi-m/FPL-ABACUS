import { NextRequest, NextResponse } from "next/server";
import { cronGuard } from "@/lib/server/cronGuard";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getEventStatus, getFixtures, getLive } from "@/lib/fpl/endpoints";

export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;

  const started = Date.now();
  try {
    const boot = await getBootstrapLite();
    const status = await getEventStatus();
    const gw = boot.events.find((e) => e.is_current)?.id ?? boot.events[0]?.id ?? 1;
    await Promise.all([getFixtures(gw), getLive(gw)]);
    return NextResponse.json({ ok: true, warmed: ["bootstrap", "event-status", `fixtures:${gw}`, `live:${gw}`], ms: Date.now() - started });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
