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
  if (teamId != null) {
    try {
      teamName = (await getEntry(teamId)).name ?? null;
    } catch {
      teamName = null;
    }
  }

  let live: LiveBarData | null = null;
  if (teamId != null) {
    try {
      live = liveBarData(await loadGwContext());
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
