import { NextRequest, NextResponse } from "next/server";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { buildPercentiles } from "@/lib/engines/playerPercentiles";
import { buildRadar } from "@/lib/engines/playerRadar";

export const dynamic = "force-dynamic";

/**
 * One player's attribute web.
 *
 * Server-side because the percentile is only meaningful against the whole
 * market: the cohort is every same-position player over the minutes floor,
 * which is six hundred rows the client has no business downloading to draw
 * one hexagon. Bootstrap is already cached for everyone, so this is cheap
 * after the first caller.
 *
 * Fetched when the pitch's peek sheet opens, the same shape as the minutes
 * route beside it — the pitch draws twenty-two tokens and nobody peeks at
 * more than a few, so shipping a radar with every page would be paying for
 * twenty of them to be thrown away.
 */

/**
 * The minutes floor for a comparable season.
 *
 * Three appearances' worth. Below it a per-90 is one good afternoon
 * extrapolated across a season, and the cohort fills with players whose
 * rates are noise — which drags every real percentile toward the middle.
 */
const MIN_MINUTES = 270;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("player");
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "player must be a positive integer" }, { status: 400 });
  }

  try {
    const boot = await getBootstrapLite();
    const player = boot.elements[id];
    if (!player) return NextResponse.json({ error: "unknown player" }, { status: 404 });

    const all = Object.values(boot.elements);
    const read = buildPercentiles({ player, all, minMinutes: MIN_MINUTES });
    const radar = buildRadar(read, player.element_type);

    // Null is a real answer, not a fault: a player with too thin a cohort to
    // rank against has no shape, and the sheet says so rather than drawing a
    // hexagon out of nothing.
    return NextResponse.json({ radar, minMinutes: MIN_MINUTES });
  } catch {
    // The cause goes to the log, not to the client. A sheet that cannot draw
    // a radar simply does not draw one.
    return NextResponse.json({ radar: null, minMinutes: MIN_MINUTES });
  }
}
