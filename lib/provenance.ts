/**
 * provenance — the honesty moat, made visible (v10 D8).
 *
 * GAFFER already refuses to invent: availability is FPL's words, thin
 * coverage greys out with the reason, and every modelled figure carries its
 * method through <Est>. But all of that is *absence* of lying, and absence is
 * invisible. A user cannot see the seam, so it reads as having fewer stats
 * rather than more trustworthy ones.
 *
 * This module names the seam. Every figure on a stat surface is one of three
 * things, and each has one visual language:
 *
 *   published   — FPL's own field, read from the feed. No decoration.
 *   estimated   — our model's output. The dotted underline and the ~, with
 *                 the method in the tooltip. The existing <Est>.
 *   unavailable — Opta-only. An explicit "not published by FPL" affordance
 *                 where a competitor would show a number. Listing what we
 *                 deliberately do not fake turns an absence into a statement.
 *
 * The audit test (lib/provenance.audit.test.ts) reads the rendered sources
 * of the player, planner and board surfaces and asserts every numeric leaf
 * goes through one of the three components. A bare figure fails CI, which is
 * the only way this stays true.
 *
 * Pure data, no rendering — the components live in
 * components/gaffer/Provenance.tsx so the server can import the data
 * without dragging client code along.
 */

export type Provenance = "published" | "estimated" | "unavailable";

/** The one line the Unavailable affordance prints, everywhere it appears. */
export const UNAVAILABLE_LINE = "Not published by FPL";

/**
 * The Opta-only stats this app deliberately does not approximate, and why.
 * A competitor ships numbers for these; shipping a lookalike derived from
 * what FPL does publish would produce an authoritative-looking invention,
 * which is the one thing this codebase has consistently refused to do.
 */
export interface UnavailableStat {
  /** The label a competitor would put on a column. */
  label: string;
  /** Why we do not show a number for it — one honest sentence. */
  why: string;
}

export const UNAVAILABLE_STATS: UnavailableStat[] = [
  {
    label: "Big chances",
    why: "Big chances are Opta's definition of a clear opportunity. FPL's feed has no event data, so any count from it would be an invention.",
  },
  {
    label: "Pass completion",
    why: "Passes are not in FPL's feed at all. A completion percentage computed without passes would be a number wearing a decimal point.",
  },
  {
    label: "Line-breaking passes",
    why: "Breaking lines is a judgement about how a pass travels through opponents. Only Opta's event data can make it, and we do not buy it.",
  },
  {
    label: "Crosses",
    why: "FPL publishes expected assists but not the crossing volume underneath them, so the count would have to be guessed backwards.",
  },
  {
    label: "Chances created",
    why: "The nearest public figure is FPL's own Creativity index — a weighted model, not the raw event count other sites license.",
  },
  {
    label: "Touches in the box",
    why: "Touch locations are Opta event data. FPL publishes none of it, and deriving it from xG would be circular.",
  },
  {
    label: "Shots on target",
    why: "FPL publishes expected goals but not the shot table behind them. Threat is the closest published index, and it is a model.",
  },
];

/**
 * The provenance of a figure, stated once and reused by every surface that
 * shows it. Components wrap their numbers with the matching component; the
 * audit asserts they did.
 */
export function provenanceOf(kind: Provenance): string {
  switch (kind) {
    case "published":
      return "published — FPL's own figure, read from the feed.";
    case "estimated":
      return "estimated — modelled from FPL's published data; the method is on the tooltip.";
    case "unavailable":
      return UNAVAILABLE_LINE;
  }
}