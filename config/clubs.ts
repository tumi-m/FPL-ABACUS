/**
 * Club identity — FLOODLIGHT rev-02 §8. Twenty colours we never have to invent,
 * tuned for legibility on the navy ground. The club colour is a decorative
 * identity accent and is ALWAYS paired with the 3-letter code — never the sole
 * encoder (three clubs are red, two are white; that's football).
 *
 * Rail colours live as CSS custom properties in app/globals.css so no raw hex
 * escapes the token file.
 */
export interface Club {
  id: number;
  code: string;
  name: string;
  /** CSS value for the club rail colour. */
  rail: string;
  /** True when the rail is light enough that crest ink must be dark. */
  lightInk: boolean;
}

const c = (
  id: number,
  code: string,
  name: string,
  lightInk = false,
): Club => ({ id, code, name, rail: `var(--club-${code.toLowerCase()})`, lightInk });

/** Keyed by FPL team id (2026/27 season). */
export const CLUB: Readonly<Record<number, Club>> = {
  1: c(1, "ARS", "Arsenal"),
  2: c(2, "AVL", "Aston Villa", true),
  3: c(3, "BOU", "Bournemouth"),
  4: c(4, "BRE", "Brentford", true),
  5: c(5, "BHA", "Brighton", true),
  6: c(6, "CHE", "Chelsea"),
  7: c(7, "COV", "Coventry City", true),
  8: c(8, "CRY", "Crystal Palace", true),
  9: c(9, "EVE", "Everton"),
  10: c(10, "FUL", "Fulham", true),
  11: c(11, "HUL", "Hull City", true),
  12: c(12, "IPS", "Ipswich Town", true),
  13: c(13, "LEE", "Leeds", true),
  14: c(14, "LIV", "Liverpool"),
  15: c(15, "MCI", "Man City", true),
  16: c(16, "MUN", "Man Utd"),
  17: c(17, "NEW", "Newcastle", true),
  18: c(18, "NFO", "Nott'm Forest"),
  19: c(19, "TOT", "Spurs", true),
  20: c(20, "SUN", "Sunderland"),
};

const UNKNOWN: Club = {
  id: -1,
  code: "?",
  name: "Unknown",
  rail: "var(--line-hi)",
  lightInk: false,
};

export function clubOf(teamId: number | null | undefined): Club {
  return (teamId != null && CLUB[teamId]) || UNKNOWN;
}

/** Row-hover / fixture-cell tint derived from the rail at runtime. */
export function railWash(club: Club): string {
  return `color-mix(in oklab, ${club.rail} 14%, transparent)`;
}
