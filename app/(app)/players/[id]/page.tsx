import Link from "next/link";
import { notFound } from "next/navigation";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getElementSummary } from "@/lib/fpl/endpoints";
import { Badge } from "@/components/primitives/Badge";
import { Meter } from "@/components/charts/Meter";
import { PlayerPhoto } from "@/components/gaffer/PlayerPhoto";
import { formatPrice, POSITION_SHORT } from "@/lib/ui/format";
import { COPY } from "@/lib/copy/deck";
import { PageHeader } from "@/components/gaffer/PageHeader";
import { BackLink } from "@/components/gaffer/BackLink";

export const dynamic = "force-dynamic";

export default async function PlayerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  const boot = await getBootstrapLite();
  const el = boot.elements[id];
  if (!el || !Number.isFinite(id)) notFound();

  let history: Awaited<ReturnType<typeof getElementSummary>>["history"] = [];
  try {
    const summary = await getElementSummary(id);
    history = summary.history.slice(-12).reverse();
  } catch {
    history = [];
  }

  const team = boot.teams.find((t) => t.id === el.team);
  const defconThreshold = el.element_type === 2 ? 10 : 12;

  return (
    <div className="space-y-4">
      <BackLink href="/players" label="All players" />

      <PageHeader
        title={el.web_name}
        meta={`${team?.name ?? ""} · ${POSITION_SHORT[el.element_type]} · ${formatPrice(el.now_cost)}`}
        media={
          <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-3">
            <PlayerPhoto photo={el.photo} teamId={el.team} className="h-14 w-14 object-cover object-top" eager />
          </span>
        }
        action={
          <div className="flex items-center gap-4 text-right num-tabular sm:gap-6">
            <div>
              <div className="upper-label text-2xs text-ink-lo">Points</div>
              <div className="fig-num text-xl">{el.total_points}</div>
            </div>
            <div>
              <div className="upper-label text-2xs text-ink-lo">Form</div>
              <div className="fig-num text-xl">{el.form}</div>
            </div>
            <div>
              <div className="upper-label text-2xs text-ink-lo">Owned</div>
              <div className="fig-num text-xl">{el.selected_by_percent}%</div>
            </div>
          </div>
        }
      />

      {el.status !== "a" && (
        <div className="rounded-lg bg-warning/10 p-4 text-sm text-warning">
          <Badge variant="warning">{POSITION_SHORT[el.element_type]} · {el.status === "d" ? "Doubtful" : "Unavailable"}</Badge>{" "}
          {el.news || "No news."}
        </div>
      )}

      <section aria-label="Recent matches" className="rounded-lg bg-surface-1 card-ring p-5">
        <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wide text-ink-3">Last matches</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm num-tabular">
            <thead>
              <tr className="border-b border-hairline text-left text-2xs uppercase tracking-wide text-ink-3">
                <th className="py-1.5 pr-2 font-semibold">GW</th>
                <th className="py-1.5 px-2 font-semibold text-right">Min</th>
                <th className="py-1.5 px-2 font-semibold text-right">Pts</th>
                <th className="py-1.5 px-2 font-semibold text-right">xG</th>
                <th className="py-1.5 px-2 font-semibold text-right">xA</th>
                <th className="py-1.5 px-2 font-semibold text-right">BPS</th>
                <th className="w-32 py-1.5 pl-2 font-semibold">DEFCON</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={`${h.element}-${h.fixture}`} className="border-b border-hairline last:border-0">
                  <td className="py-1.5 pr-2 text-ink-2">{h.round}</td>
                  <td className="px-2 text-right text-ink-2">{h.minutes}</td>
                  <td className="px-2 text-right font-medium text-ink-1">{h.total_points}</td>
                  <td className="px-2 text-right text-ink-3">{h.expected_goals}</td>
                  <td className="px-2 text-right text-ink-3">{h.expected_assists}</td>
                  <td className="px-2 text-right text-ink-3">{h.bps}</td>
                  <td className="pl-2">
                    {defconThreshold === 10 ? (
                      <Meter value={Math.min(1, h.defensive_contribution / defconThreshold)} hint={`${h.defensive_contribution}/${defconThreshold}`} />
                    ) : (
                      <Meter value={Math.min(1, (h.defensive_contribution + h.recoveries) / defconThreshold)} hint={`${h.defensive_contribution + h.recoveries}/${defconThreshold}`} />
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-sm text-ink-3">{COPY.noMatchHistory}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
