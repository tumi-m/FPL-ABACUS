import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEntry, getHistory, getTransfers } from "@/lib/fpl/endpoints";
import { computeDna } from "@/lib/engines/dna";
import type { DnaInput } from "@/lib/engines/dna";
import { SeasonFingerprint } from "@/components/generative/SeasonFingerprint";
import { PageHeader } from "@/components/gaffer/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manager DNA" };

export default async function DnaPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/");

  const [entry, history] = await Promise.all([getEntry(teamId), getHistory(teamId)]);
  let transfers: Awaited<ReturnType<typeof getTransfers>> = [];
  try {
    transfers = await getTransfers(teamId);
  } catch {
    transfers = [];
  }

  const transferRows = transfers.slice(-60).map((t) => {
    let inPts = 0;
    let outPts = 0;
    for (let g = t.event; g < t.event + 5; g++) {
      inPts += 0;
      outPts += 0;
    }
    return {
      event: t.event,
      elementIn: t.element_in,
      elementOut: t.element_out,
      hitShare: 0,
      inPointsNext5: inPts as number | null,
      outPointsNext5: outPts as number | null,
      outPointsAfterSale: outPts as number | null,
      roseBeforeBuy: null as boolean | null,
    };
  });


  const input: DnaInput = {
    gwRecords: history.current.map((c) => ({
      event: c.event,
      points: c.points,
      overallRank: c.overall_rank,
      benchCost: c.points_on_bench,
      transfersCost: c.event_transfers_cost,
      chip: history.chips.find((ch) => ch.event === c.event)?.name ?? null,
    })),
    transfers: transferRows,
    avgXioEByGw: [],
    captainAlphaByGw: [],
    chipAverages: new Map(),
  };

  const dna = computeDna(input);
  const bestRank = Math.min(...history.current.map((c) => c.overall_rank ?? Infinity));
  const fingerprintRecords = history.current.map((c) => ({
    event: c.event,
    points: c.points,
    overallRank: c.overall_rank,
    chip: history.chips.find((ch) => ch.event === c.event)?.name ?? null,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={entry.name}
        meta={`Overall rank ${entry.summary_overall_rank ? entry.summary_overall_rank.toLocaleString() : "—"} · best ${Number.isFinite(bestRank) ? bestRank.toLocaleString() : "—"}`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Bench cost" value={`${dna.benchCost.points}`} note="points left on your bench this season" />
        <Card label="Consistency" value={`±${dna.consistency.sd}`} note={`floor ${dna.consistency.floor} · ceiling ${dna.consistency.ceiling}`} />
        <Card label="GWs played" value={String(history.current.length)} note={`${history.past.length} previous seasons`} />
        <Card label="Chips used" value={String(history.chips.length)} note="across both sets" />
      </div>

      <section aria-label="Season rank curve" className="rounded-lg bg-surface-1 card-ring p-5">
        <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wide text-ink-3">Rank by gameweek</h2>
        <table className="w-full text-sm num-tabular">
          <tbody>
            {[...history.current].reverse().slice(0, 10).map((c) => (
              <tr key={c.event} className="border-b border-hairline last:border-0">
                <td className="py-1.5 text-ink-3">GW{c.event}</td>
                <td className="py-1.5 text-right text-ink-1">{c.points} pts</td>
                <td className="py-1.5 pl-4 text-right text-ink-2">
                  {c.overall_rank ? c.overall_rank.toLocaleString() : "—"}
                </td>
                <td className="py-1.5 pl-4 text-right text-ink-3">bench {c.points_on_bench}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Season fingerprint" className="rounded-lg bg-surface-1 card-ring p-5">
        <h2 className="mb-1 text-2xs font-semibold uppercase tracking-wide text-ink-3">Season fingerprint</h2>
        <p className="mb-2 text-xs text-ink-lo">
          One spoke per gameweek — surge for rank gains, flare for drops, length by points.
        </p>
        <SeasonFingerprint seed={teamId} records={fingerprintRecords} />
      </section>

      <p className="text-xs leading-relaxed text-ink-3">
        Captaincy alpha, transfer P&L and risk appetite need cohort ownership data — they build honestly once the
        field sample lands after GW1 is processed.
      </p>
    </div>
  );
}

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg bg-surface-1 card-ring p-4">
      <div className="text-2xs font-semibold uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-1 font-semibold text-2xl tracking-tight num-tabular">{value}</div>
      <div className="mt-0.5 text-xs text-ink-3">{note}</div>
    </div>
  );
}
