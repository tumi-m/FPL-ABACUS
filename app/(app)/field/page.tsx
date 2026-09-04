import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FieldClient } from "@/components/gaffer/field/FieldClient";
import { buildMatchday } from "@/lib/server/buildMatchday";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { COPY } from "@/lib/copy/deck";

export const dynamic = "force-dynamic";

export const metadata = { title: "Field",
  description: "Your fifteen on the pitch: live points, bonus, ownership, risk, and the season under the gameweek." };

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


  // FPL's own published expectation for this gameweek, for the squad only —
  // the "projected" side of the delivery chart. One bootstrap read, cached,
  // and about fifteen numbers on the wire. The stat boards that used to be
  // composed here now load from /api/gaffer/boards when one is opened.
  const expectedByElement = await squadExpectations(result.model.squad.map((r) => r.element)).catch(
    () => ({}),
  );

  return <FieldClient initialModel={result.model} expectedByElement={expectedByElement} />;
}

/** ep_this for the squad — nothing else needs to cross the wire. */
async function squadExpectations(elements: number[]): Promise<Record<number, number>> {
  const boot = await getBootstrapLite();
  const out: Record<number, number> = {};
  for (const id of elements) {
    const ep = boot.elements[id]?.ep_this;
    if (ep != null && ep > 0) out[id] = ep;
  }
  return out;
}
