import type { GwPhase } from "@/lib/fpl/schemas";

/**
 * Week Machine lite (v5-G) — maps the data-driven GW phase onto the week's
 * moments so the home screen emphasises the right thing at the right time.
 * Pure and deterministic; never gates navigation — every surface stays
 * reachable ("always escapable").
 */
export type WeekMoment = "digest" | "workshop" | "warroom" | "reveal" | "match" | "wait";

export interface MomentSpec {
  key: WeekMoment;
  /** Upper-label chip text. */
  label: string;
  /** One-line emphasis for the home hero. */
  headline: string;
  /** Where attention should go this phase. */
  focus: "/live" | "/board" | "/field/points";
}

/** Inside this window before the deadline, planning becomes war room. */
const WAR_ROOM_WINDOW_MS = 36 * 3_600_000;

export function weekMoment(
  phase: GwPhase,
  now = Date.now(),
  deadlineTime?: string | null,
): MomentSpec {
  switch (phase) {
    case "final":
    case "bonus_added":
      return {
        key: "digest",
        label: "Digest",
        headline: "The score is in — see where the points went.",
        focus: "/field/points",
      };
    case "provisional":
      return {
        key: "reveal",
        label: "Reveal",
        headline: "Full-time scores are provisional — bonus can still move.",
        focus: "/live",
      };
    case "live":
      return {
        key: "match",
        label: "Match",
        headline: "Matches in play — watch the swings land.",
        focus: "/live",
      };
    case "awaiting_kickoff":
      return {
        key: "wait",
        label: "Wait",
        headline: "Deadline passed. Nothing to do but wait for kickoff.",
        focus: "/live",
      };
    case "pre_deadline": {
      const dl = deadlineTime ? new Date(deadlineTime).getTime() : null;
      if (dl != null && dl - now <= WAR_ROOM_WINDOW_MS) {
        return {
          key: "warroom",
          label: "War room",
          headline: "Deadline close — lock your XI and chips.",
          focus: "/board",
        };
      }
      return {
        key: "workshop",
        label: "Workshop",
        headline: "Plan the week ahead on the Board.",
        focus: "/board",
      };
    }
  }
}
