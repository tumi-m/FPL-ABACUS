import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixturesAll, getPicks } from "@/lib/fpl/endpoints";
import { PageHeader } from "@/components/gaffer/PageHeader";
import { FixtureTicker, type TickerData } from "@/components/gaffer/board/FixtureTicker";
import { SquadRuns } from "@/components/gaffer/board/SquadRuns";
import { buildFixtureModel } from "@/lib/engines/fixtureModel";
import { buildTicker } from "@/lib/engines/fixtureTicker";
import { computeGwProfiles } from "@/lib/server/buildBoardDesk";
import type { Pos } from "@/lib/engines/types";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "The Board",
  description:
    "The league's fixture run, club by club — attacking and defensive difficulty scored separately, ranked over any range of gameweeks.",
};

export default async function BoardPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/?next=/board");

  // Bootstrap gates the gameweek number, so it goes first; everything after is
  // independent and runs as one wave rather than serial round trips.
  const boot = await getBootstrapLite();
  const currentGw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);

  const [picksRes, fixturesRes] = await Promise.allSettled([
    getPicks(teamId, currentGw, true),
    getFixturesAll(),
  ]);
  const squadIds: number[] =
    picksRes.status === "fulfilled" ? picksRes.value.picks.map((p) => p.element) : [];
  const allFixtures: Awaited<ReturnType<typeof getFixturesAll>> =
    fixturesRes.status === "fulfilled" ? fixturesRes.value : [];

  // Rolling-window opponent rates from completed matches only.
  const model = buildFixtureModel(allFixtures, { upToGw: currentGw });

  // The whole rest of the season goes to the client in one payload. Twenty
  // clubs by at most thirty-eight weeks is small, and shipping it whole is
  // what lets the range, the side and the sort answer instantly instead of
  // costing a request each — which is the difference between a ticker you
  // fiddle with and a ticker you give up on.
  const seasonGws = boot.events.filter((e) => e.id >= currentGw).map((e) => e.id);
  const teamIds = boot.teams.map((t) => t.id);
  const rows = buildTicker(
    { model, fixtures: allFixtures, teamIds, gws: seasonGws },
    "attack",
  );

  const ownedTeamIds = [
    ...new Set(
      squadIds
        .map((id) => boot.elements[id]?.team)
        .filter((t): t is number => typeof t === "number"),
    ),
  ];

  const ticker: TickerData = { gws: seasonGws, rows, ownedTeamIds, currentGw };

  // The squad panel keeps what the old Board did well: your own players,
  // coloured by position, because a fixture is not the same for Gabriel as for
  // Watkins even when both play the same club.
  const squad = squadIds
    .map((id) => boot.elements[id])
    .filter((el): el is NonNullable<typeof el> => el != null)
    .map((el) => ({
      element: el.id,
      webName: el.web_name,
      pos: el.element_type as Pos,
      teamId: el.team,
    }));

  const profiles = computeGwProfiles(allFixtures, seasonGws.slice(0, 12));
  const notable = profiles.filter((p) => p.doubles > 0 || p.byes > 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="The Board"
        meta="The league's fixture run · attack and defence scored apart"
        action={
          <Link
            href="/planner"
            className="skewed inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md bg-volt px-3 text-2xs uppercase-label text-on-accent transition-transform dur-instant hover:-translate-y-px"
          >
            <span>Open the Planner</span>
          </Link>
        }
      />

      {/* the hero: twenty clubs, ranked by the run ahead */}
      <FixtureTicker data={ticker} />

      {/* the calendar's own shape — only the weeks where it is not a full slate */}
      {notable.length > 0 && (
        <section aria-label="Blanks and doubles ahead" className="space-y-2">
          <h2 className="upper-label text-2xs text-ink-lo">Blanks &amp; doubles ahead</h2>
          <ul className="flex flex-wrap gap-2 text-xs text-ink-3 num-tabular">
            {notable.map((p) => {
              const parts: string[] = [];
              if (p.doubles > 0) parts.push(`${p.doubles} double${p.doubles === 1 ? "" : "s"}`);
              if (p.byes > 0) parts.push(`${p.byes} blank${p.byes === 1 ? "" : "s"}`);
              return (
                <li key={p.id} className="rounded-full card-ring px-2.5 py-1">
                  GW{p.id}: {parts.join(" · ")}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* your fifteen, position-aware */}
      <SquadRuns squad={squad} rows={rows} gws={seasonGws} />

      <Link
        href="/planner"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg has-gloss card-lift bg-raised p-4 transition-colors dur-instant hover:bg-surface-3 md:p-5"
      >
        <span>
          <span className="block fig-num text-lg leading-none text-ink-hi">
            Take a run at the transfers
          </span>
          <span className="mt-1 block max-w-[58ch] text-xs leading-relaxed text-ink-mid">
            The Planner stages moves against this grid: your pitch, the full market ranked by
            projected points, the chip lane and the price watch.
          </span>
        </span>
        <span className="skewed inline-flex h-11 items-center rounded-md bg-volt px-4 text-2xs uppercase-label text-on-accent">
          <span>Open the Planner</span>
        </span>
      </Link>
    </div>
  );
}
