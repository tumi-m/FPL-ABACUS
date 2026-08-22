import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MatchdayClient } from "@/components/gaffer/MatchdayClient";
import { buildMatchday } from "@/lib/server/buildMatchday";

export const dynamic = "force-dynamic";

export const metadata = { title: "Matchday" };

export default async function LivePage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/?next=/live");

  const result = await buildMatchday(teamId);
  if (!result.ok) {
    if (result.reason === "picks-not-set") {
      return (
        <div className="mx-auto max-w-md rounded-lg bg-surface-1 card-ring p-10 text-center">
          <h1 className="text-xl font-semibold tracking-tight">No picks yet for this gameweek</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            FPL hasn&rsquo;t returned a squad for this entry. If the deadline hasn&rsquo;t passed, set your team in the official game — Matchday lights up the moment picks exist.
          </p>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-md rounded-lg bg-surface-1 card-ring p-10 text-center">
        <h1 className="text-xl font-semibold tracking-tight">FPL&rsquo;s servers aren&rsquo;t responding</h1>
        <p className="mt-2 text-sm text-ink-2">Showing nothing yet. Try again shortly — the circuit breaker will recover automatically.</p>
      </div>
    );
  }

  return <MatchdayClient initialModel={result.model} />;
}
