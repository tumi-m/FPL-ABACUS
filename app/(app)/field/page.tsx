import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FieldClient } from "@/components/gaffer/field/FieldClient";
import { buildMatchday } from "@/lib/server/buildMatchday";
import { buildBoardDesk } from "@/lib/server/buildBoardDesk";

export const dynamic = "force-dynamic";

export const metadata = { title: "Field" };

export default async function FieldPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/?next=/field");

  const result = await buildMatchday(teamId);
  if (!result.ok) {
    if (result.reason === "picks-not-set") {
      return (
        <div className="mx-auto max-w-md rounded-lg bg-surface-1 card-ring p-10 text-center">
          <h1 className="text-xl font-semibold tracking-tight">No picks yet for this gameweek</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            The Field needs your squad. Set your team in the official game — it lights up the moment picks exist.
          </p>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-md rounded-lg bg-surface-1 card-ring p-10 text-center">
        <h1 className="text-xl font-semibold tracking-tight">FPL&rsquo;s servers aren&rsquo;t responding</h1>
        <p className="mt-2 text-sm text-ink-2">Try again shortly — the circuit breaker recovers automatically.</p>
      </div>
    );
  }

  // Desk props for Planner mode — built alongside, degrades to null quietly.
  const desk = await buildBoardDesk(teamId).catch(() => null);

  return <FieldClient initialModel={result.model} desk={desk} />;
}
