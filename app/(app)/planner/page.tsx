import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixturesAll, getPicks } from "@/lib/fpl/endpoints";
import { HeatGrid } from "@/components/charts/HeatGrid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Planner" };

const HORIZON = 6;

export default async function PlannerPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/");

  const boot = await getBootstrapLite();
  const currentGw = boot.events.find((e) => e.is_current)?.id ?? 1;
  const horizonGws = boot.events.filter((e) => e.id >= currentGw).slice(0, HORIZON);

  let squadIds: number[] = [];
  try {
    const picks = await getPicks(teamId, currentGw, true);
    squadIds = picks.picks.map((p) => p.element);
  } catch {
    squadIds = [];
  }

  let allFixtures: Awaited<ReturnType<typeof getFixturesAll>> = [];
  try {
    allFixtures = await getFixturesAll();
  } catch {
    allFixtures = [];
  }

  const teamById = new Map(boot.teams.map((t) => [t.id, t]));

  const rows = squadIds.map((id) => {
    const el = boot.elements[id];
    if (!el) return null;
    return {
      label: `${el.web_name}`,
      cells: horizonGws.map((gw) => {
        const fx = allFixtures.filter(
          (f) => f.event === gw.id && (f.team_h === el.team || f.team_a === el.team),
        );
        if (fx.length === 0) {
          return { value: 3, text: "—" };
        }
        if (fx.length > 1) {
          return { value: 4, text: `2×`, title: `Double gameweek` };
        }
        const f = fx[0];
        const home = f.team_h === el.team;
        const opp = teamById.get(home ? f.team_a : f.team_h);
        const diff = home ? f.team_a_difficulty : f.team_h_difficulty;
        return { value: diff, text: `${home ? "" : "@"}${opp?.short_name ?? "?"}`, title: `${gw.name} vs ${opp?.name}` };
      }),
    };
  });

  const blanksAndDoubles = horizonGws.map((gw) => {
    const teamsWithGames = new Set<number>();
    const counts = new Map<number, number>();
    for (const f of allFixtures.filter((x) => x.event === gw.id)) {
      counts.set(f.team_h, (counts.get(f.team_h) ?? 0) + 1);
      counts.set(f.team_a, (counts.get(f.team_a) ?? 0) + 1);
      teamsWithGames.add(f.team_h);
      teamsWithGames.add(f.team_a);
    }
    return { gw, doubles: [...counts.values()].filter((c) => c > 1).length };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Planner</h1>
      <HeatGrid
        ariaLabel="Fixture difficulty grid for your squad over the next gameweeks"
        rows={rows.filter((r): r is NonNullable<typeof r> => r !== null)}
      />
      <ul className="flex flex-wrap gap-2 text-xs text-ink-3 num-tabular">
        {blanksAndDoubles.map(({ gw, doubles }) => (
          <li key={gw.id} className="rounded-full card-ring px-2.5 py-1">
            GW{gw.id}: {doubles > 0 ? `${doubles} double` : "no doubles"}
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-ink-3">
        Drag-to-plan, chip lanes and the optimiser are below the cut line this session — the fixture reality of your
        squad is above it.
      </p>
    </div>
  );
}
