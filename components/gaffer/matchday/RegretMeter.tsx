"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/primitives/Sheet";
import { Est } from "@/components/gaffer/Est";
import { formatDeltaShort } from "@/lib/ui/format";

export interface MultiverseRow {
  label: string;
  pointsDelta: number;
  ranksDelta: number;
}

/**
 * Regret · Relief — a centred diverging meter: what your best alternative was
 * worth (relief, left) against what your worst cost (regret, right). Figures
 * count up; every number is an estimate and says so.
 */
export function RegretMeter({
  regretIndex,
  reliefIndex,
  topRegret,
  topRelief,
  rows,
  sampleSize,
}: {
  regretIndex: number;
  reliefIndex: number;
  topRegret?: MultiverseRow | null;
  topRelief?: MultiverseRow | null;
  rows: MultiverseRow[];
  sampleSize: number;
}) {
  const maxArm = Math.max(regretIndex, reliefIndex, 1);
  const reliefPct = (reliefIndex / maxArm) * 50;
  const regretPct = (regretIndex / maxArm) * 50;

  return (
    <section aria-label="Regret and relief" className="rounded-lg has-gloss card-lift bg-raised p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="upper-label text-2xs text-ink-lo">Regret · Relief</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-lo">
            What this gameweek&rsquo;s best and worst alternatives were worth in rank.
          </p>
        </div>
        <Dialog>
          <DialogTrigger
            role="button"
            className="skewed inline-flex h-9 shrink-0 items-center rounded-sm bg-raised px-3.5 text-xs uppercase-label text-ink-mid card-ring transition-colors dur-instant hover:text-ink-hi"
          >
            <span>All branches</span>
          </DialogTrigger>
          <DialogContent side="bottom" aria-describedby={undefined} className="bg-raised">
            <DialogTitle className="fig-num text-lg">All branches</DialogTitle>
            <MultiverseTable rows={rows} sampleSize={sampleSize} />
          </DialogContent>
        </Dialog>
      </div>

      {/* the meter — relief grows left, regret grows right, centre pin is now */}
      <div className="relative mt-5 h-4 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }} role="presentation">
        <div
          aria-hidden
          className="absolute right-1/2 top-0 h-full rounded-l-full transition-[width] dur-slow ease-out-quint"
          style={{ width: `${reliefPct}%`, marginRight: "50%", background: "var(--surge)", opacity: 0.9 }}
        />
        <div
          aria-hidden
          className="absolute left-1/2 top-0 h-full rounded-r-full transition-[width] dur-slow ease-out-quint"
          style={{ width: `${regretPct}%`, marginLeft: "50%", background: "var(--flare)", opacity: 0.9 }}
        />
        <div
          aria-hidden
          className="absolute left-1/2 top-[-3px] h-[22px] w-[2px] rounded-full bg-ink-hi"
          style={{ transform: "translateX(-1px)" }}
        />
      </div>
      <div aria-hidden className="mt-1 flex justify-between text-2xs uppercase-label text-ink-lo">
        <span>Relief</span>
        <span>Now</span>
        <span>Regret</span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-4 text-center sm:text-left">
        <div className="rounded-md bg-surface-0 px-3 py-2.5 card-ring">
          <dt className="text-2xs uppercase tracking-wide text-ink-lo">Best avoided loss</dt>
          <dd className="fig-num mt-0.5 text-xl text-surge">
            {reliefIndex === 0 ? "—" : formatDeltaShort(-reliefIndex)}
          </dd>
          {topRelief && reliefIndex > 0 && (
            <dd className="mt-0.5 truncate text-xs text-ink-lo">{topRelief.label}</dd>
          )}
        </div>
        <div className="rounded-md bg-surface-0 px-3 py-2.5 card-ring">
          <dt className="text-2xs uppercase tracking-wide text-ink-lo">Biggest missed gain</dt>
          <dd className="fig-num mt-0.5 text-xl text-flare">
            {regretIndex === 0 ? "—" : formatDeltaShort(regretIndex)}
          </dd>
          {topRegret && regretIndex > 0 && (
            <dd className="mt-0.5 truncate text-xs text-ink-lo">{topRegret.label}</dd>
          )}
        </div>
      </dl>
    </section>
  );
}

function MultiverseTable({ rows, sampleSize }: { rows: MultiverseRow[]; sampleSize: number }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-lo">
        No counterfactuals yet this gameweek.
      </p>
    );
  }
  return (
    <div>
      <ul className="divide-y divide-hairline">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-3 py-2.5">
            <span className="text-sm text-ink-hi">{r.label}</span>
            <span className="text-right num-tabular">
              <span className={`block text-sm font-medium ${r.ranksDelta >= 0 ? "text-good" : "text-critical"}`}>
                {formatDeltaShort(r.ranksDelta)} ranks
              </span>
              <span className="block text-xs text-ink-lo">
                {r.pointsDelta >= 0 ? "+" : "\u2212"}
                {Math.abs(r.pointsDelta)} pts
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-lo">
        <Est method={`Counterfactuals priced through the rank curve sampled from ${sampleSize.toLocaleString("en-GB")} managers`}>
          estimates
        </Est>{" "}
        from the sampled rank curve; arithmetic shown per branch.
      </p>
    </div>
  );
}
