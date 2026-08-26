import "server-only";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getEntry, getEventStatus, getFixtures, getFixturesAll, getLive, getPicks } from "@/lib/fpl/endpoints";
import { bonusAddedDays } from "@/lib/engines/matchState";
import { buildLiveSquad } from "@/lib/engines/liveSquad";
import { buildFixtureModel, projectFixture } from "@/lib/engines/fixtureModel";
import type { SquadRow } from "@/lib/engines/matchdayModel";
import type { Fixture } from "@/lib/fpl/schemas";
import { readAvailability } from "@/lib/engines/availability";
import { FplHttpError } from "@/lib/fpl/client";

/**
 * v4-E rival compare — the rival's gameweek run through the same live-squad
 * engine as your own: real points, projected auto-subs, provisional bonus.
 * Rows are SquadRow-shaped so the Field renders them with the same token.
 */
export interface RivalSquadPayload {
  ok: true;
  entry: number;
  gw: number;
  teamName: string | null;
  rows: SquadRow[];
  totals: { gw: number; bench: number };
  subs: { out: number; in: number }[];
}

/**
 * Why a compare came back empty. The three are different problems with
 * different fixes, and telling a user "no picks visible" when FPL timed out
 * sends them hunting for a fault in their rival's team that is not there.
 */
export type RivalFailure = "picks-not-set" | "no-such-entry" | "no-gameweek" | "upstream";

export type RivalSquadResult =
  | RivalSquadPayload
  | { ok: false; reason: RivalFailure; entry: number; gw: number | null };

export async function buildRivalSquad(entryId: number, gw?: number): Promise<RivalSquadResult> {
  const boot = await getBootstrapLite();
  const event =
    (gw != null ? boot.events.find((e) => e.id === gw) : undefined) ??
    boot.events.find((e) => e.is_current) ??
    boot.events.find((e) => e.is_next);
  if (!event) return { ok: false, reason: "no-gameweek", entry: entryId, gw: gw ?? null };
  const eventId = event.id;

  let picks: Awaited<ReturnType<typeof getPicks>>;
  try {
    picks = await getPicks(entryId, eventId, true);
  } catch (err) {
    return { ...(await diagnose(err, entryId)), entry: entryId, gw: eventId };
  }

  const [fixtures, allFixtures, live, status, entry] = await Promise.all([
    getFixtures(eventId).catch(() => [] as Fixture[]),
    getFixturesAll().catch(() => [] as Fixture[]),
    getLive(eventId),
    getEventStatus().catch(() => null),
    getEntry(entryId).catch(() => null),
  ]);
  const addedDays = status ? bonusAddedDays(status, eventId) : new Set<string>();

  const squadState = buildLiveSquad({ picks, live, fixtures, boot, bonusAddedDays: addedDays });
  const teamById = new Map(boot.teams.map((t) => [t.id, t]));
  const fxModel = buildFixtureModel(allFixtures.length ? allFixtures : fixtures, { upToGw: eventId });

  const rows: SquadRow[] = picks.picks.map((p) => {
    const player = squadState.players.get(p.element);
    const meta = boot.elements[p.element];
    const subbedIn = squadState.subs.find((s) => s.in === p.element);
    const teamFixtures = meta
      ? fixtures.filter((f) => f.team_h === meta.team || f.team_a === meta.team)
      : [];
    const fx = teamFixtures[0];
    const oppId = fx ? (fx.team_h === meta?.team ? fx.team_a : fx.team_h) : null;
    const isHome = fx ? fx.team_h === meta?.team : true;
    let state: SquadRow["fixtureState"] = "pre";
    if (fx) {
      if (fx.finished_provisional || fx.finished) state = "done";
      else if (fx.started) state = "live";
    }
    return {
      element: p.element,
      webName: meta?.web_name ?? `#${p.element}`,
      pos: (meta?.element_type ?? 4) as SquadRow["pos"],
      teamShort: teamById.get(meta?.team ?? 0)?.short_name ?? "",
      teamCode: meta?.team_code ?? 0,
      multiplier: squadState.multipliers.get(p.element) ?? p.multiplier,
      isCaptain: p.is_captain,
      isVice: p.is_vice_captain,
      onBench: p.position >= 12 && !subbedIn,
      minutes: player?.minutes ?? 0,
      livePoints: player?.livePoints ?? 0,
      provisionalBonus: player?.provisionalBonus ?? 0,
      bonus: player?.bonus ?? 0,
      bonusOfficial: player?.bonusOfficial ?? false,
      defconCount: player?.defcon.count ?? 0,
      defconThreshold: player?.defcon.threshold ?? 99,
      fixtureId: fx?.id ?? null,
      opponentShort: oppId ? `${isHome ? "" : "@"}${teamById.get(oppId)?.short_name ?? ""}` : "—",
      fixtureState: state,
      fixtureMinute: fx?.minutes ?? 0,
      subbedInFor: subbedIn ? subbedIn.out : null,
      photo: meta?.photo ?? "",
      liveStats: player?.stats ?? null,
      availability: readAvailability({
        status: meta?.status ?? "a",
        news: meta?.news ?? "",
        chanceOfPlaying: meta?.chance_of_playing_this_round ?? null,
      }),
      season: {
        goals: meta?.goals_scored ?? 0,
        assists: meta?.assists ?? 0,
        xg: meta?.xgTotal ?? 0,
        xa: meta?.xaTotal ?? 0,
        minutes: meta?.minutes ?? 0,
        starts: meta?.starts ?? 0,
        points: meta?.total_points ?? 0,
        cost: meta?.now_cost ?? 0,
      },
      teamId: meta?.team ?? 0,
      xg90: meta?.xg90 ?? null,
      xgc90:
        meta && fx && oppId
          ? Math.round(projectFixture(fxModel, meta.team, oppId, isHome).xgAgainst * 100) / 100
          : null,
      // ownership is *your* exposure — the rival view never shows it
      eo: 0,
    };
  });

  return {
    ok: true,
    entry: entryId,
    gw: eventId,
    teamName: entry?.name ?? null,
    rows,
    totals: {
      gw: Math.round(squadState.gwPoints),
      bench: Math.round(squadState.benchPoints),
    },
    subs: squadState.subs,
  };
}

/**
 * Read a failed picks fetch.
 *
 * FPL answers 404 for two different things — an entry id that does not exist,
 * and an entry that exists but set no side for this week — and the fix a user
 * needs is different for each: retype the number, or pick another gameweek.
 * One extra request on the failure path tells them apart. Anything that is not
 * a 404 (a 5xx, a timeout, a tripped breaker, a schema drift) is our side
 * failing, and it says so rather than blaming the rival's team.
 */
async function diagnose(err: unknown, entryId: number): Promise<{ ok: false; reason: RivalFailure }> {
  const status = err instanceof FplHttpError ? err.status : null;
  if (status !== 404) return { ok: false, reason: "upstream" };
  const entry = await getEntry(entryId).catch(() => null);
  return { ok: false, reason: entry ? "picks-not-set" : "no-such-entry" };
}
