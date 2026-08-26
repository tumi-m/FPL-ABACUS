import "server-only";

/**
 * Server composition for the club boards.
 *
 * Two upstream reads — the bootstrap and the season fixture list — both of
 * which every other page already warms, so this page is cheap despite carrying
 * six tables. Your own squad is an enhancement on top: it decides which clubs
 * get a "you own someone here" mark, and it is deadlined, because a board of
 * league-wide numbers is worth reading whether or not we could reach your
 * picks in time.
 */
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixturesAll, getPicks } from "@/lib/fpl/endpoints";
import { buildTeamStats, type StatPlayer, type TeamStatRow } from "@/lib/engines/teamStats";
import { withDeadline, ENHANCEMENT_MS } from "@/lib/server/deadline";

export interface TeamStatsPage {
  gw: number;
  rows: TeamStatRow[];
  /** Club ids you hold a player from. Empty when there is no team, or when
   *  the picks read missed its deadline. */
  owned: number[];
  /** Finished matches behind the numbers — the sample the whole page rests on. */
  played: number;
}

export async function buildTeamStatsPage(teamId: number | null): Promise<TeamStatsPage> {
  const [boot, fixtures] = await Promise.all([getBootstrapLite(), getFixturesAll()]);

  const currentGw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);

  // Players who have left the league still carry a season, and it belongs to
  // the club they played it for — dropping them would understate the totals.
  const players: StatPlayer[] = Object.values(boot.elements);

  const rows = buildTeamStats({
    teams: boot.teams,
    players,
    fixtures,
    upToGw: currentGw,
  });

  const owned = teamId
    ? await withDeadline(ownedClubs(teamId, currentGw), ENHANCEMENT_MS, [])
    : [];

  return {
    gw: currentGw,
    rows,
    owned,
    played: Math.max(0, ...rows.map((r) => r.played)),
  };
}

async function ownedClubs(teamId: number, gw: number): Promise<number[]> {
  const boot = await getBootstrapLite();
  const picks = await getPicks(teamId, gw, true);
  const clubs = new Set<number>();
  for (const p of picks.picks) {
    const el = boot.elements[p.element];
    if (el) clubs.add(el.team);
  }
  return [...clubs];
}
