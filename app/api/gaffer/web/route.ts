import { NextRequest, NextResponse } from "next/server";
import { buildCorrelationWeb } from "@/lib/server/buildCorrelationWeb";

export const dynamic = "force-dynamic";

/** Field modes 5+6 feed — the correlation web for one entry's XI. */
export async function GET(req: NextRequest) {
  const entry = Number(req.nextUrl.searchParams.get("entry"));
  if (!Number.isFinite(entry) || entry <= 0) {
    return NextResponse.json({ error: "bad-entry" }, { status: 400 });
  }
  try {
    const web = await buildCorrelationWeb(entry);
    if (!web) {
      // picks not set / no finished matches yet — the honest "not ready"
      return NextResponse.json(null, { headers: { "Cache-Control": "private, max-age=60" } });
    }
    return NextResponse.json(web, { headers: { "Cache-Control": "private, max-age=120" } });
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
