import "server-only";

/**
 * Server composition for the standalone boards — Bonus and DEFCON.
 *
 * Both read the same season row the Field's performers board uses, so there is
 * one definition of "a player's season" in the app. The bonus board can also
 * work a window of recent gameweeks, which needs the per-gameweek live feeds:
 * FPL publishes the season bonus total but not the 3/2/1 split, and the only
 * honest way to get that is to read the weeks themselves.
 */
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getLive } from "@/lib/fpl/endpoints";
import { clubOf } from "@/config/clubs";
import type { PerfPlayer } from "@/lib/engines/performance";

/** The most gameweeks a window view will ever fetch. */
export const MAX_WINDOW = 8;

export interface BoardSeason {
  currentGw: number;
  players: PerfPlayer[];
}

/** Every selectable player's season, shaped for the performance engine. */
export async function buildSeason(): Promise<BoardSeason> {
  const boot = await getBootstrapLite();
  const currentGw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);

  const players: PerfPlayer[] = Object.values(boot.elements)
    .filter((el) => el.status !== "u")
    .map((el) => ({
      id: el.id,
      name: el.web_name,
      pos: el.element_type,
      teamId: el.team,
      code: clubOf(el.team).code,
      photo: el.photo,
      cost: el.now_cost,
      minutes: el.minutes,
      starts: el.starts,
      points: el.total_points,
      goals: el.goals_scored,
      assists: el.assists,
      cleanSheets: el.cleanSheets,
      goalsConceded: el.goalsConceded,
      saves: el.saves,
      bonus: el.bonus,
      bps: el.bps,
      defcon: el.defcon,
      tackles: el.tackles,
      recoveries: el.recoveries,
      cbi: el.cbi,
      yellowCards: el.yellowCards,
      redCards: el.redCards,
      xg: el.xgTotal,
      xa: el.xaTotal,
      xgi: el.xgiTotal,
      xgc: el.xgcTotal,
      owned: el.selected_by_percent,
      deadBall: el.deadBall,
    }));

  return { currentGw, players };
}

/** One player's bonus record across the window that was actually read. */
export interface BonusWindowRow {
  element: number;
  /** How many times they took three, two and one. */
  threes: number;
  twos: number;
  ones: number;
  total: number;
  /** Gameweeks in the window where they played at all. */
  appearances: number;
  /** BPS accumulated across the window — the conversion denominator. */
  bps: number;
}

export interface BonusWindow {
  /** The gameweeks actually read, oldest first. */
  gws: number[];
  rows: Map<number, BonusWindowRow>;
}

/**
 * The 3·2·1 split across a window of gameweeks.
 *
 * Each finished gameweek's live feed is a single cached upstream read, so a
 * window of five costs five cache hits rather than five hundred per-player
 * summary fetches. A gameweek that fails to load is dropped from the window
 * rather than faking a zero — the caller sees which weeks it actually got.
 */
export async function buildBonusWindow(currentGw: number, weeks: number): Promise<BonusWindow> {
  const span = Math.max(1, Math.min(MAX_WINDOW, weeks));
  const wanted: number[] = [];
  for (let gw = currentGw; gw > currentGw - span && gw >= 1; gw--) wanted.push(gw);
  wanted.reverse();

  const settled = await Promise.allSettled(wanted.map((gw) => getLive(gw)));
  const rows = new Map<number, BonusWindowRow>();
  const gws: number[] = [];

  settled.forEach((res, i) => {
    if (res.status !== "fulfilled") return;
    gws.push(wanted[i]);
    for (const el of res.value.elements) {
      const s = el.stats;
      if (s.minutes <= 0 && s.bps === 0) continue;
      const row =
        rows.get(el.id) ??
        { element: el.id, threes: 0, twos: 0, ones: 0, total: 0, appearances: 0, bps: 0 };
      if (s.minutes > 0) row.appearances++;
      row.bps += s.bps;
      if (s.bonus === 3) row.threes++;
      else if (s.bonus === 2) row.twos++;
      else if (s.bonus === 1) row.ones++;
      row.total += s.bonus;
      rows.set(el.id, row);
    }
  });

  return { gws, rows };
}

/** One player's defensive record across a window. */
export interface DefconWindowRow {
  element: number;
  defcon: number;
  /** Gameweeks where the two-point threshold was actually cleared. */
  hits: number;
  appearances: number;
  minutes: number;
  tackles: number;
  recoveries: number;
  cbi: number;
  yellowCards: number;
  redCards: number;
}

export interface DefconWindow {
  gws: number[];
  rows: Map<number, DefconWindowRow>;
}

/**
 * Defensive contributions across a window, with real threshold hits.
 *
 * The season total alone cannot tell you how often somebody actually cleared
 * the line — ninety contributions could be nine good games or eighteen
 * mediocre ones, and only the former scores. Reading the weeks gives the
 * measured count instead of the estimate.
 */
export async function buildDefconWindow(
  currentGw: number,
  weeks: number,
  thresholdFor: (pos: number) => number,
  posOf: (element: number) => number,
): Promise<DefconWindow> {
  const span = Math.max(1, Math.min(MAX_WINDOW, weeks));
  const wanted: number[] = [];
  for (let gw = currentGw; gw > currentGw - span && gw >= 1; gw--) wanted.push(gw);
  wanted.reverse();

  const settled = await Promise.allSettled(wanted.map((gw) => getLive(gw)));
  const rows = new Map<number, DefconWindowRow>();
  const gws: number[] = [];

  settled.forEach((res, i) => {
    if (res.status !== "fulfilled") return;
    gws.push(wanted[i]);
    for (const el of res.value.elements) {
      const s = el.stats;
      if (s.minutes <= 0) continue;
      const row =
        rows.get(el.id) ??
        {
          element: el.id,
          defcon: 0,
          hits: 0,
          appearances: 0,
          minutes: 0,
          tackles: 0,
          recoveries: 0,
          cbi: 0,
          yellowCards: 0,
          redCards: 0,
        };
      row.appearances++;
      row.minutes += s.minutes;
      row.defcon += s.defensive_contribution;
      row.tackles += s.tackles;
      row.recoveries += s.recoveries;
      row.cbi += s.clearances_blocks_interceptions;
      row.yellowCards += s.yellow_cards;
      row.redCards += s.red_cards;
      if (s.defensive_contribution >= thresholdFor(posOf(el.id))) row.hits++;
      rows.set(el.id, row);
    }
  });

  return { gws, rows };
}
