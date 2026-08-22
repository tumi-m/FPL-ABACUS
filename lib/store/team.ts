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
    document.cookie = `${COOKIE}=${team.id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
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

/** Accepts a bare ID or a pasted FPL URL and extracts the entry id. */
export function parseTeamInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (/^\d{1,10}$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/entry\/(\d+)/);
  if (match) return Number(match[1]);
  return null;
}
