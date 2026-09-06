/**
 * gafferMessages — the lower-third the Gaffer speaks through.
 *
 * A console football game tells you what just happened while you are watching
 * something else: a chip, a name, a line, gone in a few seconds. That is the
 * missing register here. The Swing Feed is a ledger you go and read; this is
 * the tap on the shoulder for the two or three moments in a round that are
 * worth interrupting for — your captain scored, your bench came on, the bonus
 * settled, your rank moved.
 *
 * Everything is a diff of two models, so it is pure and testable, and every
 * figure in a message comes off a field of the model rather than out of a
 * sentence. A message that cannot name where its number came from is a
 * message this file does not produce.
 *
 * Deliberately stingy. A notification that fires on everything is a
 * notification you learn to ignore, so threats have an ownership floor, the
 * caller passes what it has already shown, and the component that renders
 * these shows at most a few at a time.
 */
import type { MatchdayModel, SwingRow } from "@/lib/engines/matchdayModel";

export type MessageKind = "swing" | "threat" | "autosub" | "rank" | "settled" | "deadline";
export type MessageTone = "good" | "bad" | "neutral";

export interface GafferMessage {
  /** Stable across polls, so the same moment is never announced twice. */
  id: string;
  kind: MessageKind;
  /** The chip above the headline — the category, in the game's register. */
  label: string;
  headline: string;
  detail: string;
  tone: MessageTone;
  /** Where the moment can be read in full, when there is such a place. */
  href?: string;
}

/**
 * A threat has to be this widely owned before it is worth interrupting for.
 * Below it the message is "somebody you don't own scored", which is true of
 * most goals in most gameweeks and tells you nothing.
 */
export const THREAT_EO_FLOOR = 25;

/** How close the deadline has to be before the Gaffer mentions it. */
export const DEADLINE_WINDOW_MS = 3 * 3_600_000;

/** The verb for a scoring event, and whether it is worth announcing at all. */
const VERB: Partial<Record<SwingRow["identifier"], string>> = {
  goals_scored: "scores",
  assists: "assists",
  own_goals: "turns it into his own net",
  penalties_saved: "saves the penalty",
  penalties_missed: "misses from the spot",
  yellow_cards: "goes into the book",
  red_cards: "is sent off",
  saves: "keeps them out",
  bonus: "takes the bonus",
  defensive_contribution: "hits his defensive contribution",
};

const plural = (n: number, word: string) => `${n} ${word}${Math.abs(n) === 1 ? "" : "s"}`;

function swingMessage(s: SwingRow): GafferMessage | null {
  const verb = VERB[s.identifier];
  if (!verb || s.points === 0) return null;
  const mult = s.yourMultiplier;
  // The raw points are the event's; the multiplier is what your armband does
  // to them. Saying "+12" for a captain's goal without saying it was doubled
  // is a number the manager cannot find anywhere else on the screen.
  const landed = s.points * mult;
  const detail =
    mult > 1
      ? `${plural(s.points, "point")}, doubled to ${landed} by your armband.`
      : `${landed > 0 ? "+" : ""}${landed} on your score.`;
  return {
    id: `swing:${s.id}`,
    kind: "swing",
    label: mult > 1 ? "Your captain" : "One of yours",
    headline: `${s.webName} ${verb}`,
    detail,
    tone: s.kind === "loss" ? "bad" : s.kind === "gain" ? "good" : "neutral",
    href: "/live",
  };
}

function threatMessage(s: SwingRow): GafferMessage | null {
  const verb = VERB[s.identifier];
  if (!verb || s.points <= 0) return null;
  return {
    id: `threat:${s.id}`,
    kind: "threat",
    label: "Against you",
    headline: `${s.webName} ${verb}`,
    // eo is the model's own effective-ownership figure for the cohort; the
    // sentence says what it is rather than dressing it as a rank move.
    detail: `${s.eo}% of the field own him. You don't.`,
    tone: "bad",
    href: "/live",
  };
}

/**
 * Every message this poll produced that the caller has not already shown.
 *
 * `seen` is the caller's memory, not ours: this function has no state, so the
 * same two models always produce the same list, and a component that forgets
 * (a reload, a new tab) simply gets the round's moments again rather than a
 * different set.
 */
export function gafferMessages(
  prev: MatchdayModel | null,
  next: MatchdayModel,
  opts: { now: number; seen: ReadonlySet<string> },
): GafferMessage[] {
  const out: GafferMessage[] = [];
  const push = (m: GafferMessage | null) => {
    if (m && !opts.seen.has(m.id)) out.push(m);
  };

  // ── The deadline. Said once, and only while it is still ahead of you.
  const deadline = next.event.deadlineTime ? new Date(next.event.deadlineTime).getTime() : NaN;
  if (Number.isFinite(deadline)) {
    const left = deadline - opts.now;
    if (left > 0 && left <= DEADLINE_WINDOW_MS) {
      const hours = Math.floor(left / 3_600_000);
      const minutes = Math.round((left - hours * 3_600_000) / 60_000);
      push({
        id: `deadline:${next.event.id}`,
        kind: "deadline",
        label: "Deadline",
        headline: hours > 0 ? `${hours}h ${minutes}m to lock in` : `${minutes}m to lock in`,
        detail: "Check the XI, the armband and the flags before it closes.",
        tone: "neutral",
        href: "/deadline",
      });
    }
  }

  // ── The bonus landing. The one transition that changes a provisional
  //    score into a real one, and the moment people refresh for.
  const settled = next.phase === "bonus_added" || next.phase === "final";
  const wasSettled = prev?.phase === "bonus_added" || prev?.phase === "final";
  if (settled && prev != null && !wasSettled) {
    push({
      id: `settled:${next.event.id}:${next.hero.gwPoints}`,
      kind: "settled",
      label: "Final",
      headline: `GW${next.event.id} settles on ${next.hero.gwPoints}`,
      detail: "Bonus is in. Nothing else moves this week.",
      tone: "neutral",
      href: "/field/points",
    });
  }

  // ── Auto-subs. A bench player coming on is a change to the team you
  //    picked, made without you, and it is worth being told about.
  const before = new Set((prev?.subs ?? []).map((s) => `${s.out}>${s.in}`));
  const nameOf = (element: number) =>
    next.squad.find((r) => r.element === element)?.webName ?? `#${element}`;
  for (const sub of next.subs) {
    const key = `${sub.out}>${sub.in}`;
    if (prev != null && before.has(key)) continue;
    push({
      id: `autosub:${next.event.id}:${key}`,
      kind: "autosub",
      label: "Auto-sub",
      headline: `${nameOf(sub.in)} comes on`,
      detail: `${nameOf(sub.out)} did not play, so your bench covers him.`,
      tone: "neutral",
      href: "/live",
    });
  }

  // ── The swings themselves, yours first.
  for (const s of next.swings) {
    if (s.yourMultiplier > 0) push(swingMessage(s));
    else if (s.eo >= THREAT_EO_FLOOR) push(threatMessage(s));
  }

  // ── Rank. Only against the previous poll, and only when the model has a
  //    rank on both sides — an estimate becoming official is not a climb.
  const rankOf = (m: MatchdayModel | null) =>
    m == null
      ? null
      : m.hero.officialLiveRank != null
        ? { value: m.hero.officialLiveRank, official: true }
        : m.hero.estimatedLiveRank != null
          ? { value: m.hero.estimatedLiveRank, official: false }
          : null;
  const a = rankOf(prev);
  const b = rankOf(next);
  if (a && b && a.official === b.official && b.value !== a.value) {
    const moved = a.value - b.value;
    const up = moved > 0;
    push({
      id: `rank:${next.event.id}:${b.value}`,
      kind: "rank",
      label: b.official ? "Overall rank" : "Rank, estimated",
      headline: `${up ? "Up" : "Down"} ${Math.abs(moved).toLocaleString("en-GB")} places`,
      detail: `Now ${b.value.toLocaleString("en-GB")}${b.official ? "" : " — our estimate, not FPL's"}.`,
      tone: up ? "good" : "bad",
      href: "/board",
    });
  }

  return out;
}
