import "server-only";

/**
 * Shared builder for the BoardDesk staging component — used by the Board and
 * by the Field's Planner mode so there is one source of desk truth.
 */
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixturesAll, getHistory, getPicks } from "@/lib/fpl/endpoints";
import { buildFixtureModel } from "@/lib/engines/fixtureModel";
import { availabilityOf, blendBase, projectHorizon } from "@/lib/engines/solverLite";
import { ranksPerPoint as ranksPerPointAt } from "@/lib/engines/rankModel";
import { getRankCurveBundle } from "@/lib/server/rankCurveServer";
import type {
  DeskCandidate,
  DeskSquadRow,
  GwMarker,
} from "@/components/gaffer/board/BoardDesk";

export interface BoardDeskProps {
  teamId: number;
  squad: DeskSquadRow[];
  candidates: DeskCandidate[];
  gws: number[];
  currentGw: number;
  wallGw: number | null;
  chips: { key: string; label: string; stopEvent: number }[];
  bankTenths: number;
  /** Rolling free transfers replayed from entry history (bank cap 5). */
  freeTransfers: number;
  /** Blank/double flags per horizon GW — shown inside the chip lane cells. */
  markers?: Record<number, GwMarker>;
  /** Ranks gained per extra point at the hero's season total (null without a curve). */
  ranksPerPoint?: number | null;
}

/** Next-three fixture run label for a club, e.g. "lei(H) mun(A) —" (Board casing: the venue side is uppercase). */
export function fixtureRun(
  teamId: number,
  fixtures: { event: number | null; team_h: number; team_a: number }[],
  gws: number[],
  shortNameOf: (teamId: number) => string,
): string {
  const labels: string[] = [];
  for (const gw of gws.slice(0, 3)) {
    const fx = fixtures.find((f) => f.event === gw && (f.team_h === teamId || f.team_a === teamId));
    if (!fx) {
      labels.push("—");
      continue;
    }
    const home = fx.team_h === teamId;
    const opp = shortNameOf(home ? fx.team_a : fx.team_h);
    labels.push(`${home ? opp.toLowerCase() : opp.toUpperCase()}${home ? "(H)" : "(A)"}`);
  }
  return labels.join(" ");
}

export interface GwProfile {
  id: number;
  /** Club-fixture count that GW (10 is a full slate). */
  fixtures: number;
  /** Clubs playing more than once. */
  doubles: number;
  /** Clubs without a fixture. */
  byes: number;
}

/** Fixture calendar profile per horizon GW — blanks and doubles in one pass. */
export function computeGwProfiles(
  fixtures: { event: number | null; team_h: number; team_a: number }[],
  gws: number[],
  teamCount = 20,
): GwProfile[] {
  return gws.map((gw) => {
    const apps = new Map<number, number>();
    for (const f of fixtures) {
      if (f.event !== gw) continue;
      apps.set(f.team_h, (apps.get(f.team_h) ?? 0) + 1);
      apps.set(f.team_a, (apps.get(f.team_a) ?? 0) + 1);
    }
    let fixtureCount = 0;
    let doubles = 0;
    for (const n of apps.values()) {
      fixtureCount += n;
      if (n > 1) doubles += 1;
    }
    return { id: gw, fixtures: fixtureCount, doubles, byes: Math.max(0, teamCount - apps.size) };
  });
}

export function gwMarker(p: GwProfile): GwMarker | null {
  if (p.doubles > 0) {
    return {
      kind: "double",
      detail: `Double gameweek — ${p.doubles} club${p.doubles === 1 ? "" : "s"} play twice`,
    };
  }
  if (p.byes > 0) {
    return {
      kind: "blank",
      detail: `Blank gameweek — ${p.byes} club${p.byes === 1 ? "" : "s"} without a fixture`,
    };
  }
  return null;
}

export function markerMap(profiles: GwProfile[]): Record<number, GwMarker> {
  const markers: Record<number, GwMarker> = {};
  for (const p of profiles) {
    const m = gwMarker(p);
    if (m) markers[p.id] = m;
  }
  return markers;
}

/**
 * Shared solver-lite context — one fixture-model pass feeding per-player
 * horizon projections for every squad row and candidate. Doubles stack,
 * blanks are zero.
 */
export function buildSolverContext(
  fixtures: Awaited<ReturnType<typeof getFixturesAll>>,
  gws: number[],
  upToGw: number,
): {
  project: (p: {
    pos: number;
    teamId: number;
    epNext: number | null;
    form: number;
    status: string;
    chanceOfPlaying: number | null;
  }) => number[];
} {
  const model = buildFixtureModel(fixtures, { upToGw });
  const lookup = new Map<string, { opponentId: number; wasHome: boolean }[]>();
  const gwSet = new Set(gws);
  for (const f of fixtures) {
    if (f.event == null || !gwSet.has(f.event)) continue;
    const keyH = `${f.team_h}-${f.event}`;
    const keyA = `${f.team_a}-${f.event}`;
    lookup.set(keyH, [...(lookup.get(keyH) ?? []), { opponentId: f.team_a, wasHome: true }]);
    lookup.set(keyA, [...(lookup.get(keyA) ?? []), { opponentId: f.team_h, wasHome: false }]);
  }
  return {
    project: (p) =>
      projectHorizon(
        {
          pos: p.pos,
          teamId: p.teamId,
          base: blendBase(p.epNext, p.form),
          availability: availabilityOf(p.status, p.chanceOfPlaying),
        },
        gws,
        model,
        (teamId, gw) => lookup.get(`${teamId}-${gw}`) ?? [],
      ),
  };
}

/** Ranks gained per extra point at the hero's season total — null without a curve. */
export async function rankPrice(teamId: number, currentGw: number): Promise<number | null> {
  try {
    const [bundle, history] = await Promise.all([
      getRankCurveBundle(currentGw),
      getHistory(teamId),
    ]);
    const total = history.current[history.current.length - 1]?.total_points;
    if (!bundle.curve || total == null) return null;
    return ranksPerPointAt(bundle.curve, total);
  } catch {
    return null;
  }
}

/**
 * Rolling free transfers replayed from season history — FPL's actual rule:
 * start on 1, gain one per gameweek, spend what you used, bank up to 5,
 * reset to 1 after a Wildcard or Free Hit.
 */
export function computeFreeTransfers(
  current: { event: number; event_transfers: number }[],
  chipsUsed: { name: string; event: number }[],
  currentGw: number,
): number {
  let ft = 1;
  for (const row of [...current].sort((a, b) => a.event - b.event)) {
    if (row.event >= currentGw) break;
    const reset = chipsUsed.some((c) => c.event === row.event && /wildcard|freehit/i.test(c.name));
    ft = reset ? 1 : Math.min(5, Math.max(0, ft - row.event_transfers + 1));
  }
  return ft;
}

export async function buildBoardDesk(
  teamId: number,
  opts: { fixtures?: Awaited<ReturnType<typeof getFixturesAll>> } = {},
): Promise<BoardDeskProps | null> {
  const boot = await getBootstrapLite();
  const currentGw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);

  let squadIds: number[] = [];
  const sellPrices = new Map<number, number>();
  try {
    const picks = await getPicks(teamId, currentGw, true);
    squadIds = picks.picks.map((p) => p.element);
    for (const p of picks.picks) {
      if (p.selling_price != null) sellPrices.set(p.element, p.selling_price);
    }
  } catch {
    return null;
  }

  const workRows = squadIds
    .map((id) => boot.elements[id])
    .filter((el): el is NonNullable<typeof el> => el != null);

  const squadSet = new Set(squadIds);
  const deskSquad: DeskSquadRow[] = workRows.map((el) => ({
    element: el.id,
    webName: el.web_name,
    pos: el.element_type,
    nowCost: el.now_cost,
    sellPrice: sellPrices.get(el.id) ?? null,
    epNext: el.ep_next,
    photo: el.photo,
  }));
  const candidates: DeskCandidate[] = Object.values(boot.elements)
    .filter((e) => !squadSet.has(e.id))
    .sort((a, b) => b.total_points - a.total_points)
    .slice(0, 50)
    .map((e) => ({
      id: e.id,
      webName: e.web_name,
      pos: e.element_type,
      nowCost: e.now_cost,
      epNext: e.ep_next,
      photo: e.photo,
    }));

  let bankTenths = 0;
  let freeTransfers = 1;
  try {
    const history = await getHistory(teamId);
    bankTenths = history.current[history.current.length - 1]?.bank ?? 0;
    freeTransfers = computeFreeTransfers(history.current, history.chips, currentGw);
  } catch {
    bankTenths = 0;
  }

  const allFixtures = opts.fixtures ?? (await getFixturesAll().catch(() => []));
  const horizonGws = boot.events.filter((e) => e.id >= currentGw).slice(0, 6);
  const horizonIds = horizonGws.map((g) => g.id);
  const shortOf = (id: number) => boot.teams.find((t) => t.id === id)?.short_name ?? "?";
  const runFor = (clubId: number) => fixtureRun(clubId, allFixtures, horizonIds, shortOf);
  const markers = markerMap(computeGwProfiles(allFixtures, horizonIds));

  const wallGw = boot.chips.length ? Math.min(...boot.chips.map((ch) => ch.stop_event)) : null;

  // Horizon: current GW + next 5, matching the Field's planning frame.
  const gws = horizonGws.map((g) => g.id);
  const solver = buildSolverContext(allFixtures, gws, currentGw);
  const project = (el: { element_type: number; team: number; ep_next: number | null; form: number; status: string; chance_of_playing_this_round: number | null }) =>
    solver.project({
      pos: el.element_type,
      teamId: el.team,
      epNext: el.ep_next,
      form: el.form,
      status: el.status,
      chanceOfPlaying: el.chance_of_playing_this_round,
    });

  return {
    teamId,
    squad: deskSquad
      .map((s) => ({
        ...s,
        runLabel: runFor(squadClubId(s.element, boot)),
        horizon: project(boot.elements[s.element]!),
      })),
    candidates: candidates.map((c) => ({
      ...c,
      runLabel: runFor(squadClubId(c.id, boot)),
      horizon: project(boot.elements[c.id]!),
    })),
    gws,
    currentGw,
    wallGw,
    chips: boot.chips
      .map((ch) => ({ key: chipKey(ch.name, ch.number), label: chipLabel(ch.name), stopEvent: ch.stop_event }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    bankTenths,
    freeTransfers,
    markers,
    ranksPerPoint: await rankPrice(teamId, currentGw),
  };
}

function squadClubId(elementId: number, boot: Awaited<ReturnType<typeof getBootstrapLite>>): number {
  return boot.elements[elementId]?.team ?? 0;
}

function chipKey(name: string, number: number): string {
  if (name === "wildcard") return number === 1 ? "wc1" : "wc2";
  if (name === "freehit") return "fh";
  if (name === "bboost") return "bb";
  return `chip-${number}`;
}

function chipLabel(name: string): string {
  switch (name) {
    case "wildcard":
      return "Wildcard";
    case "freehit":
      return "Free Hit";
    case "bboost":
      return "Bench Boost";
    default:
      return name;
  }
}
