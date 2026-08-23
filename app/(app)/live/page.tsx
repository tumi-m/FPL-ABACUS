import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MatchdayClient } from "@/components/gaffer/MatchdayClient";
import { buildMatchday } from "@/lib/server/buildMatchday";
import { COPY } from "@/lib/copy/deck";

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
          <h1 className="text-xl font-semibold tracking-tight">{COPY.picksMissing.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{COPY.picksMissing.body("Matchday")}</p>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-md rounded-lg bg-surface-1 card-ring p-10 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{COPY.upstreamDown.title}</h1>
        <p className="mt-2 text-sm text-ink-2">Showing nothing yet. {COPY.upstreamDown.body}</p>
      </div>
    );
  }

  return <MatchdayClient initialModel={result.model} />;
}
