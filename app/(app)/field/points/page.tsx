import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { PointsWaterfall } from "@/components/charts/PointsWaterfall";
import { buildMatchday } from "@/lib/server/buildMatchday";
import { COPY } from "@/lib/copy/deck";
import { PageHeader } from "@/components/gaffer/PageHeader";

export const dynamic = "force-dynamic";

export const metadata = { title: "Points attribution" };

/** Sub-page of the Field: the waterfall behind your gameweek score. */
export default async function FieldPointsPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/?next=/field/points");

  const result = await buildMatchday(teamId);
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-md rounded-lg bg-surface-1 card-ring p-10 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{COPY.nothingToAttribute.title}</h1>
        <p className="mt-2 text-sm text-ink-2">
          {result.reason === "picks-not-set" ? COPY.nothingToAttribute.picksBody : `${COPY.upstreamDown.title}. ${COPY.upstreamDown.body}`}
        </p>
      </div>
    );
  }

  const { model } = result;
  const total = model.squad.filter((s) => !s.onBench).reduce((sum, s) => sum + s.livePoints, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Points attribution"
        meta={`GW${model.event.id} · where the score comes from`}
        action={
          <Link href="/field" className="text-xs text-volt hover:underline">
            ← Back to the Field
          </Link>
        }
      />

      <div className="flex items-end gap-4 rounded-lg has-gloss card-lift bg-raised p-5">
        <div>
          <p className="upper-label text-2xs text-ink-lo">Gameweek score</p>
          {/* hero figure — one per screen, gradient fill, italic Saira, not oversized */}
          <p className="hero-figure mt-1 text-[clamp(44px,6vw,64px)] leading-none">
            <AnimatedTotal value={total} />
          </p>
        </div>
        <p className="ml-auto max-w-[38ch] pb-1 text-xs leading-relaxed text-ink-lo">
          Each bar is a scoring player — captain included via multiplier. The volt bar is your
          running total; dashed connectors show how it built up.
        </p>
      </div>

      <PointsWaterfall rows={model.squad} />
    </div>
  );
}

function AnimatedTotal({ value }: { value: number }) {
  return <>{Math.round(value).toLocaleString("en-GB")}</>;
}
