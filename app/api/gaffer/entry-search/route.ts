import { NextRequest, NextResponse } from "next/server";
import { searchEntries } from "@/lib/server/entryDirectory";
import { hasDb } from "@/lib/env";

/**
 * Gate name search — team name or manager name → entry ids from the
 * directory of managers Gaffer has actually seen. No database, no index,
 * no guesses: the honest empty state is the contract.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const mode = req.nextUrl.searchParams.get("mode") === "manager" ? "manager" : "team";
  if (q.length < 3 || q.length > 60) {
    return NextResponse.json({ ok: false, reason: "bad-query" }, { status: 400 });
  }
  if (!hasDb) {
    return NextResponse.json({ ok: false, reason: "no-database" });
  }
  try {
    const results = await searchEntries(q, mode);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    // Postgres failure text can carry connection details — log, never echo.
    console.error("[api/gaffer/entry-search] search failed", err);
    return NextResponse.json({ ok: false, reason: "search-failed" }, { status: 502 });
  }
}
