import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { PlayerExplorer } from "@/components/gaffer/PlayerExplorer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Players" };

export default async function PlayersPage() {
  const boot = await getBootstrapLite();
  const rows = Object.values(boot.elements).map((el) => ({
    id: el.id,
    webName: el.web_name,
    pos: el.element_type,
    teamShort: boot.teams.find((t) => t.id === el.team)?.short_name ?? "",
    price: el.now_cost,
    status: el.status,
    sbp: el.selected_by_percent,
    form: el.form,
    ppg: el.ppg,
    points: el.total_points,
    goals: el.goals_scored,
    assists: el.assists,
    minutes: el.minutes,
  }));

  return <PlayerExplorer rows={rows} />;
}
