/**
 * cockpit — the deadline screen's verdict engine.
 *
 * A manager opens the app in the ninety minutes before a deadline with one
 * question: am I done? The cockpit answers it as a column of verdicts, one
 * line each, with the evidence a tap away. Every verdict is computed HERE,
 * from data the server composed — never in a component — so a verdict always
 * traces to an engine and the screen cannot drift from the engines it reads.
 *
 * Blocks:
 *   xi        — formation legality (FPL's own rules: 1 GK, 3–5 DEF, 2–5 MID,
 *               1–3 FWD, eleven total).
 *   flagged   — starters FPL has flagged, in FPL's words (availability.ts).
 *   captain   — the armband, against the best alternative by projection.
 *   transfers — free transfers left, and the move worth making with them.
 *   price     — squad players in live price traffic (priceOutlook).
 *
 * Two honesty rules shape the shape of the output:
 *   - Verdict text carries COUNTS and NAMES (facts), never estimates. Every
 *     estimated figure crosses as a separate `est` field the UI wraps in
 *     <Est> — a sentence you cannot fact-check is a sentence we do not emit.
 *   - A block with nothing to say collapses to an ok state; the UI renders it
 *     as a tick line, not an empty card.
 *
 * Pure functions only.
 */
import { readAvailability, availabilityLabel, type Availability } from "@/lib/engines/availability";
import { priceOutlook } from "@/lib/engines/planner";

export type CockpitBlockId = "xi" | "flagged" | "captain" | "transfers" | "price";
export type CockpitState = "ok" | "warn" | "critical";

export interface CockpitEvidence {
  /** The line, as it should read. */
  text: string;
  /** A wrapped-estimate figure shown beside the line, when there is one. */
  est?: { value: string; method: string };
  href?: string;
}

export interface CockpitBlock {
  id: CockpitBlockId;
  state: CockpitState;
  /** The one line that is always visible. */
  verdict: string;
  /** Expandable evidence; absent for tick lines. */
  evidence?: CockpitEvidence[];
  /** Where the fix happens. The Planner stays the only desk that moves a player. */
  action?: { label: string; href: string };
}

export interface CockpitResult {
  blocks: CockpitBlock[];
  /** True when every block is ok — the screen then says "Nothing else to do." */
  allClear: boolean;
}

/** One squad slot, in slot order (1–11 are the starting XI). */
export interface CockpitSlot {
  id: number;
  name: string;
  /** 1 GK · 2 DEF · 3 MID · 4 FWD */
  pos: number;
  slot: number;
  isCaptain: boolean;
  status: string;
  news: string;
  chanceOfPlaying: number | null;
  /** Projected points per gameweek; absent when projections missed the deadline. */
  horizon?: number[] | null;
  netTransfers?: number;
  costChangeEvent?: number;
}

export interface CockpitSuggestion {
  outId: number;
  inId: number;
  outName: string;
  inName: string;
  /** Projected gain over the window, already net of nothing — the hit is priced separately. */
  gain: number;
}

export interface CockpitInput {
  /** True when the picks endpoint refused us — most verdicts cannot run. */
  squadUnavailable: boolean;
  /** All fifteen slots, slot order. Empty when unavailable. */
  slots: CockpitSlot[];
  freeTransfers: number;
  /** Null when the projection desk missed its deadline — those blocks degrade. */
  projection: {
    weeks: number;
    suggestion: CockpitSuggestion | null;
    hitCost: number;
  } | null;
}

const XI_SLOTS = 11;
const MIN_PER_POS: Record<number, number> = { 1: 1, 2: 3, 3: 2, 4: 1 };
const MAX_PER_POS: Record<number, number> = { 1: 1, 2: 5, 3: 5, 4: 3 };
const POS_NAME_LOWER: Record<number, string> = {
  1: "in goal",
  2: "at the back",
  3: "in midfield",
  4: "up front",
};

/** Where a formation breaks FPL's rules, in the words the screen shows. */
export function assessFormation(
  xi: { pos: number }[],
): { ok: boolean; problem: string | null } {
  if (xi.length !== XI_SLOTS) {
    const short = XI_SLOTS - xi.length;
    return {
      ok: false,
      problem: short === 1 ? "Your XI is one short" : `Your XI is ${short} short`,
    };
  }
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const p of xi) counts[p.pos] = (counts[p.pos] ?? 0) + 1;
  for (const pos of [1, 2, 3, 4]) {
    if (counts[pos] < MIN_PER_POS[pos]) {
      return { ok: false, problem: `You are one short ${POS_NAME_LOWER[pos]}` };
    }
    if (counts[pos] > MAX_PER_POS[pos]) {
      return { ok: false, problem: `You are one too many ${POS_NAME_LOWER[pos]}` };
    }
  }
  return { ok: true, problem: null };
}

/** "3-4-3" from the XI — a fact, not a projection. */
export function formationOf(xi: { pos: number }[]): string {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const p of xi) counts[p.pos] = (counts[p.pos] ?? 0) + 1;
  return `${counts[2]}-${counts[3]}-${counts[4]}`;
}

/** Projected points over the first `weeks` of a horizon. */
function windowPoints(horizon: number[] | null | undefined, weeks: number): number | null {
  if (!horizon || horizon.length === 0) return null;
  let total = 0;
  for (let i = 0; i < Math.min(weeks, horizon.length); i++) total += horizon[i];
  return Math.round(total * 10) / 10;
}

/** A player's availability, read the one way the app reads flags. */
function availabilityOf(p: CockpitSlot): Availability {
  return readAvailability({
    status: p.status,
    news: p.news,
    chanceOfPlaying: p.chanceOfPlaying,
  });
}

const CAPTAIN_PROJ_METHOD =
  "Projected points for the next gameweek: FPL's own expectation blended with recent form, scaled by the opponent's rates and the venue.";

/**
 * The five blocks, in screen order. Blocks that have nothing to say come back
 * as `ok` with no evidence — a tick line, never an empty card.
 */
export function composeCockpit(input: CockpitInput): CockpitResult {
  if (input.squadUnavailable || input.slots.length === 0) {
    return {
      blocks: [
        {
          id: "xi",
          state: "critical",
          verdict: "Your picks are not visible right now, so the desk cannot judge anything.",
          evidence: [
            { text: "FPL refused the picks request. Everything else below needs your fifteen." },
          ],
        },
      ],
      allClear: false,
    };
  }

  const xi = input.slots.filter((s) => s.slot <= XI_SLOTS);
  const blocks: CockpitBlock[] = [];
  const proj = input.projection;

  // ── xi ──────────────────────────────────────────────────────────────────
  const formation = assessFormation(xi);
  blocks.push(
    formation.ok
      ? {
          id: "xi",
          state: "ok",
          verdict: `Your XI is legal — ${formationOf(xi)}.`,
        }
      : {
          id: "xi",
          state: "critical",
          verdict: formation.problem ?? "Your XI is illegal.",
        },
  );

  // ── flagged ─────────────────────────────────────────────────────────────
  const flagged = xi
    .map((p) => ({ p, a: availabilityOf(p) }))
    .filter((r) => r.a.flagged)
    .sort((a, b) => (a.a.chance ?? 100) - (b.a.chance ?? 100));
  blocks.push(
    flagged.length === 0
      ? { id: "flagged", state: "ok", verdict: "No starters are flagged." }
      : {
          id: "flagged",
          state: flagged.some((r) => r.a.kind === "out" || r.a.kind === "suspended" || r.a.kind === "gone")
            ? "critical"
            : "warn",
          verdict:
            flagged.length === 1
              ? "1 starter is flagged."
              : `${flagged.length} starters are flagged.`,
          evidence: flagged.map((r) => ({
            text: `${r.p.name} — ${availabilityLabel(r.a) || r.p.status}`,
            href: `/players/${r.p.id}`,
          })),
        },
  );

  // ── captain ─────────────────────────────────────────────────────────────
  const captain = xi.find((s) => s.isCaptain) ?? null;
  if (!captain) {
    blocks.push({
      id: "captain",
      state: "warn",
      verdict: "No captain is set — FPL will pick one for you.",
    });
  } else {
    const capFlag = availabilityOf(captain);
    if (capFlag.kind === "out" || capFlag.kind === "suspended" || capFlag.kind === "gone") {
      blocks.push({
        id: "captain",
        state: "critical",
        verdict: `Your captain is flagged — ${availabilityLabel(capFlag) || capFlag.kind}. Re-arm the armband.`,
      });
    } else if (!proj) {
      blocks.push({
        id: "captain",
        state: "ok",
        verdict: `Captain: ${captain.name}. The projection desk is quiet, so the armband is not priced.`,
      });
    } else {
      const capPts = windowPoints(captain.horizon ?? null, 1);
      const best = xi
        .filter((s) => s.id !== captain.id && (availabilityOf(s).kind === "fit" || availabilityOf(s).kind === "doubt"))
        .map((s) => ({ s, pts: windowPoints(s.horizon ?? null, 1) }))
        .filter((r): r is { s: CockpitSlot; pts: number } => r.pts != null)
        .sort((a, b) => b.pts - a.pts)[0];
      if (capPts == null) {
        blocks.push({
          id: "captain",
          state: "ok",
          verdict: `Captain: ${captain.name}. No projection is available for him this week.`,
        });
      } else if (!best || best.pts <= capPts) {
        blocks.push({
          id: "captain",
          state: "ok",
          verdict: `Captain: ${captain.name} — the armband is on the highest projection in your XI.`,
        });
      } else {
        const gap = Math.round((best.pts - capPts) * 10) / 10;
        blocks.push({
          id: "captain",
          state: gap >= 1 ? "warn" : "ok",
          verdict: `Captain: ${captain.name} — ${best.s.name} projects higher this week.`,
          evidence: [
            {
              text: `${best.s.name} over the armband`,
              est: {
                value: `+${gap.toFixed(1)}`,
                method: CAPTAIN_PROJ_METHOD,
              },
            },
          ],
        });
      }
    }
  }

  // ── transfers ───────────────────────────────────────────────────────────
  if (!proj) {
    blocks.push({
      id: "transfers",
      state: "ok",
      verdict: `${input.freeTransfers} free transfer${input.freeTransfers === 1 ? "" : "s"} in hand. The projection desk did not answer in time, so the move worth making is not priced — the Planner can price it directly.`,
      action: { label: "Open the Planner", href: "/planner" },
    });
  } else {
    const s = proj.suggestion;
    if (input.freeTransfers >= 1) {
      blocks.push(
        s
          ? {
              id: "transfers",
              state: "warn",
              verdict: `${input.freeTransfers} free transfer${input.freeTransfers === 1 ? "" : "s"} unused — the move worth making: ${s.outName} → ${s.inName}.`,
              evidence: [
                {
                  text: `${s.inName} for ${s.outName}, over the next ${proj.weeks} gameweeks`,
                  est: {
                    value: `+${s.gain.toFixed(1)}`,
                    method: `Projected points over ${proj.weeks} gameweeks: FPL's next-week expectation blended with form, scaled per gameweek by the fixture model. Doubles stack, blanks score zero.`,
                  },
                },
              ],
              action: { label: "Stage it in the Planner", href: `/planner?out=${s.outId}&in=${s.inId}` },
            }
          : {
              id: "transfers",
              state: "ok",
              verdict:
                input.freeTransfers === 1
                  ? "Your free transfer is banked — nothing in the market beats your fifteen over the window."
                  : `${input.freeTransfers} free transfers unused — nothing in the market beats your fifteen over the window.`,
            },
      );
    } else {
      // No free transfer: only a hit-priced recommendation is worth saying.
      const hitWorth = s != null && s.gain > proj.hitCost;
      blocks.push(
        hitWorth && s
          ? {
              id: "transfers",
              state: "warn",
              verdict: `No free transfer left — ${s.outName} → ${s.inName} is still worth the hit.`,
              evidence: [
                {
                  text: `Gain over the window against the ${proj.hitCost}-point hit`,
                  est: {
                    value: `+${s.gain.toFixed(1)}`,
                    method: `Projected points over ${proj.weeks} gameweeks, against the ${proj.hitCost}-point cost of the hit.`,
                  },
                },
              ],
              action: { label: "Price the hit in the Planner", href: `/planner?out=${s.outId}&in=${s.inId}` },
            }
          : { id: "transfers", state: "ok", verdict: "No free transfer left — hold." },
      );
    }
  }

  // ── price ───────────────────────────────────────────────────────────────
  const movers = input.slots
    .map((p) => ({ p, o: priceOutlook({ netTransfers: p.netTransfers ?? 0, costChangeEvent: p.costChangeEvent ?? 0 }) }))
    .filter((r) => !r.o.movedThisGw && Math.abs(r.o.progress) >= 0.6)
    .sort((a, b) => Math.abs(b.o.progress) - Math.abs(a.o.progress));
  blocks.push(
    movers.length === 0
      ? { id: "price", state: "ok", verdict: "None of your fifteen are closing on a price move." }
      : {
          id: "price",
          state: "ok",
          verdict: `${movers.length} of your fifteen ${movers.length === 1 ? "is" : "are"} within reach of a price move.`,
          evidence: movers.map((r) => ({
            text: `${r.p.name} — ${r.o.label}`,
            est: {
              value: `${Math.round(Math.abs(r.o.progress) * 100)}%`,
              method: "Net transfers this gameweek against the ~180k net moves a price change typically takes. FPL never publishes the real threshold, so this is a modelled estimate.",
            },
          })),
        },
  );

  return { blocks, allClear: blocks.every((b) => b.state === "ok") };
}