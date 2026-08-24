import { NextRequest, NextResponse } from "next/server";
import {
  getElementSummary,
  getEntry,
  getEventStatus,
  getFixtures,
  getHistory,
  getLive,
  getPicks,
  getStandings,
  getTransfers,
} from "@/lib/fpl/endpoints";

const NO_STORE = "private, max-age=0, must-revalidate";

type Params = { params: Promise<{ path?: string[] }> };

function errResponse(err: unknown, path: string) {
  const status = typeof err === "object" && err !== null && "status" in err ? Number((err as { status: number }).status) : 502;
  return NextResponse.json({ error: path, message: String(err instanceof Error ? err.message : err) }, { status });
}

export async function GET(_req: NextRequest, ctx: Params): Promise<NextResponse> {
  const segments = (await ctx.params).path ?? [];
  const path = segments.join("/");

  try {
    if (segments[0] === "bootstrap-lite") {
      const { getBootstrapLite } = await import("@/lib/fpl/bootstrapLite");
      return NextResponse.json(await getBootstrapLite(), { headers: { "Cache-Control": NO_STORE } });
    }

    if (segments[0] === "live" && segments[1]) {
      const gw = Number(segments[1]);
      if (!Number.isFinite(gw)) return NextResponse.json({ error: "bad gw" }, { status: 400 });
      return NextResponse.json(await getLive(gw), { headers: { "Cache-Control": NO_STORE } });
    }

    if (segments[0] === "fixtures" && segments[1] && segments[1] !== "all") {
      const gw = Number(segments[1]);
      if (!Number.isFinite(gw)) return NextResponse.json({ error: "bad gw" }, { status: 400 });
      return NextResponse.json(await getFixtures(gw), { headers: { "Cache-Control": NO_STORE } });
    }

    if (segments[0] === "fixtures" && segments[1] === "all") {
      return NextResponse.json(await getFixtures(0).catch(() => []), { headers: { "Cache-Control": NO_STORE } });
    }

    if (segments[0] === "event-status") {
      return NextResponse.json(await getEventStatus(), { headers: { "Cache-Control": NO_STORE } });
    }

    if (segments[0] === "entry" && segments[1]) {
      const id = Number(segments[1]);
      if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
      if (segments[2] === "history") return NextResponse.json(await getHistory(id), { headers: { "Cache-Control": NO_STORE } });
      if (segments[2] === "transfers") return NextResponse.json(await getTransfers(id), { headers: { "Cache-Control": NO_STORE } });
      if (segments[2] === "event" && segments[3] && segments[4] === "picks") {
        const gw = Number(segments[3]);
        const deadlinePassed = true; // picks only exist after the deadline anyway
        try {
          return NextResponse.json(await getPicks(id, gw, deadlinePassed), { headers: { "Cache-Control": NO_STORE } });
        } catch (err) {
          if (typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 404) {
            return NextResponse.json({ error: "picks-not-set" }, { status: 404 });
          }
          throw err;
        }
      }
      const entry = await getEntry(id);
      // A confirmed look-up is the strongest directory signal (best-effort).
      try {
        const { rememberEntries } = await import("@/lib/server/entryDirectory");
        await rememberEntries(
          [
            {
              entry: id,
              teamName: entry.name ?? "",
              managerName: `${entry.player_first_name ?? ""} ${entry.player_last_name ?? ""}`.trim(),
              rank: entry.summary_overall_rank ?? null,
            },
          ],
          "confirm",
        );
      } catch {
        /* directory is best-effort */
      }
      return NextResponse.json(entry, { headers: { "Cache-Control": NO_STORE } });
    }

    if (segments[0] === "standings" && segments[1]) {
      const leagueId = Number(segments[1]);
      const page = segments[2] ? Number(segments[2]) : 1;
      if (!Number.isFinite(leagueId)) return NextResponse.json({ error: "bad league" }, { status: 400 });
      const res = await getStandings(leagueId, page);
      // Every league page seen grows the name directory (best-effort).
      try {
        const { rememberEntries } = await import("@/lib/server/entryDirectory");
        await rememberEntries(
          (res.standings?.results ?? []).map((r) => ({
            entry: r.entry,
            teamName: r.entry_name ?? "",
            managerName: r.player_name ?? "",
            rank: r.rank ?? null,
          })),
          "league",
        );
      } catch {
        /* directory is best-effort — the standings response stands */
      }
      return NextResponse.json(res, { headers: { "Cache-Control": NO_STORE } });
    }

    if (segments[0] === "element-summary" && segments[1]) {
      const id = Number(segments[1]);
      if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
      return NextResponse.json(await getElementSummary(id), { headers: { "Cache-Control": NO_STORE } });
    }

    return NextResponse.json({ error: `unsupported fpl path: ${path}` }, { status: 404 });
  } catch (err) {
    return errResponse(err, path);
  }
}
