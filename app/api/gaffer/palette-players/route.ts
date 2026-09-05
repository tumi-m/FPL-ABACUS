import { NextResponse } from "next/server";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";

/**
 * A2 — player names for the command palette. A slim read over the lite
 * bootstrap (already cached server-side for five minutes): id, name,
 * position, club code. No projections, no prices — the palette navigates,
 * it does not rank. The payload is the whole selectable market once,
 * because the palette filters it locally on every keystroke — a request
 * per keystroke is a palette you give up on.
 */
export async function GET() {
  const boot = await getBootstrapLite();
  const players = Object.values(boot.elements).map((e) => ({
    id: e.id,
    name: e.web_name,
    pos: e.element_type,
    club: e.team,
  }));
  return NextResponse.json(
    { players },
    {
      headers: {
        // The bootstrap is a five-minute cache; the browser can hold it longer.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}