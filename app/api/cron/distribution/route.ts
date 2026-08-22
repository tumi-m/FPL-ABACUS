import { NextRequest, NextResponse } from "next/server";
import { cronGuard } from "@/lib/server/cronGuard";
import { getRankCurveBundle } from "@/lib/server/rankCurveServer";
import { cacheStore } from "@/lib/cache/store";

/** Rebuilds the rank curve. Idempotent; cheap once cached. */
export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;

  try {
    const bootLite = await import("@/lib/fpl/bootstrapLite").then((m) => m.getBootstrapLite());
    const gw = bootLite.events.find((e) => e.is_current)?.id ?? 1;
    await cacheStore().del(`gaffer:rankcurve:${gw}`);
    const bundle = await getRankCurveBundle(gw);
    return NextResponse.json({
      ok: true,
      gw,
      sampleSize: bundle.sampleSize,
      fieldAvg: bundle.fieldAvg,
      monotone: bundle.curve ? bundle.curve.points.every((p, i, a) => i === 0 || p.total <= a[i - 1].total) : false,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
