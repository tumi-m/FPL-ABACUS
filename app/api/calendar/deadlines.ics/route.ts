import { NextRequest, NextResponse } from "next/server";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { buildDeadlineFeed, parseAlarms, type DeadlineEvent } from "@/lib/calendar/ics";

export const dynamic = "force-dynamic";

/**
 * The subscribable deadline calendar.
 *
 * Apple Calendar, Google Calendar and Outlook all speak this and nothing else
 * without an OAuth dance, so one public GET replaces a login, a consent screen
 * and a stored refresh token per user. Nobody has to hold an account here for
 * it to work, and there is nothing to revoke: the URL is the subscription.
 *
 *   ?alarm=120,15   minutes before each deadline (default), or "none"
 *   ?only=next      just the next deadline, for a one-off download
 *
 * Cached for an hour at the edge. Calendar clients poll on their own schedule
 * — Apple's is roughly hourly at best — and the deadlines only change when FPL
 * moves one, which is a handful of times a season.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const alarms = parseAlarms(params.get("alarm"));
  const onlyNext = params.get("only") === "next";

  let boot;
  try {
    boot = await getBootstrapLite();
  } catch {
    // A calendar client that gets a 500 may unsubscribe the feed outright, so
    // fail as a valid-but-empty calendar and let the next poll pick the
    // deadlines back up.
    return icsResponse(buildDeadlineFeed([], { alarms }), 60);
  }

  const all = boot.events;
  const season = seasonLabel(all[0]?.deadline_time);
  const now = Date.now();

  // Past deadlines are dropped. A calendar full of dates that have already
  // gone is noise, and re-publishing them can re-fire alarms on a client that
  // is subscribing for the first time mid-season.
  let upcoming: DeadlineEvent[] = all
    .filter((e) => new Date(e.deadline_time).getTime() > now)
    .map((e) => ({ id: e.id, name: e.name, deadline: e.deadline_time }));

  if (onlyNext) upcoming = upcoming.slice(0, 1);

  const origin = req.nextUrl.origin;
  return icsResponse(buildDeadlineFeed(upcoming, { alarms, origin, season }), onlyNext ? 300 : 3600);
}

function icsResponse(body: string, maxAge: number): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      // Named so a one-off download lands in the Downloads folder as something
      // recognisable; `inline` so a subscription is not forced through a save.
      "content-disposition": 'inline; filename="fpl-deadlines.ics"',
      "cache-control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=86400`,
    },
  });
}

/** "2026/27" from the season's first deadline. FPL seasons open in August. */
function seasonLabel(firstDeadline: string | undefined): string {
  if (!firstDeadline) return "";
  const d = new Date(firstDeadline);
  if (Number.isNaN(d.getTime())) return "";
  const start = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}
