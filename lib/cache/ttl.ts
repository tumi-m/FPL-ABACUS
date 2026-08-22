import type { GwPhase } from "@/lib/fpl/schemas";

export type TtlKind =
  | "bootstrap"
  | "fixtures"
  | "live"
  | "eventStatus"
  | "entry"
  | "history"
  | "league"
  | "elementSummary"
  | "setPiece"
  | "rankCurve";

const TABLE: Record<TtlKind, Record<"live" | "inGw" | "offWeek", number>> = {
  bootstrap: { live: 300, inGw: 300, offWeek: 1800 },
  fixtures: { live: 30, inGw: 120, offWeek: 900 },
  live: { live: 25, inGw: 120, offWeek: 900 },
  eventStatus: { live: 60, inGw: 60, offWeek: 600 },
  entry: { live: 300, inGw: 300, offWeek: 1800 },
  history: { live: 600, inGw: 600, offWeek: 3600 },
  league: { live: 90, inGw: 300, offWeek: 1800 },
  elementSummary: { live: 21600, inGw: 21600, offWeek: 21600 },
  setPiece: { live: 43200, inGw: 43200, offWeek: 43200 },
  rankCurve: { live: 300, inGw: 900, offWeek: 3600 },
};

function bucket(phase: GwPhase): "live" | "inGw" | "offWeek" {
  switch (phase) {
    case "live":
    case "provisional":
      return "live";
    case "pre_deadline":
    case "awaiting_kickoff":
    case "bonus_added":
      return "inGw";
    case "final":
      return "offWeek";
  }
}

export function ttlFor(kind: TtlKind, phase: GwPhase): number {
  return TABLE[kind][bucket(phase)];
}

/** Picks are immutable once the deadline has passed. */
export function ttlForPicks(deadlinePassed: boolean): number {
  return deadlinePassed ? 60 * 60 * 24 * 30 : 60;
}
