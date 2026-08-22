import { NextRequest, NextResponse } from "next/server";
import { buildMatchday } from "@/lib/server/buildMatchday";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const entryId = Number(req.nextUrl.searchParams.get("entry"));
  if (!Number.isFinite(entryId) || entryId <= 0) {
    return NextResponse.json({ error: "entry query param required" }, { status: 400 });
  }

  try {
    const result = await buildMatchday(entryId);
    if (!result.ok) {
      if (result.reason === "picks-not-set") {
        return NextResponse.json({ error: "picks-not-set" }, { status: 200 });
      }
      return NextResponse.json({ error: result.reason, message: result.message }, { status: 502 });
    }
    return NextResponse.json(result.model, {
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "compose-failed", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
