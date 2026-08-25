import { NextRequest, NextResponse } from "next/server";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getLive } from "@/lib/fpl/endpoints";
import { buildBonusWindow, buildDefconWindow, buildSeason } from "@/lib/server/buildBoards";
import { defconThreshold } from "@/lib/engines/performance";
import type { TopRow } from "@/components/gaffer/field/TopPerformers";

export const dynamic = "force-dynamic";

/**
 * The Field's stat boards, fetched when one is opened rather than shipped
 * with every page.
 *
 * These carry the whole player market — seven hundred rows apiece — and most
 * visits to the Field never open them. Putting them in the page payload made
 * everybody pay for the few. Now the pitch renders first and a board arrives
 * when it is asked for, on a request the browser can cache.
 */

/** Gameweeks of live feed read for the 3·2·1 split and real DEFCON crossings. */
const WINDOW = 5;

export async function GET(req: NextRequest) {
  const board = req.nextUrl.searchParams.get("board");
  const gwParam = Number(req.nextUrl.searchParams.get("gw"));
  const gw = Number.isFinite(gwParam) && gwParam > 0 ? gwParam : undefined;

  try {
    if (board === "top") {
      return json(await topPerformers(gw));
    }
    if (board === "bonus") {
      const season = await buildSeason();
      const window = await buildBonusWindow(season.currentGw, WINDOW).catch(() => ({
        gws: [] as number[],
        rows: new Map(),
      }));
      return json({
        currentGw: season.currentGw,
        players: season.players,
        window: { gws: window.gws, rows: [...window.rows.values()] },
      });
    }
    if (board === "defcon") {
      const season = await buildSeason();
      const posOf = new Map(season.players.map((p) => [p.id, p.pos]));
      const window = await buildDefconWindow(
        season.currentGw,
        WINDOW,
        defconThreshold,
        (element) => posOf.get(element) ?? 3,
      ).catch(() => ({ gws: [] as number[], rows: new Map() }));
      return json({
        currentGw: season.currentGw,
        players: season.players,
        window: { gws: window.gws, rows: [...window.rows.values()] },
      });
    }
    return NextResponse.json({ error: "unknown-board" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}

function json(body: unknown) {
  // Season totals move once a gameweek; two minutes of browser cache spares
  // the server a round trip every time somebody flips between boards.
  return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=120" } });
}

/** The market's form board — season actuals, expectations, and this week's live line. */
async function topPerformers(gwParam: number | undefined) {
  const boot = await getBootstrapLite();
  const currentGw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);
  const season = await buildSeason();

  // Historical views have no live frame to show.
  let gw: TopRow[] = [];
  if (gwParam == null) {
    try {
      const live = await getLive(currentGw);
      gw = live.elements
        .filter((e) => e.stats.minutes > 0)
        .map((e) => {
          const el = boot.elements[e.id];
          return {
            element: e.id,
            webName: el?.web_name ?? `#${e.id}`,
            pos: el?.element_type ?? 4,
            teamId: el?.team ?? 0,
            photo: el?.photo ?? "",
            minutes: e.stats.minutes,
            xg: e.stats.expected_goals,
            xa: e.stats.expected_assists,
            xgc: e.stats.expected_goals_conceded,
            points: e.stats.total_points,
            goals: e.stats.goals_scored,
            assists: e.stats.assists,
            cleanSheets: e.stats.clean_sheets,
            saves: e.stats.saves,
            bonus: e.stats.bonus,
            bps: e.stats.bps,
            defcon: e.stats.defensive_contribution ?? 0,
            yellowCards: e.stats.yellow_cards,
            redCards: e.stats.red_cards,
          };
        });
    } catch {
      gw = [];
    }
  }

  return { currentGw, gw, season: season.players };
}
