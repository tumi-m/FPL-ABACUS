"use client";

const RECENT_KEY = "gaffer_recent_teams";
const COOKIE = "gaffer_team";

export interface RecentTeam {
  id: number;
  name: string;
  rank?: number | null;
}

function readRecent(): RecentTeam[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentTeam[]) : [];
  } catch {
    return [];
  }
}

export function getRecentTeams(): RecentTeam[] {
  if (typeof window === "undefined") return [];
  return readRecent();
}

export function rememberTeam(team: RecentTeam): void {
  try {
    const list = [team, ...readRecent().filter((t) => t.id !== team.id)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    document.cookie = `${COOKIE}=${team.id}; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax`;
  } catch {
    // storage unavailable — session-only
  }
}

export function forgetTeam(id: number): RecentTeam[] {
  try {
    const list = readRecent().filter((t) => t.id !== id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    return list;
  } catch {
    return [];
  }
}

/** What the gate parsed from a paste or a typed value. */
export type GateInput =
  | { kind: "entry"; id: number }
  | { kind: "league"; id: number }
  | null;

/**
 * Entry-gate parser (v4 spec): entry URL → league URL → bare digits. Name
 * search has no FPL endpoint and stays a coverage message until the index
 * exists. Order matters: URLs first, bare digits last.
 */
export function parseGateInput(raw: string): GateInput {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{1,10}$/.test(trimmed)) return { kind: "entry", id: Number(trimmed) };
  const entry = trimmed.match(/entry\/(\d+)/);
  if (entry) return { kind: "entry", id: Number(entry[1]) };
  const league = trimmed.match(/leagues?\/(\d+)/);
  if (league) return { kind: "league", id: Number(league[1]) };
  return null;
}

/** Accepts a bare ID or a pasted FPL URL and extracts the entry id. */
export function parseTeamInput(raw: string): number | null {
  const parsed = parseGateInput(raw);
  return parsed?.kind === "entry" ? parsed.id : null;
}
