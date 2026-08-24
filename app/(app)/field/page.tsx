import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FieldClient } from "@/components/gaffer/field/FieldClient";
import type { TopPerformersData, TopRow } from "@/components/gaffer/field/TopPerformers";
import { buildMatchday } from "@/lib/server/buildMatchday";
import { buildBoardDesk } from "@/lib/server/buildBoardDesk";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getLive } from "@/lib/fpl/endpoints";
import { COPY } from "@/lib/copy/deck";

export const dynamic = "force-dynamic";

export const metadata = { title: "Field" };

export default async function FieldPage({
  searchParams,
}: {
  searchParams: Promise<{ gw?: string }>;
}) {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/?next=/field");

  const params = await searchParams;
  const gwParam = params.gw != null && /^\d+$/.test(params.gw) ? Number(params.gw) : undefined;
  const result = await buildMatchday(teamId, gwParam);
  if (!result.ok) {
    if (result.reason === "picks-not-set") {
      return (
        <div className="mx-auto max-w-md rounded-lg bg-surface-1 card-ring p-10 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{COPY.picksMissing.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{COPY.picksMissing.body("The Field")}</p>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-md rounded-lg bg-surface-1 card-ring p-10 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{COPY.upstreamDown.title}</h1>
        <p className="mt-2 text-sm text-ink-2">{COPY.upstreamDown.body}</p>
      </div>
    );
  }

  // Desk props for Planner mode — built alongside, degrades to null quietly.
  const desk = gwParam == null ? await buildBoardDesk(teamId).catch(() => null) : null;

  // Top performers — GW frame from the live feed (current GW only), season
  // frame from bootstrap totals. Degrades to null quietly.
  const top = await buildTopPerformers(result.model.event.id, gwParam == null).catch(() => null);

  return <FieldClient initialModel={result.model} desk={desk} top={top} />;
}

/** The market's form board — all players, both timeframes, no projections. */
async function buildTopPerformers(eventId: number, includeGw: boolean): Promise<TopPerformersData | null> {
  const boot = await getBootstrapLite();
  const season: TopRow[] = Object.values(boot.elements).map((el) => ({
    element: el.id,
    webName: el.web_name,
    pos: el.element_type,
    teamId: el.team,
    photo: el.photo,
    minutes: el.minutes,
    xg: el.xgTotal,
    xa: el.xaTotal,
    xgc: el.xgcTotal,
    points: el.total_points,
  }));
  let gw: TopRow[] = [];
  if (includeGw) {
    const live = await getLive(eventId);
    gw = Object.values(live.elements)
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
        };
      });
  }
  return { currentGw: eventId, gw, season };
}
