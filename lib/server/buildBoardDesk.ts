import "server-only";

/**
 * Shared fixture-and-transfer helpers.
 *
 * The Board's heat grid and the Planner both need the same three things: what
 * the calendar looks like over a horizon, what a player projects to score in
 * it, and how many free transfers you actually have. They live here so the two
 * screens can never disagree.
 */
import { getHistory } from "@/lib/fpl/endpoints";
import type { Fixture } from "@/lib/fpl/schemas";
import { buildFixtureModel } from "@/lib/engines/fixtureModel";
import { availabilityOf, blendBase, projectHorizon } from "@/lib/engines/solverLite";
import { ranksPerPoint as ranksPerPointAt } from "@/lib/engines/rankModel";
import { getRankCurveBundle } from "@/lib/server/rankCurveServer";

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

export interface GwMarker {
  kind: "double" | "blank";
  detail: string;
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
  fixtures: Fixture[],
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
