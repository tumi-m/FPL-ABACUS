/**
 * briefing — the gaffer opens with something worth knowing, or nothing at all.
 *
 * An assistant that only answers is a search box. This is the proactive half:
 * five deterministic triggers, detected in TypeScript — never in the model —
 * each producing a sentence template whose figures come straight from the
 * facts object that also licenses them. The model never touches this path;
 * there is nothing to generate, and nothing that can be invented.
 *
 * Triggers, in the order a manager cares:
 *   flagged   — a starter flagged since last visit, in FPL's own words.
 *   captain   — the armband is on a player who is out or suspended.
 *   watchlist — a starred player closing on a price move tonight.
 *   chip      — a chip window is open now and closes soon.
 *   rival     — a rival's differential hauled while your pick blanked.
 *
 * Two honesty rules shape the shape of the output, the same two the cockpit
 * follows:
 *   - Sentence templates carry COUNTS and NAMES. Every estimated figure is a
 *     separate `est` field the UI wraps in <Est> — verifyFigures checks every
 *     figure in the sentence against `facts`, so the two can never drift.
 *   - With no triggers the briefing is EMPTY — `lines: []` — and the surface
 *     renders nothing. Padding is the failure mode this exists to prevent.
 *
 * Pure functions only.
 */
import { readAvailability, availabilityLabel } from "@/lib/engines/availability";

/** One trigger's rendered line, with the facts that license every figure. */
export interface BriefingLine {
  /** Stable trigger id — the surface uses it for ordering and icons. */
  id: BriefingTriggerId;
  /** Severity for visual weight: critical jumps, warn matters, note informs. */
  state: "critical" | "warn" | "note";
  /** The sentence itself. Every figure inside it appears in `facts`. */
  text: string;
  /** Optional estimated figure, rendered beside the line in <Est>. */
  est?: { value: string; method: string };
  /** Where to act on it. The Planner stays the only desk that moves a player. */
  href?: string;
  /** The facts object verifyFigures runs against — mirrors `text` exactly. */
  facts: unknown;
}

export type BriefingTriggerId = "flagged" | "captain" | "watchlist" | "chip" | "rival";

/** One starter as the caller holds it — raw FPL fields, no pre-reading. */
export interface BriefingStarter {
  id: number;
  name: string;
  isCaptain: boolean;
  status: string;
  news: string;
  chanceOfPlaying: number | null;
}

/** One watchlist row as the price model returns it. */
export interface BriefingWatchRow {
  id: number;
  name: string;
  direction: "up" | "down";
  /** Modelled chance of a move before the deadline, 0..1. */
  pMove: number;
  /** False when there is no snapshot history — the model refuses to speak. */
  covered: boolean;
  label: string;
}

export interface BriefingInput {
  /** The eleven who would start, slot order 1–11. Bench seats never trigger. */
  starters: BriefingStarter[];
  watchlist: BriefingWatchRow[];
  /** Chips with a live availability window, from the bootstrap. */
  chips: { key: string; label: string; startEvent: number; stopEvent: number }[];
  currentGw: number;
  /** ISO deadline of the gameweek the chips would be played in. */
  nextDeadline: string | null;
  /** A rival's differential against your blank, from the swing feed. */
  rival: { name: string; eo: number; points: number } | null;
}

export interface BriefingResult {
  lines: BriefingLine[];
}

/** How close to a confirmed move counts as "closing" — priceOutlook's cut. */
export const TONIGHT_CUT = 0.92;
/** A differential, as EO — below this a hauler is not a template threat. */
const DIFFERENTIAL_EO = 10;
/** Hours before a chip's window closes at which it becomes worth a line. */
const CHIP_WINDOW_HOURS = 36;

/** Availability read the one way the app reads flags. */
const availOf = (s: BriefingStarter) =>
  readAvailability({ status: s.status, news: s.news, chanceOfPlaying: s.chanceOfPlaying });

const OUT_KINDS = new Set(["out", "suspended", "gone"]);

/**
 * The five triggers, in screen order.
 *
 * Every line's `facts` carries the exact figures its `text` quotes — count,
 * names, chance percentages, the deadline day — so verifyFigures can prove
 * the sentence. An `est` field is for anything the sentence does not say
 * (a probability the words render as "closing", never as a bare number).
 */
export function composeBriefing(input: BriefingInput): BriefingResult {
  const lines: BriefingLine[] = [];

  // ── flagged starters ────────────────────────────────────────────────────
  // FPL's words verbatim, via availability.ts — the same read the pitch and
  // the cockpit use, so three screens cannot disagree about a flag.
  const flagged = input.starters
    .map((s) => ({ s, a: availOf(s) }))
    .filter((r) => r.a.flagged)
    .sort((a, b) => (a.a.chance ?? 100) - (b.a.chance ?? 100));
  if (flagged.length > 0) {
    const worst = flagged.find((r) => OUT_KINDS.has(r.a.kind));
    const critical = Boolean(worst) || flagged.length > 1;
    lines.push({
      id: "flagged",
      state: critical ? "critical" : "warn",
      text:
        flagged.length === 1
          ? `Since you last looked, ${flagged[0].s.name} is flagged: ${availabilityLabel(flagged[0].a)}.`
          : `Since you last looked, ${flagged.length} starters are flagged, ${flagged
              .map((r) => r.s.name)
              .join(" and ")}.`,
      href: "/deadline",
      facts: {
        count: flagged.length,
        players: flagged.map((r) => ({
          name: r.s.name,
          label: availabilityLabel(r.a),
          chance: r.a.chance,
        })),
      },
    });
  }

  // ── captain ruled out ───────────────────────────────────────────────────
  // A flagged starter who wears the armband is the one line a manager must
  // see; the cockpit prices the fix, so the briefing only raises it.
  const captain = input.starters.find((s) => s.isCaptain);
  if (captain) {
    const a = availOf(captain);
    if (OUT_KINDS.has(a.kind)) {
      lines.push({
        id: "captain",
        state: "critical",
        text: `Your captain ${captain.name} is out: ${availabilityLabel(a)}. Move the armband.`,
        href: "/deadline",
        facts: { name: captain.name, label: availabilityLabel(a) },
      });
    }
  }

  // ── watchlist closing on a move ─────────────────────────────────────────
  // Only rows the price model actually covers — an uncovered row has no
  // probability and quoting one would be the invention this engine exists
  // to prevent. The percentage itself is an estimate: the words say
  // "closing", the number crosses separately in <Est>.
  const closing = input.watchlist
    .filter((r) => r.covered && r.pMove >= TONIGHT_CUT)
    .sort((a, b) => b.pMove - a.pMove)
    .slice(0, 3);
  if (closing.length > 0) {
    lines.push({
      id: "watchlist",
      state: "warn",
      text: `${closing.length} of your watchlist ${closing.length === 1 ? "is" : "are"} closing on a price move: ${closing
        .map((r) => `${r.name} (${r.direction === "up" ? "rise" : "fall"})`)
        .join(", ")}.`,
      est: {
        value: `${Math.round(closing[0].pMove * 100)}%`,
        method:
          "Modelled from stored transfer snapshots since the last confirmed change. Not FPL's own figure.",
      },
      href: "/deadline",
      facts: {
        count: closing.length,
        players: closing.map((r) => ({ name: r.name, direction: r.direction })),
      },
    });
  }

  // ── chip window closing ─────────────────────────────────────────────────
  // A window that is open and within the war-room horizon. The deadline day
  // is a fact from the bootstrap; the hours figure crosses as the est.
  const open = input.chips.filter(
    (c) => c.startEvent <= input.currentGw + 1 && c.stopEvent >= input.currentGw + 1,
  );
  const dl = input.nextDeadline ? new Date(input.nextDeadline).getTime() : null;
  const hoursLeft = dl != null ? Math.round((dl - Date.now()) / 3_600_000) : null;
  if (open.length > 0 && hoursLeft != null && dl != null && hoursLeft > 0 && hoursLeft <= CHIP_WINDOW_HOURS) {
    const deadlineDay = new Date(dl).toLocaleDateString("en-GB", { weekday: "long" });
    lines.push({
      id: "chip",
      state: "note",
      text: `${open.map((c) => c.label).join(", ")} can still be played — the window closes ${deadlineDay}.`,
      est: {
        value: `${hoursLeft}h`,
        method: "Hours until FPL's published deadline for the next gameweek.",
      },
      href: "/planner",
        facts: { chips: open.map((c) => c.label), day: deadlineDay },
      });
    }

  // ── rival differential ──────────────────────────────────────────────────
  // A low-EO hauler against your blank is the swing the rank feed prices.
  // The EO and the points are the model's own figures, so they cross as est.
  if (input.rival && input.rival.eo < DIFFERENTIAL_EO && input.rival.points >= 8) {
    lines.push({
      id: "rival",
      state: "note",
      text: `A differential is hauling: ${input.rival.name} scored while the template stayed quiet.`,
      est: {
        value: `${input.rival.points} pts`,
        method: `Live points this gameweek against ${input.rival.eo}% effective ownership — a swing against the field.`,
      },
      href: "/live",
      facts: { name: input.rival.name, eo: input.rival.eo, points: input.rival.points },
    });
  }

  return { lines };
}