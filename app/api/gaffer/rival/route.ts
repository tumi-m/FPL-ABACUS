import { NextRequest, NextResponse } from "next/server";
import { buildRivalSquad } from "@/lib/server/buildRivalSquad";

export const dynamic = "force-dynamic";

/** v4-E — the rival's gameweek through the same live-squad engine as yours. */
export async function GET(req: NextRequest) {
  const entry = Number(req.nextUrl.searchParams.get("entry"));
  const gwParam = req.nextUrl.searchParams.get("gw");
  const gw = gwParam != null && /^\d+$/.test(gwParam) ? Number(gwParam) : undefined;
  if (!Number.isFinite(entry) || entry <= 0) {
    return NextResponse.json(
      { ok: false, reason: "no-such-entry", entry, gw },
      { status: 200 },
    );
  }
  try {
    const result = await buildRivalSquad(entry, gw);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    // A failure the builder could not attribute is still ours, not the rival's.
    // It comes back 200 with a reason so the Field can say which of the four
    // things went wrong instead of falling through to one generic sentence.
    return NextResponse.json({ ok: false, reason: "upstream", entry, gw: gw ?? null });
  }
}
