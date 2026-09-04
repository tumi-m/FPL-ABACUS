import { NextRequest, NextResponse } from "next/server";
import { getElementSummary } from "@/lib/fpl/endpoints";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { estimateMinutes, MIN_APPEARANCES } from "@/lib/engines/minutes";

export const dynamic = "force-dynamic";

/**
 * Minutes certainty (v10 D2) — P(start)/P(60+) for a handful of players,
 * fetched when a surface needs it rather than shipped with every page.
 *
 * The element-summary endpoint is per-player, so the Field's PeekSheet and
 * the Planner's sell list ask for exactly the players on screen — never the
 * whole market. Each summary is cached server-side (swr), so a player who
 * was peeked once costs one upstream read for everyone for the cache window.
 *
 * Returns per-player estimates, including honest thin states: below
 * MIN_APPEARANCES the model refuses and `reliable` is false. The client
 * renders "Not enough history" — the watchlist's house style — rather than
 * a probability dressed up as one.
 */
export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("players") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 20);

  if (ids.length === 0) {
    return NextResponse.json({ error: "no-players" }, { status: 400 });
  }

  const boot = await getBootstrapLite().catch(() => null);
  const currentGw =
    boot?.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot?.events.find((e) => e.is_next)?.id ?? 2) - 1);

  const players = await Promise.all(
    ids.map(async (id) => {
      try {
        const summary = await getElementSummary(id);
        const el = boot?.elements[id];
        const est = estimateMinutes(
          summary.history.map((h) => ({ gw: h.round, minutes: h.minutes, started: h.starts > 0 })),
          { nowGw: currentGw },
        );
        return {
          id,
          pStart: est.reliable ? est.pStart : null,
          p60: est.reliable ? est.p60 : null,
          expectedMinutes: est.reliable ? est.expectedMinutes : null,
          interval: est.reliable ? est.pStartInterval : null,
          appearances: est.appearances,
          reliable: est.reliable,
          note: est.note,
          status: el?.status ?? "a",
          chanceOfPlaying: el?.chance_of_playing_this_round ?? null,
        };
      } catch {
        return {
          id,
          pStart: null,
          p60: null,
          expectedMinutes: null,
          interval: null,
          appearances: 0,
          reliable: false,
          note: "The history feed did not answer — the model has nothing to read.",
          status: "a",
          chanceOfPlaying: null as number | null,
        };
      }
    }),
  );

  return NextResponse.json(
    { currentGw, minAppearances: MIN_APPEARANCES, players },
    { headers: { "Cache-Control": "public, max-age=600" } },
  );
}