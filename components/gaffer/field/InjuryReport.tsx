"use client";

import * as React from "react";
import Link from "next/link";
import { CrestBadge } from "@/components/gaffer/CrestBadge";
import { PlayerAvatar, useAvatarMode } from "@/components/gaffer/PlayerAvatar";
import { cn } from "@/lib/ui/cn";
import { POSITION_SHORT } from "@/lib/ui/format";
import { availabilityLabel, bySeverity, type AvailabilityKind } from "@/lib/engines/availability";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

type Row = MatchdayModel["squad"][number];

/**
 * The treatment table, inside Risk.
 *
 * A flag on a token tells you something is wrong; it cannot tell you what, or
 * when it ends. That is the whole question a manager has about an injury, and
 * FPL publishes the answer in its news line — so this is where the answer
 * goes, next to the other thing that decides your week.
 *
 * It sits in Risk rather than on a page of its own because an injury *is* the
 * risk: the variance chart above it prices what your XI might do, and this
 * prices whether they will be on the pitch to do it.
 */

const TONE: Record<AvailabilityKind, { rail: string; text: string; label: string }> = {
  out: { rail: "var(--flare)", text: "text-flare", label: "Out" },
  suspended: { rail: "var(--flare)", text: "text-flare", label: "Suspended" },
  gone: { rail: "var(--ink-lo)", text: "text-ink-lo", label: "Left" },
  doubt: { rail: "var(--amber)", text: "text-amber", label: "Doubt" },
  fit: { rail: "var(--surge)", text: "text-surge", label: "Fit" },
};

export function InjuryReport({ rows }: { rows: Row[] }) {
  const [avatar] = useAvatarMode();

  const flagged = React.useMemo(
    () => rows.filter((r) => r.availability.flagged).sort(bySeverity),
    [rows],
  );

  return (
    <section aria-label="Treatment table" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="upper-label text-2xs text-ink-lo">Treatment table</h2>
        <p className="text-2xs text-ink-lo num-tabular">
          {flagged.length} of {rows.length} flagged
        </p>
      </div>

      {flagged.length === 0 ? (
        <p className="rounded-lg bg-surface-1 card-ring p-6 text-center text-sm text-ink-lo">
          Every one of your fifteen is fit and available. Nothing to work around.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {flagged.map((r) => {
            const tone = TONE[r.availability.kind];
            const line = availabilityLabel(r.availability);
            return (
              <li key={r.element}>
                <Link
                  href={`/players/${r.element}`}
                  className="relative flex items-center gap-3 overflow-hidden rounded-lg bg-surface-1 card-ring px-3 py-2.5 transition-colors dur-instant hover:bg-surface-3"
                >
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 h-full w-[3px]"
                    style={{ background: tone.rail }}
                  />
                  <span className="relative ml-1 inline-block h-9 w-9 shrink-0">
                    <span className="block h-9 w-9 overflow-hidden rounded-md bg-surface-3">
                      <PlayerAvatar
                        photo={r.photo}
                        teamId={r.teamId}
                        mode={avatar}
                        className="h-9 w-9 object-cover object-top"
                      />
                    </span>
                    <CrestBadge
                      teamId={r.teamId}
                      size={13}
                      className="absolute -bottom-0.5 -right-0.5 rounded-[2px] bg-surface-1"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium text-ink-hi">{r.webName}</span>
                      <span className="upper-label shrink-0 text-[9px] text-ink-lo">
                        {POSITION_SHORT[r.pos]}
                        {r.onBench ? " · bench" : ""}
                      </span>
                    </span>
                    {/* what is wrong and when it ends — FPL's own words */}
                    <span className="mt-0.5 block truncate text-xs text-ink-mid">
                      {line || "No detail published"}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className={cn("block text-xs font-semibold uppercase-label", tone.text)}>
                      {tone.label}
                    </span>
                    {r.availability.chance != null && (
                      <span className="block text-2xs text-ink-lo num-tabular">
                        {r.availability.chance}% to play
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-2xs leading-relaxed text-ink-lo">
        Straight from FPL&rsquo;s own availability feed — the wording and the return date are
        theirs, not ours. A doubt still scores if he plays.
      </p>
    </section>
  );
}
