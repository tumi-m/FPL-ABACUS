/**
 * E4 — the interface that assembles itself.
 *
 * A multi-tool answer is several components; a flat stack of them is a list,
 * not a composed screen. This module lays the cards out as a generated
 * mini-dashboard — hero figure, supporting charts, sources — from a small
 * set of DETERMINISTIC templates chosen by component count and type.
 *
 * The model never emits layout code. It names components, exactly as it
 * does today; the server resolves them; TypeScript renders them through
 * one of these templates. That is the whole point: an interface that
 * assembles itself from resolved parts, not one the model gets to draw.
 *
 * Pure functions — tests stub cards and pin the template choice.
 */

export interface LayoutCard {
  /** Registry component key. */
  component: string;
  /** The resolved prose line the template can quote under the hero. */
  prose: string;
  /** The template may surface a note (e.g. thin coverage). */
  note?: string;
}

export interface AnswerLayout {
  template: "single" | "hero-side" | "hero-band" | "stack";
  /**
   * The card whose figure leads the screen — deterministic: the first in
   * the registry's hero ranking that answered, else the first resolved.
   */
  hero: LayoutCard | null;
  /** Everything that is not the hero, in resolve order. */
  support: LayoutCard[];
}

/** Components whose figure is worth leading with, in priority order. */
const HERO_RANK = [
  "rank-projection",
  "captain-compare",
  "transfer-sim",
  "chip-timing",
  "effective-bets",
] as const;

export function layoutAnswer(cards: LayoutCard[]): AnswerLayout {
  if (cards.length === 0) {
    return { template: "single", hero: null, support: [] };
  }
  if (cards.length === 1) {
    return { template: "single", hero: cards[0], support: [] };
  }
  const hero =
    HERO_RANK.map((key) => cards.find((c) => c.component === key)).find(
      (c): c is LayoutCard => c != null,
    ) ?? cards[0];
  const support = cards.filter((c) => c !== hero);
  // Two cards fit a hero + one panel; three or more need the banded
  // treatment when any support card is a chart the eye scans wide, else
  // they stack.
  const WIDE = new Set(["exposure-scatter", "rank-projection", "xg-vs-actual", "true-form", "swing-impact"]);
  const template =
    support.length === 1
      ? ("hero-side" as const)
      : support.some((c) => WIDE.has(c.component))
        ? ("hero-band" as const)
        : ("stack" as const);
  return { template, hero, support };
}