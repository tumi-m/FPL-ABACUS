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
  topRegrel?: never;
  topRegret?: MultiverseRow | null;
  topRelief?: MultiverseRow | null;
  rows: MultiverseRow[];
  sampleSize: number;
}) {
  const maxArm = Math.max(regretIndex, reliefIndex, 1);
  const reliefPct = (reliefIndex / maxArm) * 50;
  const regretPct = (regretIndex / maxArm) * 50;

  return (
    <section aria-label="Regret and relief" className="rounded-lg bg-surface-1 card-ring p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Regret · Relief</h2>
        <Dialog>
          <DialogTrigger className="text-xs font-medium text-brand hover:underline">
            Open multiverse
          </DialogTrigger>
          <DialogContent side="bottom" aria-describedby={undefined}>
            <DialogTitle>Multiverse — the roads not taken</DialogTitle>
            <MultiverseTable rows={rows} sampleSize={sampleSize} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mt-4 h-3 w-full rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
        <div
          aria-hidden
          className="absolute right-1/2 top-0 h-full"
          style={{ width: `${reliefPct}%`, marginRight: "50%", background: "var(--good)", opacity: 0.85 }}
        />
        <div
          aria-hidden
          className="absolute left-1/2 top-0 h-full"
          style={{ width: `${regretPct}%`, marginLeft: "50%", background: "var(--critical)", opacity: 0.85 }}
        />
        <div aria-hidden className="absolute left-1/2 top-[-2px] h-[16px] w-[2px] bg-ink-1" style={{ transform: "translateX(-1px)" }} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm num-tabular">
        <div>
          <dt className="text-2xs uppercase tracking-wide text-ink-3">Worst avoided</dt>
          <dd className="font-medium text-good">{reliefIndex === 0 ? "—" : formatDeltaShort(-reliefIndex)}</dd>
          {topRelief && reliefIndex > 0 && <dd className="mt-0.5 text-xs text-ink-3">{topRelief.label}</dd>}
        </div>
        <div className="text-right">
          <dt className="text-2xs uppercase tracking-wide text-ink-3">Best missed</dt>
          <dd className="font-medium text-critical">{regretIndex === 0 ? "—" : formatDeltaShort(regretIndex)}</dd>
          {topRegret && regretIndex > 0 && <dd className="mt-0.5 text-xs text-ink-3">{topRegret.label}</dd>}
        </div>
      </dl>
    </section>
  );
}

function MultiverseTable({ rows, sampleSize }: { rows: MultiverseRow[]; sampleSize: number }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-3">
        No counterfactuals yet this gameweek.
      </p>
    );
  }
  return (
    <div>
      <ul className="divide-y divide-hairline">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-3 py-2.5">
            <span className="text-sm text-ink-1">{r.label}</span>
            <span className="text-right num-tabular">
              <span className={`block text-sm font-medium ${r.ranksDelta >= 0 ? "text-good" : "text-critical"}`}>
                {formatDeltaShort(r.ranksDelta)} ranks
              </span>
              <span className="block text-xs text-ink-3">
                {r.pointsDelta >= 0 ? "+" : "\u2212"}
                {Math.abs(r.pointsDelta)} pts
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-3">
        <Est method={`Counterfactuals priced through the rank curve sampled from ${sampleSize.toLocaleString()} managers`}>
          {formatDeltaShort(0)}
        </Est>{" "}
        estimates from the sampled rank curve; arithmetic shown per branch.
      </p>
    </div>
  );
}
