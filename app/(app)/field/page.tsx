import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FieldClient } from "@/components/gaffer/field/FieldClient";
import type { TopPerformersData, TopRow } from "@/components/gaffer/field/TopPerformers";
import { clubOf } from "@/config/clubs";
import type { PerfPlayer } from "@/lib/engines/performance";
import { buildMatchday } from "@/lib/server/buildMatchday";
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


  // Top performers — GW frame from the live feed (current GW only), season
  // frame from bootstrap totals. Degrades to null quietly.
  const top = await buildTopPerformers(result.model.event.id, gwParam == null).catch(() => null);

  // FPL's own published expectation for this gameweek, for the squad only —
  // the "projected" side of the delivery chart. One bootstrap read, cached.
  const expectedByElement = await squadExpectations(result.model.squad.map((r) => r.element)).catch(
    () => ({}),
  );

  return (
    <FieldClient initialModel={result.model} top={top} expectedByElement={expectedByElement} />
  );
}

/** The market's form board — season actuals, expectations and the gap. */
async function buildTopPerformers(eventId: number, includeGw: boolean): Promise<TopPerformersData | null> {
  const boot = await getBootstrapLite();
  const season: PerfPlayer[] = Object.values(boot.elements)
    // Departed players still sit in the bootstrap and nobody can pick them.
    .filter((el) => el.status !== "u")
    .map((el) => ({
      id: el.id,
      name: el.web_name,
      pos: el.element_type,
      teamId: el.team,
      code: clubOf(el.team).code,
      photo: el.photo,
      cost: el.now_cost,
      minutes: el.minutes,
      starts: el.starts,
      points: el.total_points,
      goals: el.goals_scored,
      assists: el.assists,
      cleanSheets: el.cleanSheets,
      goalsConceded: el.goalsConceded,
      saves: el.saves,
      bonus: el.bonus,
      bps: el.bps,
      defcon: el.defcon,
      tackles: el.tackles,
      recoveries: el.recoveries,
      cbi: el.cbi,
      yellowCards: el.yellowCards,
      redCards: el.redCards,
      xg: el.xgTotal,
      xa: el.xaTotal,
      xgi: el.xgiTotal,
      xgc: el.xgcTotal,
      owned: el.selected_by_percent,
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
  }
  return { currentGw: eventId, gw, season };
}

/** ep_this for the squad — nothing else needs to cross the wire. */
async function squadExpectations(elements: number[]): Promise<Record<number, number>> {
  const boot = await getBootstrapLite();
  const out: Record<number, number> = {};
  for (const id of elements) {
    const ep = boot.elements[id]?.ep_this;
    if (ep != null && ep > 0) out[id] = ep;
  }
  return out;
}
