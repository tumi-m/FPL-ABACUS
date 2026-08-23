import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FieldClient } from "@/components/gaffer/field/FieldClient";
import { buildMatchday } from "@/lib/server/buildMatchday";
import { buildBoardDesk } from "@/lib/server/buildBoardDesk";
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

  // Desk props for Planner mode — built alongside, degrades to null quietly.
  const desk = gwParam == null ? await buildBoardDesk(teamId).catch(() => null) : null;

  return <FieldClient initialModel={result.model} desk={desk} />;
}
