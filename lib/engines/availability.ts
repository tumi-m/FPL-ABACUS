/**
 * availability — what FPL's flag on a player actually says.
 *
 * FPL gives you a one-letter `status`, a free-text `news` line and a
 * percentage. The news is the useful part and it is almost structured: the
 * shapes below cover what the API actually emits.
 *
 *   "Knee injury - 75% chance of playing"
 *   "Ankle injury - Expected back 15 Feb"
 *   "Suspended - Expected back 20 Jan"
 *   "Joined Real Madrid on loan"
 *   ""                                     (fit, nothing to say)
 *
 * A dash separates the ailment from the prognosis, so the two halves are read
 * apart: one names what is wrong, the other says when it ends. Anything that
 * does not fit is passed through whole rather than mangled — a wrong guess
 * about a player's fitness is worse than the raw sentence.
 *
 * Pure functions only.
 */

/** Severity, in the order a manager cares about it. */
export type AvailabilityKind = "fit" | "doubt" | "out" | "suspended" | "gone";

export interface Availability {
  kind: AvailabilityKind;
  /** What is wrong, from the news line — "Knee injury", "Suspended". */
  note: string;
  /** The prognosis half — "Expected back 15 Feb", "75% chance of playing". */
  prognosis: string;
  /** FPL's own percentage when it published one. */
  chance: number | null;
  /** True when there is anything at all worth showing. */
  flagged: boolean;
}

const FIT: Availability = {
  kind: "fit",
  note: "",
  prognosis: "",
  chance: null,
  flagged: false,
};

/**
 * Read one player's flag.
 *
 * `status` decides severity, because it is the field FPL actually maintains;
 * the news only ever refines the wording. A player can carry news while fit
 * ("Joined on loan" on someone who left) — `flagged` follows the status, not
 * the presence of text.
 */
export function readAvailability(p: {
  status: string;
  news: string;
  chanceOfPlaying: number | null;
}): Availability {
  const kind = kindOf(p.status);
  const news = (p.news ?? "").trim();
  if (kind === "fit" && news === "") return FIT;

  const { note, prognosis } = splitNews(news);
  return {
    kind,
    note,
    prognosis,
    chance: p.chanceOfPlaying,
    flagged: kind !== "fit",
  };
}

function kindOf(status: string): AvailabilityKind {
  switch (status) {
    case "d":
      return "doubt";
    case "i":
      return "out";
    case "s":
      return "suspended";
    case "u":
    case "n":
      return "gone";
    default:
      return "fit";
  }
}

/**
 * Split "Knee injury - Expected back 15 Feb" on the separating dash.
 *
 * Only the first dash separates, and only when it is a standalone one:
 * "Hamstring" and "Expected back" never contain a spaced dash, but a club name
 * might ("Brighton - Hove"), so the split is anchored to " - ".
 */
export function splitNews(news: string): { note: string; prognosis: string } {
  const at = news.indexOf(" - ");
  if (at === -1) return { note: news, prognosis: "" };
  return {
    note: news.slice(0, at).trim(),
    prognosis: news.slice(at + 3).trim(),
  };
}

/**
 * The one line to show beside a name.
 *
 * The percentage is only added when FPL published one and the prognosis does
 * not already carry it — "75% chance of playing - 75%" reads like a bug.
 */
export function availabilityLabel(a: Availability): string {
  if (!a.flagged) return "";
  const parts = [a.note || KIND_FALLBACK[a.kind]];
  if (a.prognosis) parts.push(a.prognosis);
  else if (a.chance != null && a.kind !== "gone") parts.push(`${a.chance}% chance`);
  return parts.join(" · ");
}

const KIND_FALLBACK: Record<AvailabilityKind, string> = {
  fit: "",
  doubt: "A doubt",
  out: "Unavailable",
  suspended: "Suspended",
  gone: "Left the league",
};

/** Sort key: the ones you must act on first. */
export const KIND_ORDER: Record<AvailabilityKind, number> = {
  out: 0,
  suspended: 1,
  gone: 2,
  doubt: 3,
  fit: 4,
};

/** Worst first, then least likely to play, then by name. */
export function bySeverity<T extends { availability: Availability; webName: string }>(
  a: T,
  b: T,
): number {
  const order = KIND_ORDER[a.availability.kind] - KIND_ORDER[b.availability.kind];
  if (order !== 0) return order;
  const ca = a.availability.chance ?? 100;
  const cb = b.availability.chance ?? 100;
  if (ca !== cb) return ca - cb;
  return a.webName.localeCompare(b.webName);
}
