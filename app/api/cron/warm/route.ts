import { NextRequest, NextResponse } from "next/server";
import { cronGuard } from "@/lib/server/cronGuard";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixtures, getFixturesAll, getLive } from "@/lib/fpl/endpoints";
import { getRankCurveBundle } from "@/lib/server/rankCurveServer";
import { cronFailure } from "@/lib/server/upstreamRefusal";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;

  const started = Date.now();
  try {
    const boot = await getBootstrapLite();
    const gw = boot.events.find((e) => e.is_current)?.id ?? boot.events[0]?.id ?? 1;

    // One wave: the rank curve samples standings pages and the season fixture
    // list is independent of the GW reads — they used to go out in sequence.
    const [, , curve] = await Promise.all([
      getFixtures(gw),
      getLive(gw),
      getRankCurveBundle(gw).catch(() => null),
      getFixturesAll().catch(() => []),
    ]);

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
    console.error("[api/cron/warm] warm failed", err);
    /*
     * Say which. "warm-failed" told the scheduler nothing: when FPL answered
     * 403 for a few minutes this route reported a bare string while the cohort
     * route next to it named the cause, so the only endpoint that could
     * explain the outage was the one that happened to have better wording.
     * An upstream refusal is labelled as one so the workflow can tell an
     * outage apart from a fault of ours, and a human reading the log learns
     * something either way.
     */
    return NextResponse.json(cronFailure(err, "warm-failed"), { status: 502 });
  }
}
