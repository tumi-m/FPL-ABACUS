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
 * Regret · Relief — a centred diverging meter over your counterfactuals.
 *
 * Every gameweek you took a line: this captain, this bench order, this hit.
 * The engine replays the alternatives you could have taken with the same
 * fifteen and prices each one. Relief (left) is what the worst of them would
 * have cost you; regret (right) is what the best of them would have won.
 *
 * **It prices them in ranks when it can and in points when it cannot.** Ranks
 * need the sampled rank curve, and a page is not allowed to wait for that —
 * it may be missing on any given render. When it is, every branch prices at
 * zero ranks and this card used to show an empty bar and two dashes with no
 * explanation, which reads as "nothing happened" rather than "I could not
 * work it out". Points need nothing but the live feed, so that is the
 * fallback, labelled as what it is.
 */
export function RegretMeter({
  regretIndex,
  reliefIndex,
  topRegret,
  topRelief,
  rows,
  sampleSize,
  curveAvailable = true,
}: {
  regretIndex: number;
  reliefIndex: number;
  topRegret?: MultiverseRow | null;
  topRelief?: MultiverseRow | null;
  rows: MultiverseRow[];
  sampleSize: number;
  /** False when the rank curve is missing — the card then talks in points. */
  curveAvailable?: boolean;
}) {
  // Ranks are the better unit, but only when there is a curve to price them
  // against. `ranksDelta` collapses to zero for every branch without one.
  const hasRankSignal = curveAvailable && (regretIndex !== 0 || reliefIndex !== 0);
  const unit: "ranks" | "points" = hasRankSignal ? "ranks" : "points";

  // In points, the same two ends: the best alternative and the worst.
  const bestGain = rows.reduce((m, r) => Math.max(m, r.pointsDelta), 0);
  const worstLoss = rows.reduce((m, r) => Math.min(m, r.pointsDelta), 0);
  const topGainRow = rows.find((r) => r.pointsDelta === bestGain && bestGain > 0) ?? null;
  const topLossRow = rows.find((r) => r.pointsDelta === worstLoss && worstLoss < 0) ?? null;

  const regretValue = unit === "ranks" ? regretIndex : bestGain;
  const reliefValue = unit === "ranks" ? reliefIndex : -worstLoss;
  const regretRow = unit === "ranks" ? topRegret : topGainRow;
  const reliefRow = unit === "ranks" ? topRelief : topLossRow;

  const maxArm = Math.max(regretValue, reliefValue, 1);
  const reliefPct = (reliefValue / maxArm) * 50;
  const regretPct = (regretValue / maxArm) * 50;

  // Nothing to weigh: no branch changed anything either way.
  const empty = regretValue === 0 && reliefValue === 0;

  const fmt = (v: number, sign: 1 | -1) =>
    unit === "ranks"
      ? formatDeltaShort(sign * v)
      : `${sign > 0 ? "+" : "\u2212"}${Math.abs(v)} pts`;

  return (
    <section aria-label="Regret and relief" className="rounded-lg has-gloss card-lift bg-raised p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="upper-label text-2xs text-ink-lo">Regret · Relief</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-lo">
            What this gameweek&rsquo;s best and worst alternatives were worth
            {unit === "ranks" ? " in rank." : " in points."}
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
            <MultiverseTable rows={rows} sampleSize={sampleSize} unit={unit} />
          </DialogContent>
        </Dialog>
      </div>

      {empty ? (
        <p className="mt-5 rounded-md bg-surface-0 card-ring px-4 py-6 text-center text-sm text-ink-lo">
          {rows.length === 0
            ? "No alternatives to weigh yet — the branches appear once your gameweek is under way."
            : "Every alternative you had lands on the same score. Nothing to regret, nothing to be relieved about."}
        </p>
      ) : (
      <>
      {/* the meter — relief grows left, regret grows right, centre pin is now */}
      <div className="relative mt-5 h-4 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }} role="presentation">
        {/* `right-1/2` already pins the bar's inner edge to the centre pin;
            the 50% margins that used to sit here pushed both arms clean out of
            the container, so the meter had never actually drawn a bar. */}
        <div
          aria-hidden
          className="absolute right-1/2 top-0 h-full rounded-l-full transition-[width] dur-slow ease-out-quint"
          style={{ width: `${reliefPct}%`, background: "var(--surge)", opacity: 0.9 }}
        />
        <div
          aria-hidden
          className="absolute left-1/2 top-0 h-full rounded-r-full transition-[width] dur-slow ease-out-quint"
          style={{ width: `${regretPct}%`, background: "var(--flare)", opacity: 0.9 }}
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
            {reliefValue === 0 ? "—" : fmt(reliefValue, -1)}
          </dd>
          {reliefRow && reliefValue > 0 && (
            <dd className="mt-0.5 truncate text-xs text-ink-lo">{reliefRow.label}</dd>
          )}
        </div>
        <div className="rounded-md bg-surface-0 px-3 py-2.5 card-ring">
          <dt className="text-2xs uppercase tracking-wide text-ink-lo">Biggest missed gain</dt>
          <dd className="fig-num mt-0.5 text-xl text-flare">
            {regretValue === 0 ? "—" : fmt(regretValue, 1)}
          </dd>
          {regretRow && regretValue > 0 && (
            <dd className="mt-0.5 truncate text-xs text-ink-lo">{regretRow.label}</dd>
          )}
        </div>
      </dl>
      </>
      )}

      {unit === "points" && rows.length > 0 && (
        <p className="mt-3 text-2xs leading-relaxed text-ink-lo">
          Priced in points: the sampled rank curve is not in hand this render, so these cannot be
          converted to places. Reload in a moment for the rank figure.
        </p>
      )}
    </section>
  );
}

function MultiverseTable({
  rows,
  sampleSize,
  unit,
}: {
  rows: MultiverseRow[];
  sampleSize: number;
  unit: "ranks" | "points";
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-lo">
        No counterfactuals yet this gameweek.
      </p>
    );
  }
  // Without a curve every branch reads "0 ranks", which is a lie of omission —
  // the points line is the one that was actually computed, so it leads.
  const ranked = unit === "ranks";
  return (
    <div>
      <ul className="divide-y divide-hairline">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-3 py-2.5">
            <span className="text-sm text-ink-hi">{r.label}</span>
            <span className="text-right num-tabular">
              <span
                className={`block text-sm font-medium ${
                  (ranked ? r.ranksDelta : r.pointsDelta) >= 0 ? "text-good" : "text-critical"
                }`}
              >
                {ranked
                  ? `${formatDeltaShort(r.ranksDelta)} ranks`
                  : `${r.pointsDelta >= 0 ? "+" : "\u2212"}${Math.abs(r.pointsDelta)} pts`}
              </span>
              {ranked && (
                <span className="block text-xs text-ink-lo">
                  {r.pointsDelta >= 0 ? "+" : "\u2212"}
                  {Math.abs(r.pointsDelta)} pts
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-lo">
        {ranked ? (
          <>
            <Est method={`Counterfactuals priced through the rank curve sampled from ${sampleSize.toLocaleString("en-GB")} managers`}>
              estimates
            </Est>{" "}
            from the sampled rank curve; arithmetic shown per branch.
          </>
        ) : (
          "Point differences are exact arithmetic on the live feed. Converting them to places needs the sampled rank curve, which is not in hand this render."
        )}
      </p>
    </div>
  );
}
