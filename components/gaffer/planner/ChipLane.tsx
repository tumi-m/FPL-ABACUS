"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import type { PlannerChip, PlannerGw } from "@/lib/server/buildPlanner";

/**
 * The chip lane — one column per gameweek in the window, one chip per week.
 *
 * The half-season window is enforced rather than warned about: a chip is only
 * offered in the weeks FPL actually allows it, and one already pencilled in
 * elsewhere is offered nowhere else. Blank and double weeks are flagged in
 * the column head, because that is where chips earn their keep.
 */
export function ChipLane({
  gws,
  chips,
  wallGw,
  currentGw,
  assigned,
  onAssign,
}: {
  gws: PlannerGw[];
  chips: PlannerChip[];
  wallGw: number | null;
  currentGw: number;
  /** chip key → gameweek. */
  assigned: Record<string, number>;
  onAssign: (key: string, gw: number | null) => void;
}) {
  if (chips.length === 0) return null;

  return (
    <section aria-label="Chip lane" className="rounded-lg bg-raised card-ring p-3 md:p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="upper-label text-2xs text-ink-lo">Chip lane</h2>
        {wallGw != null && (
          <p className="text-2xs text-ink-lo">
            First-half chips expire after GW{wallGw} — the lane enforces it
          </p>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {gws.map((gw) => {
          const here = Object.entries(assigned).find(([, g]) => g === gw.id);
          return (
            <div
              key={gw.id}
              className={cn(
                "min-w-[84px] rounded-md p-1.5 text-center",
                here ? "btn-glow" : "card-ring",
                gw.id === currentGw && "bg-surface-3",
              )}
            >
              <div className="text-2xs font-semibold uppercase-label text-ink-lo">GW{gw.id}</div>
              <div className="text-[9px] leading-tight text-ink-lo">{gw.deadline}</div>
              {(gw.doubles > 0 || gw.blanks > 0) && (
                <div className="mt-0.5 flex justify-center gap-1">
                  {gw.doubles > 0 && (
                    <span
                      title={`${gw.doubles} club${gw.doubles === 1 ? "" : "s"} play twice`}
                      className="rounded-full bg-surge/15 px-1 text-[9px] leading-[1.4] text-surge"
                    >
                      ×2
                    </span>
                  )}
                  {gw.blanks > 0 && (
                    <span
                      title={`${gw.blanks} club${gw.blanks === 1 ? "" : "s"} without a fixture`}
                      className="rounded-full bg-flare/15 px-1 text-[9px] leading-[1.4] text-flare"
                    >
                      bye
                    </span>
                  )}
                </div>
              )}

              {here ? (
                <button
                  type="button"
                  onClick={() => onAssign(here[0], null)}
                  title="Take this chip back off the lane"
                  className="mt-1 w-full rounded-sm bg-volt px-1 py-1 text-2xs font-bold uppercase-label text-on-accent"
                >
                  {chips.find((c) => c.key === here[0])?.label ?? here[0]}
                </button>
              ) : (
                <div className="mt-1 flex flex-col gap-0.5">
                  {chips.map((c) => {
                    // A chip is only offered in the weeks it is actually
                    // playable: FPL opens each one for a half of the season.
                    if (gw.id < c.startEvent || gw.id > c.stopEvent) return null;
                    const taken = assigned[c.key] != null;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        disabled={taken}
                        onClick={() => onAssign(c.key, gw.id)}
                        title={
                          taken
                            ? `Already pencilled in for GW${assigned[c.key]}`
                            : `Pencil ${c.label} in for GW${gw.id} (available GW${c.startEvent}–${c.stopEvent})`
                        }
                        className={cn(
                          "rounded-sm px-1 py-0.5 text-[10px] uppercase-label",
                          taken
                            ? "cursor-not-allowed text-ink-lo opacity-40"
                            : "bg-sunk text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
                        )}
                      >
                        {shortChip(c.label)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** "Bench Boost ②" → "BB②" — the half marker survives the abbreviation. */
function shortChip(label: string): string {
  const second = label.includes("②");
  const name = label.replace("②", "").trim();
  const abbr =
    name === "Wildcard"
      ? "WC"
      : name === "Free Hit"
        ? "FH"
        : name === "Bench Boost"
          ? "BB"
          : name === "Triple Captain"
            ? "TC"
            : name.slice(0, 2).toUpperCase();
  return second ? `${abbr}②` : abbr;
}
