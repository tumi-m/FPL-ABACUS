import { NextRequest, NextResponse } from "next/server";
import { buildRivalSquad } from "@/lib/server/buildRivalSquad";

export const dynamic = "force-dynamic";

/** v4-E — the rival's gameweek through the same live-squad engine as yours. */
export async function GET(req: NextRequest) {
  const entry = Number(req.nextUrl.searchParams.get("entry"));
  const gwParam = req.nextUrl.searchParams.get("gw");
  const gw = gwParam != null && /^\d+$/.test(gwParam) ? Number(gwParam) : undefined;
  if (!Number.isFinite(entry) || entry <= 0) {
    return NextResponse.json({ error: "bad-entry" }, { status: 400 });
  }
  try {
    const result = await buildRivalSquad(entry, gw);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
