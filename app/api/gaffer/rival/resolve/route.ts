import { NextRequest, NextResponse } from "next/server";
import { getStandings } from "@/lib/fpl/endpoints";
import { mapPool } from "@/lib/server/mapPool";
import { COHORT_LEAGUE_ID } from "@/lib/server/rankCurveServer";

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

  // Six pages through the bounded pool, not one at a time — the pages are
  // cached so a warm league answers instantly, and a cold one costs one wave.
  const pages = await mapPool(
    [1, 2, 3, 4, 5, 6],
    4,
    (page) => getStandings(COHORT_LEAGUE_ID, page).catch(() => null),
    () => null,
  );
  const matches: { entry: number; entryName: string; playerName: string }[] = [];
  const seen = new Set<number>();
  for (const res of pages) {
    if (!res) continue;
    const rows = res.standings.results as { entry: number; entry_name: string; player_name: string }[];
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
