import { cookies } from "next/headers";
import { AppShell } from "@/components/gaffer/AppShell";
import { getEntry } from "@/lib/fpl/endpoints";
import { loadGwContext, liveBarData } from "@/lib/server/gw";
import type { LiveBarData } from "@/lib/ui/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  let teamName: string | null = null;
  let entryPoints: { gw: number | null; season: number | null } = { gw: null, season: null };
  if (teamId != null) {
    try {
      const entry = await getEntry(teamId);
      teamName = entry.name ?? null;
      entryPoints = {
        gw: entry.summary_event_points ?? null,
        season: entry.summary_overall_points ?? null,
      };
    } catch {
      teamName = null;
    }
  }

  let live: LiveBarData | null = null;
  if (teamId != null) {
    try {
      live = liveBarData(await loadGwContext());
      live.gwPoints = entryPoints.gw;
      live.seasonTotal = entryPoints.season;
    } catch {
      live = null;
    }
  }

  return (
    <AppShell teamId={teamId} teamName={teamName} live={live}>
      {children}
    </AppShell>
  );
}
