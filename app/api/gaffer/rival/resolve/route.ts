import { NextRequest, NextResponse } from "next/server";
import { getStandings } from "@/lib/fpl/endpoints";

/**
 * Resolve a manager NAME to an entry id so the Field's compare box accepts
 * both ids and names. Searches the cohort mini-league's cached standings
 * (SWR makes repeat lookups free); ids need no resolution.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 3) {
    return NextResponse.json({ ok: false, reason: "too-short" }, { status: 400 });
  }

  const matches: { entry: number; entryName: string; playerName: string }[] = [];
  const seen = new Set<number>();
  for (let page = 1; page <= 6 && matches.length < 8; page++) {
    let rows: { entry: number; entry_name: string; player_name: string }[];
    try {
      const res = await getStandings(314, page);
      rows = res.standings.results as typeof rows;
    } catch {
      break;
    }
    for (const r of rows) {
      if (seen.has(r.entry)) continue;
      seen.add(r.entry);
      const hay = `${r.entry_name} ${r.player_name}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({ entry: r.entry, entryName: r.entry_name, playerName: r.player_name });
        if (matches.length >= 8) break;
      }
    }
  }

  return NextResponse.json({ ok: true, matches });
}
