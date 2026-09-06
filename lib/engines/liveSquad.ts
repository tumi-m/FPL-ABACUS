import type { Fixture, Live, PicksResponse } from "@/lib/fpl/schemas";
import { parseChip } from "@/lib/fpl/schemas";
import type { BootstrapLite } from "@/lib/fpl/bootstrapLite";
import { provisionalBonusByFixture } from "@/lib/engines/bonus";
import { effectiveMultipliers, projectAutoSubs } from "@/lib/engines/autosubs";
import { DEFCON_THRESHOLD } from "@/lib/engines/types";
import type { Chip, LivePlayer, LiveStatsLite, Multiplier, Pick, Pos } from "@/lib/engines/types";

export interface LiveSquad {
  players: Map<number, LivePlayer>;
  finalXI: Pick[];
  bench: Pick[];
  subs: { out: number; in: number }[];
  captainId: number;
  multipliers: Map<number, Multiplier>;
  gwPoints: number;
  benchPoints: number;
  chip: Chip;
}

function liteStats(stats: Live["elements"][number]["stats"]): LiveStatsLite {
  return {
    bps: stats.bps,
    saves: stats.saves,
    goalsScored: stats.goals_scored,
    assists: stats.assists,
    cleanSheets: stats.clean_sheets,
    conceded: stats.goals_conceded,
    ownGoals: stats.own_goals,
    penMissed: stats.penalties_missed,
    cards: stats.yellow_cards + stats.red_cards,
    yellowCards: stats.yellow_cards,
    redCards: stats.red_cards,
    xg: stats.expected_goals,
    xa: stats.expected_assists,
    xgc: stats.expected_goals_conceded,
  };
}

/**
 * A player's live points, per fixture.
 *
 * `explain` is FPL's own breakdown and is keyed by fixture, so it is the
 * authority on which match earned what. Two things can still leave it short
 * of `total_points`: a scoring rule the feed folds in without an explain
 * line, and a mid-round correction. The residual is put on the player's last
 * fixture rather than dropped, because a scoreboard that quietly loses a
 * point is worse than one that attributes it a match late — and the total is
 * a number the manager can check against their own FPL page.
 *
 * Provisional bonus is added to the fixture whose bps race produced it. It is
 * skipped entirely once the feed reports official bonus, exactly as the
 * caller's `provBonus` is, because official bonus is already inside
 * `total_points` and would otherwise be counted twice.
 */
function splitByFixture(
  el: Live["elements"][number],
  fixtureIds: number[],
  provisionalByFixture: Map<number, Map<number, number>>,
  provBonus: number,
): Map<number, number> {
  const out = new Map<number, number>();
  if (fixtureIds.length === 0) return out;

  let explained = 0;
  for (const entry of el.explain) {
    let points = 0;
    for (const stat of entry.stats) points += stat.points;
    if (points === 0) continue;
    out.set(entry.fixture, (out.get(entry.fixture) ?? 0) + points);
    explained += points;
  }

  const residual = el.stats.total_points - explained;
  if (residual !== 0) {
    const last = fixtureIds[fixtureIds.length - 1];
    out.set(last, (out.get(last) ?? 0) + residual);
  }

  if (provBonus > 0) {
    for (const id of fixtureIds) {
      const b = provisionalByFixture.get(id)?.get(el.id) ?? 0;
      if (b > 0) out.set(id, (out.get(id) ?? 0) + b);
    }
  }

  return out;
}

export function buildLiveSquad(input: {
  picks: PicksResponse;
  live: Live;
  fixtures: Fixture[];
  boot: BootstrapLite;
  bonusAddedDays?: Set<string>;
}): LiveSquad {
  const { picks, live, fixtures, boot } = input;
  const provisionalByFixture = provisionalBonusByFixture(fixtures, input.bonusAddedDays ?? new Set());
  const provisional = new Map<number, number>();
  for (const byElement of provisionalByFixture.values()) {
    for (const [el, b] of byElement) provisional.set(el, (provisional.get(el) ?? 0) + b);
  }

  const players = new Map<number, LivePlayer>();

  for (const el of live.elements) {
    const meta = boot.elements[el.id];
    if (!meta) continue;
    // Never double-count: once the API reports official bonus it is inside total_points.
    const provBonus = el.stats.bonus > 0 ? 0 : (provisional.get(el.id) ?? 0);
    const bonusOfficial = el.stats.bonus > 0;

    const teamFixtures = fixtures.filter((f) => f.team_h === meta.team || f.team_a === meta.team);
    const pos = meta.element_type as Pos;
    const threshold = DEFCON_THRESHOLD[pos];
    const fixtureIds = teamFixtures.map((f) => f.id);

    players.set(el.id, {
      id: el.id,
      pos,
      teamId: meta.team,
      webName: meta.web_name,
      minutes: el.stats.minutes,
      basePoints: el.stats.total_points,
      provisionalBonus: provBonus,
      livePoints: el.stats.total_points + provBonus,
      bonus: bonusOfficial ? el.stats.bonus : provBonus,
      bonusOfficial,
      fixtureIds,
      pointsByFixture: splitByFixture(el, fixtureIds, provisionalByFixture, provBonus),
      played: el.stats.minutes > 0,
      fixturesFinished:
        teamFixtures.length > 0 && teamFixtures.every((f) => f.finished_provisional),
      defcon: {
        count: el.stats.defensive_contribution,
        threshold,
        hit: threshold < 99 && el.stats.defensive_contribution >= threshold,
      },
      stats: liteStats(el.stats),
    });
  }

  const chip = parseChip(picks.active_chip);
  const minPlay = {} as Record<Pos, number>;
  for (const t of boot.elementTypes) minPlay[t.id as Pos] = t.squad_min_play;

  const pickList: Pick[] = picks.picks.map((p) => ({
    element: p.element,
    position: p.position,
    multiplier: p.multiplier as Multiplier,
    isCaptain: p.is_captain,
    isViceCaptain: p.is_vice_captain,
  }));

  const subsResult = projectAutoSubs(pickList, players, minPlay, chip);
  const multipliers = effectiveMultipliers(pickList, subsResult, chip);

  const finalXI = subsResult.finalXI.filter((p) => (multipliers.get(p.element) ?? 0) > 0);
  const bench = pickList.filter((p) => p.position >= 12 && !subsResult.subs.some((s) => s.in === p.element));

  let gwPoints = 0;
  for (const [element, mult] of multipliers) {
    if (mult === 0) continue;
    const player = players.get(element);
    if (player) gwPoints += player.livePoints * mult;
  }
  gwPoints -= picks.entry_history.event_transfers_cost;

  let benchPoints = 0;
  for (const b of bench) {
    if (multipliers.get(b.element) !== 0) continue;
    if (subsResult.subs.some((s) => s.out === b.element)) continue;
    const player = players.get(b.element);
    if (player && chip === "bboost") continue;
    if (player) benchPoints += player.livePoints;
  }

  return {
    players,
    finalXI,
    bench,
    subs: subsResult.subs,
    captainId: subsResult.captainId,
    multipliers,
    gwPoints,
    benchPoints,
    chip,
  };
}
