import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/gaffer/AppShell";
import { LiveBarSlot, TeamPill } from "@/components/gaffer/HeaderStatus";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  // Nothing upstream is awaited here any more: the shell streams, and the two
  // FPL-backed fragments fill in behind their own boundaries.
  return (
    <AppShell
      teamId={teamId}
      liveSlot={
        teamId != null ? (
          <Suspense fallback={null}>
            <LiveBarSlot teamId={teamId} />
          </Suspense>
        ) : null
      }
      statusSlot={
        teamId != null ? (
          <Suspense
            fallback={
              <span
                aria-hidden
                className="hidden h-8 w-32 rounded-full bg-surface-3/60 sm:inline-flex"
              />
            }
          >
            <TeamPill teamId={teamId} />
          </Suspense>
        ) : null
      }
    >
      {children}
    </AppShell>
  );
}
