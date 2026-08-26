"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import type { LiveStatsLite } from "@/lib/engines/types";

/**
 * What a player has actually done this gameweek, as marks rather than numbers.
 *
 * Hues are allocated so no two marks a player can hold at once share one:
 * a goal is ice, an assist ultra, defensive work (shutout, saves) the DEFCON
 * steel, bonus its own pink, a booking amber and anything that costs you
 * points flare.
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

const Star = (
  <svg viewBox="0 0 12 12" aria-hidden className="h-full w-full">
    {/* bonus — a star, because nothing else on a pitch is one */}
    <path
      d="M6 1 7.4 4.4 11 4.7 8.3 7.1 9.1 10.6 6 8.8 2.9 10.6 3.7 7.1 1 4.7 4.6 4.4Z"
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
  opts: {
    pos: number;
    fixtureDone: boolean;
    /** Bonus taken this gameweek — official once FPL adds it, projected before. */
    bonus?: number;
    bonusOfficial?: boolean;
  },
): MatchEvent[] {
  if (!stats) return [];
  const out: MatchEvent[] = [];
  const bonus = opts.bonus ?? 0;
  const bonusOfficial = opts.bonusOfficial ?? false;

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
  // Bonus is worth up to three points and was the least legible thing on the
  // pitch: three small pips on the token corner that most people read as
  // decoration. It is a badge in the strip now, beside the goal it came from,
  // and it says how many.
  if (bonus > 0) {
    out.push({
      key: "bonus",
      label: `${bonus} bonus point${bonus === 1 ? "" : "s"}${bonusOfficial ? "" : " (projected)"}`,
      count: bonus,
      tone: "var(--bonus)",
      provisional: !bonusOfficial,
      icon: Star,
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
  // The slot keeps its height whether or not there is anything in it. A strip
  // that collapses to nothing pushes the name and the points pill up on some
  // tokens and not others, so a row of eleven never lines up — which is what
  // made the pitch look ragged rather than laid out.
  return (
    /* The badge size comes from a variable so the strip can ride the token's
       scale on a squeezed pitch row and still be its old fifteen pixels
       everywhere else it is used — the points table has no token around it. */
    <span
      className={cn("mt-1 flex h-[var(--evt-row,21px)] items-center justify-center gap-0.5", className)}
    >
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
              length; fifteen is the most that still fits four badges under a
              token. The strip sizes as one: a goal drawn larger than the
              shield beside it would read as a broken row, not a louder mark. */}
          <span className="block h-[var(--evt,15px)] w-[var(--evt,15px)]">{e.icon}</span>
          {e.count > 1 && (
            <span className="text-[10px] font-bold num-tabular" style={{ color: e.tone }}>
              {e.count}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * What every mark on the pitch means.
 *
 * A goal and an assist read themselves; bonus, the shutout shield and the
 * DEFCON ring do not, and an icon nobody can name is worse than no icon. The
 * legend is collapsed by default — it is reference, not furniture — and names
 * the marks in the order you are likely to meet them.
 */
const LEGEND: { icon: React.ReactNode; tone: string; label: string; note: string }[] = [
  { icon: Ball, tone: "var(--ice)", label: "Goal", note: "×2 for a brace" },
  { icon: Boot, tone: "var(--ultra)", label: "Assist", note: "" },
  { icon: Star, tone: "var(--bonus)", label: "Bonus", note: "1–3 pts · dim until FPL confirms it" },
  { icon: Shield, tone: "var(--defcon)", label: "Clean sheet", note: "keepers and defenders · dim until full time" },
  { icon: Gloves, tone: "var(--defcon)", label: "Saves", note: "keepers, once there is a point in it" },
  { icon: Card, tone: "var(--amber)", label: "Booking", note: "red shows in flare" },
  { icon: Cross, tone: "var(--flare)", label: "Own goal or penalty missed", note: "" },
];

/** The five marks worth naming inline; the rest live behind the disclosure. */
const KEY_MARKS = LEGEND.slice(0, 5);

/**
 * The always-visible strip.
 *
 * A key folded inside a disclosure at the bottom of a page is a key nobody
 * reads. The five common marks are named on the row itself, and the full list
 * — the rarer marks and the DEFCON ring — opens from it.
 */
export function MatchEventLegend({ className }: { className?: string }) {
  return (
    <details className={cn("group rounded-md card-ring px-3 py-2", className)}>
      <summary className="cursor-pointer list-none transition-colors dur-instant">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {KEY_MARKS.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span
                className="inline-flex shrink-0 items-center rounded-full bg-overlay px-[3px] py-px leading-none"
                style={{ color: l.tone, boxShadow: "inset 0 0 0 1px color-mix(in oklab, currentColor 40%, transparent)" }}
              >
                <span className="block h-[13px] w-[13px]">{l.icon}</span>
              </span>
              <span className="text-2xs text-ink-mid">{l.label}</span>
            </span>
          ))}
          <span className="ml-auto text-2xs uppercase-label text-ink-lo group-hover:text-ink-hi">
            all marks
            <span aria-hidden className="ml-1 inline-block transition-transform dur-instant group-open:rotate-90">
              ›
            </span>
          </span>
        </span>
      </summary>
      <ul className="mt-2.5 grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {LEGEND.map((l) => (
          <li key={l.label} className="flex items-center gap-2">
            <span
              className="inline-flex shrink-0 items-center rounded-full bg-overlay px-[3px] py-px leading-none"
              style={{ color: l.tone, boxShadow: "inset 0 0 0 1px color-mix(in oklab, currentColor 40%, transparent)" }}
            >
              <span className="block h-[15px] w-[15px]">{l.icon}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-ink-hi">{l.label}</span>
              {l.note && <span className="block text-2xs text-ink-lo">{l.note}</span>}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden className="grid h-[21px] w-[21px] shrink-0 place-items-center">
            <svg viewBox="0 0 40 40" className="h-full w-full">
              <circle cx="20" cy="20" r="17" fill="none" stroke="var(--bg-overlay)" strokeWidth="5" />
              <circle
                cx="20" cy="20" r="17" fill="none" stroke="var(--defcon)" strokeWidth="5"
                strokeDasharray="107 107" strokeDashoffset="40" strokeLinecap="round"
                transform="rotate(-90 20 20)"
              />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-ink-hi">DEFCON ring</span>
            <span className="block text-2xs text-ink-lo">progress to the two-point line</span>
          </span>
        </li>
      </ul>
    </details>
  );
}
