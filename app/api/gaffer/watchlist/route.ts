import { NextRequest, NextResponse } from "next/server";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixtures } from "@/lib/fpl/endpoints";
import { availabilityLabel, readAvailability } from "@/lib/engines/availability";
import { rankTonight, type PriceSnapshot } from "@/lib/engines/price";
import { loadChangeLedger, loadSnapshots } from "@/lib/server/priceStore";
import { newsTagsByElement, hoursToDeadline, predictFromParts } from "@/lib/server/buildEoPredict";
import { WATCH_LIMIT } from "@/lib/store/watchlistCore";

export const dynamic = "force-dynamic";

export interface WatchRow {
  id: number;
  webName: string;
  pos: number;
  teamShort: string;
  price: number;
  /** Tenths moved this gameweek — the number the ledger already tracks. */
  costChangeEvent: number;
  owned: number;
  form: number;
  epNext: number | null;
  status: string;
  /** One line of availability, empty when the player is fit and unremarked. */
  flag: string;
  flagKind: string;
  /** Next fixture, or null in the gap between gameweeks. */
  next: { opponent: string; home: boolean; difficulty: number } | null;
  /** Price pressure; `covered` is false when we have no snapshot history. */
  price_pRise: number;
  price_direction: "up" | "down";
  price_covered: boolean;
  /** Deadline EO prediction; `eo_covered` false renders "—" with the reason. */
  eo_predicted: number;
  eo_low: number;
  eo_high: number;
  eo_covered: boolean;
  eo_thin: boolean;
  eo_reason: string | null;
}

/**
 * The rows behind the watchlist board.
 *
 * The watchlist itself lives in the browser, so the ids arrive on the query
 * string rather than being looked up server-side. That keeps the response
 * bounded — at most the cap the store enforces — instead of shipping the whole
 * bootstrap to the client and filtering it there.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, WATCH_LIMIT);
  if (ids.length === 0) return NextResponse.json({ rows: [] });

  try {
    const boot = await getBootstrapLite();
    const nextGw =
      boot.events.find((e) => e.is_next)?.id ?? boot.events.find((e) => e.is_current)?.id ?? null;

    // Both of these are allowed to fail without taking the board with them:
    // the names and prices are the point, the fixture and the price model are
    // the trimmings. News tags ride the same contract — the EO predictor
    // reads attention, not content, so a failed news read only widens to zero.
    const [fixtures, snapshots, ledger, tags] = await Promise.all([
      nextGw ? getFixtures(nextGw).catch(() => []) : Promise.resolve([]),
      loadSnapshots(ids).catch(() => new Map<number, PriceSnapshot[]>()),
      loadChangeLedger().catch(() => ({ lastByElement: new Map<number, { at: Date }>() })),
      newsTagsByElement().catch(() => new Map<number, number>()),
    ]);

    const tonight = new Map(
      rankTonight(
        ids.map((id) => ({
          element: id,
          snapshots: snapshots.get(id) ?? [],
          lastChangeAt: ledger.lastByElement.get(id)?.at ?? null,
        })),
      ).map((r) => [r.element, r]),
    );

    const eoByElement = predictFromParts(boot, ids, snapshots, tags, hoursToDeadline(boot));

    const shortOf = (teamId: number) =>
      boot.teams.find((t) => t.id === teamId)?.short_name ?? "—";

    const rows: WatchRow[] = [];
    for (const id of ids) {
      const el = boot.elements[id];
      if (!el) continue; // a player who left the game — drop rather than invent
      const fx = fixtures.find((f) => f.team_h === el.team || f.team_a === el.team);
      const home = fx ? fx.team_h === el.team : false;
      const avail = readAvailability({
        status: el.status,
        news: el.news,
        chanceOfPlaying: el.chance_of_playing_next_round ?? el.chance_of_playing_this_round,
      });
      const t = tonight.get(id);
      const eo = eoByElement.get(id);
      rows.push({
        id,
        webName: el.web_name,
        pos: el.element_type,
        teamShort: shortOf(el.team),
        price: el.now_cost,
        costChangeEvent: el.costChangeEvent,
        owned: el.selected_by_percent,
        form: el.form,
        epNext: el.ep_next,
        status: el.status,
        flag: availabilityLabel(avail),
        flagKind: avail.kind,
        next: fx
          ? {
              opponent: shortOf(home ? fx.team_a : fx.team_h),
              home,
              difficulty: home ? fx.team_h_difficulty : fx.team_a_difficulty,
            }
          : null,
        price_pRise: t?.pRise ?? 0,
        price_direction: t?.direction ?? "up",
        price_covered: t?.covered ?? false,
        eo_predicted: eo?.predicted ?? el.selected_by_percent,
        eo_low: eo?.low ?? el.selected_by_percent,
        eo_high: eo?.high ?? el.selected_by_percent,
        eo_covered: eo?.covered ?? false,
        eo_thin: eo?.thin ?? false,
        eo_reason: eo?.reason ?? null,
      });
    }

    return NextResponse.json(
      { rows },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
