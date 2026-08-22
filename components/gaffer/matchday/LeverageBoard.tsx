"use client";

import type { MatchdayModel } from "@/lib/engines/matchdayModel";
import { formatDeltaShort } from "@/lib/ui/format";
import { POSITION_SHORT } from "@/lib/ui/format";
import { Est } from "@/components/gaffer/Est";

export function LeverageBoard({ model }: { model: MatchdayModel }) {
  const { yours, threats } = model.leverage;

  return (
    <section aria-label="Leverage board" className="rounded-lg bg-surface-1 card-ring p-5">
      <h2 className="text-2xs font-semibold uppercase tracking-wide text-ink-3">If he scores</h2>

      <BoardSection title="Your bets" rows={yours} emptyLine="No live leverage — your players are done or off the pitch." positive />
      <div className="my-4 h-px bg-hairline" role="separator" />
      <BoardSection title="The threat" rows={threats} emptyLine="No threats in play. Enjoy it." />

      {model.leverage.eoSource === "estimated" ? (
        <p className="mt-3 text-2xs text-ink-3">
          Rows priced with{" "}
          <Est method="Estimated EO: ownership × position start-rate prior, plus half captaincy for the field's most-captained player. Replaced by sampled cohort EO once Postgres wiring lands.">
            estimated EO
          </Est>
          .
        </p>
      ) : model.leverage.cohortSampleSize ? (
        <p className="mt-3 text-2xs text-ink-3">
          Priced with{" "}
          <Est method={`EO sampled from ${model.leverage.cohortSampleSize.toLocaleString()} managers (95% MOE ≈ ±${(1.96 * Math.sqrt(0.25 / Math.max(1, model.leverage.cohortSampleSize)) * 100).toFixed(1)} pts at p=50%).`}>
            sampled cohort EO
          </Est>{" "}
          · n={model.leverage.cohortSampleSize.toLocaleString()}
        </p>
      ) : null}
    </section>
  );
}

function BoardSection({
  title,
  rows,
  emptyLine,
}: {
  title: string;
  rows: MatchdayModel["leverage"]["yours"];
  emptyLine: string;
  positive?: boolean;
}) {
  return (
    <div className="mt-3">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-3 text-sm text-ink-3">{emptyLine}</p>
      ) : (
        <table className="w-full text-sm num-tabular">
          <thead>
            <tr className="border-b border-hairline text-left text-2xs uppercase tracking-wide text-ink-3">
              <th className="py-1.5 pr-2 font-semibold">Player</th>
              <th className="py-1.5 px-1 font-semibold text-right">G</th>
              <th className="py-1.5 px-1 font-semibold text-right">A</th>
              <th className="py-1.5 px-1 font-semibold text-right">CS</th>
              <th className="py-1.5 pl-1 font-semibold text-right">Exp.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.element} className="border-b border-hairline last:border-0">
                <td className="py-1.5 pr-2">
                  <span className="font-medium text-ink-1">{r.webName}</span>
                  <span className="ml-1.5 text-xs text-ink-3">{POSITION_SHORT[r.pos] ?? ""}</span>
                </td>
                <NumCell v={r.goal} />
                <NumCell v={r.assist} />
                <NumCell v={r.cleanSheet} />
                <td className={`py-1.5 pl-1 text-right font-medium ${r.expected > 0 ? "text-good" : r.expected < 0 ? "text-critical" : "text-ink-3"}`}>
                  {r.expected === 0 ? "—" : formatDeltaShort(r.expected)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function NumCell({ v }: { v: number }) {
  return (
    <td className={`px-1 py-1.5 text-right ${v > 0 ? "text-good" : v < 0 ? "text-critical" : "text-ink-3"}`}>
      {v === 0 ? "—" : formatDeltaShort(v)}
    </td>
  );
}
