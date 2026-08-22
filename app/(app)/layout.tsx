import { cookies } from "next/headers";
import { AppShell } from "@/components/gaffer/AppShell";
import { getEntryName } from "@/lib/server/entryMeta";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  const teamName = teamId != null ? await getEntryName(teamId) : null;

  return (
    <AppShell teamId={teamId} teamName={teamName}>
      {children}
    </AppShell>
  );
}
