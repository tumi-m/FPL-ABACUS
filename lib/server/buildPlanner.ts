import "server-only";

/**
 * Server composition for the transfer planner.
 *
 * One pass over the bootstrap turns every selectable player into a market row
 * carrying a projected-points horizon, and one pass over the fixture list
 * turns the calendar into per-club cells the pitch, the market table and the
 * ticker all read. Everything below is data assembly — the rules live in
 * `lib/engines/planner.ts`, the projection in `lib/engines/solverLite.ts`.
 */
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixturesAll, getHistory, getPicks } from "@/lib/fpl/endpoints";
import { buildSolverContext, computeFreeTransfers } from "@/lib/server/buildBoardDesk";
import { buildTicker } from "@/lib/engines/planner";
import type {
  PlannerClub,
  PlannerGw,
  PlannerPlayer,
  PlannerSquadSlot,
  Ticker,
} from "@/lib/engines/planner";

export type {
  PlannerClub,
  PlannerGw,
  PlannerSquadSlot,
  Ticker,
  TickerCell,
} from "@/lib/engines/planner";

export interface PlannerChip {
  key: string;
  label: string;
  /** First gameweek this chip becomes available. */
  startEvent: number;
  /** Last gameweek it can still be played. */
  stopEvent: number;
}

export interface PlannerData {
  teamId: number;
  currentGw: number;
  gws: PlannerGw[];
  /** Chips still on the table, with the set-1 wall each one expires at. */
  chips: PlannerChip[];
  /** Earliest stop_event across the chips — the hard wall, typically GW19. */
  wallGw: number | null;
  clubs: PlannerClub[];
  players: PlannerPlayer[];
  squad: PlannerSquadSlot[];
  /** club id → gw id → fixtures that week (empty array = blank). */
  ticker: Ticker;
  bankTenths: number;
  squadValueTenths: number;
  freeTransfers: number;
  /** True when the picks endpoint refused us — the planner degrades to market only. */
  squadUnavailable: boolean;
}

const HORIZON = 6;

const round1 = (v: number) => Math.round(v * 10) / 10;

export async function buildPlanner(teamId: number, weeks = HORIZON): Promise<PlannerData> {
  const boot = await getBootstrapLite();
  const currentGw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);

  // Picks, fixtures and history share nothing — one wave, not three trips.
  const [picksRes, fixturesRes, historyRes] = await Promise.allSettled([
    getPicks(teamId, currentGw, true),
    getFixturesAll(),
    getHistory(teamId),
  ]);

  const fixtures = fixturesRes.status === "fulfilled" ? fixturesRes.value : [];

  // The planning window starts at the gameweek you can still act on: once the
  // current one has kicked off, the next deadline is the one that matters.
  const upcoming = boot.events.filter((e) => e.id >= currentGw);
  const gwIds = upcoming.slice(0, weeks).map((e) => e.id);

  const clubs: PlannerClub[] = boot.teams.map((t) => ({
    id: t.id,
    code: t.short_name,
    name: t.name,
    crestCode: t.code,
  }));
  const clubById = new Map(clubs.map((c) => [c.id, c]));

  // Every club, every horizon gameweek — doubles kept as separate cells.
  const ticker = buildTicker(fixtures, clubs, gwIds);

  const gws: PlannerGw[] = gwIds.map((id) => {
    const event = boot.events.find((e) => e.id === id);
    let doubles = 0;
    let blanks = 0;
    for (const club of clubs) {
      const n = ticker[club.id][id].length;
      if (n > 1) doubles++;
      if (n === 0) blanks++;
    }
    return {
      id,
      deadline: event?.deadline_time
        ? new Date(event.deadline_time).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : "",
      doubles,
      blanks,
    };
  });

  // One fixture-model pass drives every projection on the page.
  const solver = buildSolverContext(fixtures, gwIds, currentGw);

  const players: PlannerPlayer[] = [];
  for (const el of Object.values(boot.elements)) {
    // Departed players still sit in the bootstrap; nobody can select them.
    if (el.status === "u") continue;
    players.push({
      id: el.id,
      name: el.web_name,
      pos: el.element_type,
      team: el.team,
      code: clubById.get(el.team)?.code ?? "?",
      cost: el.now_cost,
      photo: el.photo,
      form: el.form,
      ppg: el.ppg,
      points: el.total_points,
      owned: el.selected_by_percent,
      minutes: el.minutes,
      status: el.status,
      // The whole market crosses the wire, so only carry the note when there
      // is actually a doubt to explain — and never more than a tooltip's worth.
      news: el.status === "a" ? "" : el.news.slice(0, 120),
      horizon: solver
        .project({
          pos: el.element_type,
          teamId: el.team,
          epNext: el.ep_next,
          form: el.form,
          status: el.status,
          chanceOfPlaying: el.chance_of_playing_this_round,
        })
        .map(round1),
      costChangeEvent: el.costChangeEvent,
      costChangeStart: el.costChangeStart,
      netTransfers: el.transfersInEvent - el.transfersOutEvent,
    });
  }

  const squad: PlannerSquadSlot[] = [];
  let squadValueTenths = 0;
  if (picksRes.status === "fulfilled") {
    for (const p of picksRes.value.picks) {
      const sellPrice = p.selling_price ?? boot.elements[p.element]?.now_cost ?? 0;
      squadValueTenths += sellPrice;
      squad.push({
        element: p.element,
        slot: p.position,
        sellPrice,
        isCaptain: p.is_captain === true,
        isVice: p.is_vice_captain === true,
      });
    }
    squad.sort((a, b) => a.slot - b.slot);
  }

  let bankTenths = 0;
  let freeTransfers = 1;
  if (historyRes.status === "fulfilled") {
    const history = historyRes.value;
    bankTenths = history.current[history.current.length - 1]?.bank ?? 0;
    freeTransfers = computeFreeTransfers(history.current, history.chips, currentGw);
  }

  const wallGw = boot.chips.length ? Math.min(...boot.chips.map((ch) => ch.stop_event)) : null;
  const chips: PlannerChip[] = boot.chips
    .map((ch) => {
      const secondHalf = wallGw != null && ch.stop_event > wallGw;
      return {
        key: `${chipBase(ch.name, ch.number)}${secondHalf ? 2 : 1}`,
        label: `${chipLabel(ch.name)}${secondHalf ? " ②" : ""}`,
        startEvent: ch.start_event,
        stopEvent: ch.stop_event,
      };
    })
    .filter((c, i, all) => all.findIndex((x) => x.key === c.key) === i)
    .sort((a, b) => a.startEvent - b.startEvent || a.key.localeCompare(b.key));

  return {
    teamId,
    currentGw,
    gws,
    chips,
    wallGw,
    clubs,
    players,
    squad,
    ticker,
    bankTenths,
    squadValueTenths,
    freeTransfers,
    squadUnavailable: picksRes.status !== "fulfilled" || squad.length === 0,
  };
}

/**
 * FPL lists every chip twice — once for each half of the season — so the half
 * has to be part of the key, or the two Wildcards collapse into one.
 */
function chipBase(name: string, number: number): string {
  if (name === "wildcard") return "wc";
  if (name === "freehit") return "fh";
  if (name === "bboost") return "bb";
  if (name === "3xc") return "tc";
  return `c${number}`;
}

function chipLabel(name: string): string {
  switch (name) {
    case "wildcard":
      return "Wildcard";
    case "freehit":
      return "Free Hit";
    case "bboost":
      return "Bench Boost";
    case "3xc":
      return "Triple Captain";
    default:
      return name;
  }
}
