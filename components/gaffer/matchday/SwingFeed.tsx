"use client";

import * as React from "react";
import type { MatchdayModel, SwingRow } from "@/lib/engines/matchdayModel";
import { formatDeltaShort } from "@/lib/ui/format";
import { ArrowDown, ArrowUp } from "@/components/primitives/icons";

const EVENT_LABEL: Record<string, string> = {
  goals_scored: "Goal",
  assists: "Assist",
  clean_sheets: "Clean sheet",
  penalty_saved: "Pen save",
  penalties_saved: "Pen save",
  penalties_missed: "Pen miss",
  own_goals: "Own goal",
  yellow_cards: "Yellow",
  red_cards: "Red",
  saves: "Saves",
  bonus: "Bonus",
  defensive_contribution: "DEFCON",
};

export function SwingFeed({ model }: { model: MatchdayModel }) {
  const [filter, setFilter] = React.useState<"all" | "yours" | "field">("all");
  const swings = model.swings.filter((s) => {
    if (filter === "all") return true;
    const mine = s.yourMultiplier > 0;
    return filter === "yours" ? mine : !mine;
  });

  return (
    <section aria-label="Swing feed" className="flex h-full flex-col rounded-lg bg-surface-1 card-ring">
      <header className="flex items-center justify-between gap-2 px-4 pt-4">
        <h2 className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Swing feed</h2>
        <div role="group" aria-label="Filter events" className="inline-flex rounded-full card-ring p-0.5">
          {(["all", "yours", "field"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`h-6 rounded-full px-2.5 text-2xs font-semibold capitalize transition-colors dur-instant ${
                filter === f ? "bg-surface-3 text-ink-1" : "text-ink-3 hover:text-ink-1"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {model.swingSummary.reconciled && (
        <p className="mx-4 mt-2 rounded-md bg-surface-3 px-2.5 py-1.5 text-2xs leading-relaxed text-ink-3">
          Reconciled to your observed rank change
          {model.swingSummary.scale !== null && ` (scale ×${model.swingSummary.scale.toFixed(2)})`}
        </p>
      )}

      <ul aria-live="polite" className="mt-2 flex-1 divide-y divide-hairline overflow-y-auto px-4 pb-4">
        {swings.length === 0 && (
          <li className="py-10 text-center text-sm text-ink-3">No scoring events yet. The feed wakes with the first whistle.</li>
        )}
        {swings.map((s) => (
          <SwingRowView key={s.id} row={s} />
        ))}
      </ul>
    </section>
  );
}

function SwingRowView({ row }: { row: SwingRow }) {
  const gain = row.ranksGained > 0;
  const neutral = row.ranksGained === 0;
  return (
    <li className="relative flex items-baseline gap-3 py-2.5 pl-3">
      <span
        aria-hidden
        className={`absolute left-0 top-2 h-[calc(100%-16px)] w-[2px] rounded-full ${
          neutral ? "bg-hairline-strong" : gain ? "bg-good" : "bg-critical"
        }`}
      />
      <span className="w-9 shrink-0 text-xs text-ink-3 num-tabular">{row.minute}&prime;</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink-1">{row.webName}</span>
        <span className="block text-xs text-ink-3">
          {EVENT_LABEL[row.identifier] ?? row.identifier} · +{row.points} · EO {row.eo}%
          {row.yourMultiplier > 0 && ` · you own${row.yourMultiplier > 1 ? " (C)" : ""}`}
        </span>
      </span>
      <span className={`shrink-0 text-right text-sm font-medium num-tabular ${neutral ? "text-ink-3" : gain ? "text-good" : "text-critical"}`}>
        <span className="inline-flex items-center gap-1">
          {!neutral && (gain ? <ArrowUp width={12} height={12} /> : <ArrowDown width={12} height={12} />)}
          {formatDeltaShort(row.ranksGained)}
        </span>
        <span className="block text-2xs font-normal text-ink-3">{neutral ? "no swing" : gain ? "ranks gained" : "ranks lost"}</span>
      </span>
    </li>
  );
}
