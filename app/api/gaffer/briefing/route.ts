import { NextRequest, NextResponse } from "next/server";
import { buildBriefing } from "@/lib/server/buildBriefing";
import { WATCH_LIMIT } from "@/lib/store/watchlistCore";

export const dynamic = "force-dynamic";

/**
 * The proactive briefing (v10 B2).
 *
 * Five deterministic triggers, detected server-side and rendered as sentences
 * whose figures the engine already licensed. The watchlist's ids ride the
 * query string because the list itself lives in the browser. With no
 * triggers the response is `{ lines: [] }` — the surface renders nothing
 * rather than padding, which is the whole point of an assistant that opens
 * its mouth only when it has something worth saying.
 */
export async function GET(req: NextRequest) {
  const entryId = Number(req.nextUrl.searchParams.get("entry"));
  if (!Number.isFinite(entryId) || entryId <= 0) {
    return NextResponse.json({ error: "entry query param required" }, { status: 400 });
  }
  const ids = (req.nextUrl.searchParams.get("watch") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, WATCH_LIMIT);

  try {
    const data = await buildBriefing(entryId, ids);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
    });
  } catch {
    // The briefing is an enhancement everywhere it appears; the cause goes to
    // the log, the surface renders nothing.
    console.error("[api/gaffer/briefing] compose failed");
    return NextResponse.json({ lines: [] });
  }
}