import { NextResponse } from "next/server";
import { loadGwContext, liveBarData } from "@/lib/server/gw";

export const dynamic = "force-dynamic";

/**
 * The gameweek's state, on its own request.
 *
 * The landing page is the first thing anybody sees and it is fully static, so
 * nothing on it is allowed to wait on the FPL API. The status reads itself in
 * after hydration through here instead — a cached upstream read behind a
 * thirty-second browser cache.
 */
export async function GET() {
  try {
    const ctx = await loadGwContext();
    return NextResponse.json(liveBarData(ctx), {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" },
    });
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
