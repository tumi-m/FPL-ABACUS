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
  /** FPL badge code for the CDN crest PNG (/badges/70/t{code}.png). */
  crestCode: number;
  /** Rough stadium position in % of a 0-100 England map band (lon → x, lat → y). */
  map: { x: number; y: number };
}

const c = (
  id: number,
  code: string,
  name: string,
  lightInk = false,
  crestCode = 0,
  map: { x: number; y: number } = { x: 50, y: 50 },
): Club => ({ id, code, name, rail: `var(--club-${code.toLowerCase()})`, lightInk, crestCode, map });

/** Keyed by FPL team id (2026/27 season). Map coords share the coastline
 *  projection in config/englandCoast.ts (lon −5.8..1.8 → x, lat 55.9..50 → y);
 *  same-city clubs are fanned apart so markers never overlap. */
export const CLUB: Readonly<Record<number, Club>> = {
  //         FPL id code  name               light  crest  map (x,y)
  1:  c(1,  "ARS", "Arsenal",        false, 3,  { x: 73.5, y: 72.5 }),
  2:  c(2,  "AVL", "Aston Villa",    true,  7,  { x: 51.5, y: 57.5 }),
  3:  c(3,  "BOU", "Bournemouth",    false, 91, { x: 51.9, y: 87.5 }),
  4:  c(4,  "BRE", "Brentford",      true,  94, { x: 71.5, y: 74.0 }),
  5:  c(5,  "BHA", "Brighton",       true,  36, { x: 73.9, y: 85.7 }),
  6:  c(6,  "CHE", "Chelsea",        false, 8,  { x: 74.5, y: 76.5 }),
  7:  c(7,  "COV", "Coventry City",  true,  9,  { x: 56.7, y: 58.5 }),
  8:  c(8,  "CRY", "Crystal Palace", true,  31, { x: 76.5, y: 78.0 }),
  9:  c(9,  "EVE", "Everton",        false, 11, { x: 35.5, y: 40.5 }),
  10: c(10, "FUL", "Fulham",         true,  54, { x: 73.0, y: 75.5 }),
  11: c(11, "HUL", "Hull City",      true,  88, { x: 71.5, y: 36.5 }),
  12: c(12, "IPS", "Ipswich Town",   true,  40, { x: 91.4, y: 65.2 }),
  13: c(13, "LEE", "Leeds",          true,  2,  { x: 55.6, y: 33.4 }),
  14: c(14, "LIV", "Liverpool",      false, 14, { x: 39.0, y: 44.0 }),
  15: c(15, "MCI", "Man City",       true,  43, { x: 48.5, y: 40.0 }),
  16: c(16, "MUN", "Man Utd",        false, 1,  { x: 44.5, y: 42.5 }),
  17: c(17, "NEW", "Newcastle",      true,  4,  { x: 53.5, y: 14.5 }),
  18: c(18, "NFO", "Nott'm Forest",  false, 17, { x: 61.4, y: 50.2 }),
  19: c(19, "TOT", "Spurs",          true,  6,  { x: 76.5, y: 71.0 }),
  20: c(20, "SUN", "Sunderland",     false, 56, { x: 59.5, y: 17.5 }),
};

const UNKNOWN: Club = {
  id: -1,
  code: "?",
  name: "Unknown",
  rail: "var(--line-hi)",
  lightInk: false,
  crestCode: 0,
  map: { x: 50, y: 50 },
};

export function clubOf(teamId: number | null | undefined): Club {
  return (teamId != null && CLUB[teamId]) || UNKNOWN;
}

/** Row-hover / fixture-cell tint derived from the rail at runtime. */
export function railWash(club: Club): string {
  return `color-mix(in oklab, ${club.rail} 14%, transparent)`;
}
