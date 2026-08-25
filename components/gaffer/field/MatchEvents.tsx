"use client";

import { cn } from "@/lib/ui/cn";
import type { LiveStatsLite } from "@/lib/engines/types";

/**
 * What a player has actually done this gameweek, as marks rather than numbers.
 *
 * Hues are allocated so no two marks a player can hold at once share one:
 * a goal is ice, an assist ultra, defensive work (shutout, saves) the DEFCON
 * steel, a booking amber and anything that costs you points flare.
 *
 * A pitch is scanned, not read: you want to see at a glance who scored, who
 * set one up, whose clean sheet is still intact and who is a yellow away from
 * trouble. The broadcast convention is a small badge per event, so that is
 * what these are — and each one carries a count when it happened twice, so a
 * brace is one badge showing ×2 rather than two badges competing for room.
 *
 * Every mark pairs a shape with a colour: colour alone would fail for anyone
 * who cannot separate the yellow card from the goal.
 */

export interface MatchEvent {
  key: string;
  label: string;
  count: number;
  tone: string;
  /** Dimmed while the result can still change — a clean sheet is not banked
   *  until the whistle. */
  provisional?: boolean;
  icon: React.ReactNode;
}

const Ball = (
  <svg viewBox="0 0 12 12" aria-hidden className="h-full w-full">
    <circle cx="6" cy="6" r="5" fill="currentColor" />
    <path
      d="M6 2.6 8.3 4.3 7.4 7 4.6 7 3.7 4.3Z"
      fill="var(--bg-overlay)"
    />
  </svg>
);

const Boot = (
  <svg viewBox="0 0 12 12" aria-hidden className="h-full w-full">
    {/* a boot in profile — the assist mark broadcasts use */}
    <path
      d="M2.2 3.4h2.6l.7 2.1 3.4 1.1c.9.3 1.3.8 1.3 1.6v.7H2.2Z"
      fill="currentColor"
    />
    <path d="M2 9.6h9.2v.9H2Z" fill="currentColor" opacity="0.55" />
  </svg>
);

const Shield = (
  <svg viewBox="0 0 12 12" aria-hidden className="h-full w-full">
    <path d="M6 1.2 10.2 2.7v3.4c0 2.3-1.7 3.9-4.2 4.7C3.5 10 1.8 8.4 1.8 6.1V2.7Z" fill="currentColor" />
    <path
      d="M3.9 5.9 5.4 7.4 8.2 4.4"
      fill="none"
      stroke="var(--bg-overlay)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Card = (
  <svg viewBox="0 0 12 12" aria-hidden className="h-full w-full">
    <rect x="3.4" y="1.6" width="5.2" height="8.8" rx="1" fill="currentColor" />
  </svg>
);

const Gloves = (
  <svg viewBox="0 0 12 12" aria-hidden className="h-full w-full">
    {/* keeper's glove — the saves mark */}
    <path
      d="M3 4.4a1 1 0 0 1 2 0V2.6a.9.9 0 0 1 1.8 0v1.8a.9.9 0 0 1 1.8 0v.6a.9.9 0 0 1 1.6.6v2.1c0 1.6-1.3 2.9-3 2.9H6c-1.7 0-3-1.3-3-2.9Z"
      fill="currentColor"
    />
  </svg>
);

const Cross = (
  <svg viewBox="0 0 12 12" aria-hidden className="h-full w-full">
    <circle cx="6" cy="6" r="5" fill="currentColor" />
    <path
      d="M4.2 4.2 7.8 7.8M7.8 4.2 4.2 7.8"
      stroke="var(--bg-overlay)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Build the badge list for one player.
 *
 * A clean sheet only exists for keepers and defenders (midfielders get a
 * single point and forwards nothing, so a shield on a striker would be
 * noise), and it stays provisional until the match finishes because a
 * ninetieth-minute goal takes it away.
 */
export function matchEvents(
  stats: LiveStatsLite | null,
  opts: { pos: number; fixtureDone: boolean },
): MatchEvent[] {
  if (!stats) return [];
  const out: MatchEvent[] = [];

  if (stats.goalsScored > 0) {
    out.push({
      key: "goal",
      label: stats.goalsScored === 1 ? "Goal" : `${stats.goalsScored} goals`,
      count: stats.goalsScored,
      tone: "var(--ice)",
      icon: Ball,
    });
  }
  if (stats.assists > 0) {
    out.push({
      key: "assist",
      label: stats.assists === 1 ? "Assist" : `${stats.assists} assists`,
      count: stats.assists,
      tone: "var(--ultra)",
      icon: Boot,
    });
  }
  // Keepers and defenders are the ones paid four points for a shutout.
  if (opts.pos <= 2 && stats.cleanSheets > 0) {
    out.push({
      key: "cs",
      label: opts.fixtureDone ? "Clean sheet" : "Clean sheet so far",
      count: 1,
      // Steel blue, not gold: a gold shield next to a gold card is two marks
      // the eye has to read twice. Defensive work already speaks in this hue.
      tone: "var(--defcon)",
      provisional: !opts.fixtureDone,
      icon: Shield,
    });
  }
  // Saves only score in threes, so the badge appears once there is a point in it.
  if (opts.pos === 1 && stats.saves >= 3) {
    out.push({
      key: "saves",
      label: `${stats.saves} saves`,
      count: stats.saves,
      tone: "var(--defcon)",
      icon: Gloves,
    });
  }
  if (stats.redCards > 0) {
    out.push({ key: "red", label: "Red card", count: 1, tone: "var(--flare)", icon: Card });
  } else if (stats.yellowCards > 0) {
    out.push({ key: "yellow", label: "Yellow card", count: 1, tone: "var(--amber)", icon: Card });
  }
  if (stats.ownGoals > 0) {
    out.push({
      key: "og",
      label: stats.ownGoals === 1 ? "Own goal" : `${stats.ownGoals} own goals`,
      count: stats.ownGoals,
      tone: "var(--flare)",
      icon: Cross,
    });
  }
  if (stats.penMissed > 0) {
    out.push({
      key: "pen",
      label: stats.penMissed === 1 ? "Penalty missed" : `${stats.penMissed} penalties missed`,
      count: stats.penMissed,
      tone: "var(--flare)",
      icon: Cross,
    });
  }
  return out;
}

/** The badge strip. Sits under the face, above the name. */
export function MatchEventStrip({
  events,
  className,
}: {
  events: MatchEvent[];
  className?: string;
}) {
  if (events.length === 0) return null;
  return (
    <span className={cn("mt-1 flex items-center justify-center gap-0.5", className)}>
      {events.map((e) => (
        <span
          key={e.key}
          title={e.label}
          aria-label={e.label}
          role="img"
          className={cn(
            "inline-flex items-center gap-px rounded-full bg-overlay px-[3px] py-px leading-none",
            e.provisional && "opacity-60",
          )}
          style={{ color: e.tone, boxShadow: "inset 0 0 0 1px color-mix(in oklab, currentColor 40%, transparent)" }}
        >
          {/* Nine pixels was too small to read a ball from a boot at arm's
              length. Thirteen with tighter padding keeps the same footprint —
              three badges still fit under a token — with a glyph half again
              as big. The strip sizes as one: a goal drawn larger than the
              shield beside it would read as a broken row, not a louder mark. */}
          <span className="block h-[13px] w-[13px]">{e.icon}</span>
          {e.count > 1 && (
            <span className="text-[9px] font-bold num-tabular" style={{ color: e.tone }}>
              {e.count}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
