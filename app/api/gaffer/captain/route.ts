import { NextRequest, NextResponse } from "next/server";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixturesAll } from "@/lib/fpl/endpoints";
import { buildSolverContext } from "@/lib/server/buildBoardDesk";

export const dynamic = "force-dynamic";

/** At most a full squad — the armband can only go to someone you own. */
const MAX_PLAYERS = 15;

export interface CaptainFixture {
  opponent: string;
  home: boolean;
  /** FPL's 1–5 difficulty for this side of the tie. */
  difficulty: number;
}

export interface CaptainRow {
  id: number;
  /** Projected points for the target gameweek, doubles stacked, blanks zero. */
  xp: number;
  /** Every fixture he has that week — two rows is a double, none is a blank. */
  fixtures: CaptainFixture[];
  /** FPL's own published expectation, for the reader to weigh against ours. */
  epNext: number | null;
  status: string;
}

/**
 * The armband board (Field) — who to captain in the next unplayed gameweek.
 *
 * Deliberately keyed to the NEXT gameweek rather than the one the Field is
 * displaying. A projection for a week already played is a curiosity, not a
 * decision, and the Field is routinely opened on a live or finished gameweek;
 * asking "who should wear it" only means anything about a week you can still
 * change.
 *
 * The projection is the planner's own — one buildSolverContext pass over a
 * single-gameweek horizon — rather than a second opinion invented here. Two
 * surfaces disagreeing about the same player is worse than either being
 * slightly wrong.
 */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("players") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_PLAYERS);

  if (ids.length === 0) return NextResponse.json({ error: "no-players" }, { status: 400 });

  try {
    const boot = await getBootstrapLite();
    // The week you can still act on: `is_next` while a deadline is pending,
    // otherwise the one in flight.
    const targetGw = boot.events.find((e) => e.is_next)?.id ?? boot.events.find((e) => e.is_current)?.id;
    if (targetGw == null) return NextResponse.json({ error: "no-gameweek" }, { status: 503 });

    const fixtures = await getFixturesAll().catch(() => []);
    if (fixtures.length === 0) {
      // No calendar means no projection. Say so rather than ranking on
      // form alone and calling it a fixture-aware answer.
      return NextResponse.json({ error: "no-fixtures" }, { status: 503 });
    }

    const currentGw =
      boot.events.find((e) => e.is_current)?.id ?? Math.max(1, targetGw - 1);
    const solver = buildSolverContext(fixtures, [targetGw], currentGw);
    const shortOf = (teamId: number) => boot.teams.find((t) => t.id === teamId)?.short_name ?? "—";

    const rows: CaptainRow[] = [];
    for (const id of ids) {
      const el = boot.elements[id];
      if (!el) continue; // gone from the game — drop rather than invent
      const [xp = 0] = solver.project({
        pos: el.element_type,
        teamId: el.team,
        epNext: el.ep_next,
        form: el.form,
        status: el.status,
        chanceOfPlaying: el.chance_of_playing_next_round ?? el.chance_of_playing_this_round,
      });
      rows.push({
        id,
        xp,
        fixtures: fixtures
          .filter((f) => f.event === targetGw && (f.team_h === el.team || f.team_a === el.team))
          .map((f) => {
            const home = f.team_h === el.team;
            return {
              opponent: shortOf(home ? f.team_a : f.team_h),
              home,
              difficulty: home ? f.team_h_difficulty : f.team_a_difficulty,
            };
          }),
        epNext: el.ep_next,
        status: el.status,
      });
    }

    return NextResponse.json(
      { gw: targetGw, rows },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=900" } },
    );
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
