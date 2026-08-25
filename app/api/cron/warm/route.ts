import { NextRequest, NextResponse } from "next/server";
import { cronGuard } from "@/lib/server/cronGuard";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixtures, getFixturesAll, getLive } from "@/lib/fpl/endpoints";
import { getRankCurveBundle } from "@/lib/server/rankCurveServer";

export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;

  const started = Date.now();
  try {
    const boot = await getBootstrapLite();
    const gw = boot.events.find((e) => e.is_current)?.id ?? boot.events[0]?.id ?? 1;

    // The rank curve samples two dozen standings pages, so it is by far the
    // most expensive thing any page can ask for. Pages now refuse to wait on
    // it, which means it is only ever fast if something else has filled the
    // cache first — that is this job. Its failure must not fail the warm.
    const [, , curve] = await Promise.all([
      getFixtures(gw),
      getLive(gw),
      getRankCurveBundle(gw).catch(() => null),
    ]);
    // The season fixture list feeds the Board, the planner and the fixture model.
    await getFixturesAll().catch(() => []);

    return NextResponse.json({
      ok: true,
      warmed: [
        "bootstrap",
        "event-status",
        `fixtures:${gw}`,
        `live:${gw}`,
        "fixtures:all",
        curve ? `rankcurve:${gw} (${curve.sampleSize} samples)` : `rankcurve:${gw} (failed)`,
      ],
      ms: Date.now() - started,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
