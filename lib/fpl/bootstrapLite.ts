import { getBootstrap } from "@/lib/fpl/endpoints";
import { cached } from "@/lib/cache/swr";
import type { Bootstrap } from "@/lib/fpl/schemas";
import type { FplElement, FplTeam, FplElementType, FplEvent } from "@/lib/fpl/schemas";

export interface ElementLite {
  id: number;
  web_name: string;
  element_type: number;
  team: number;
  team_code: number;
  now_cost: number;
  status: FplElement["status"];
  news: string;
  chance_of_playing_this_round: number | null;
  chance_of_playing_next_round: number | null;
  selected_by_percent: number;
  form: number;
  ep_next: number | null;
  photo: string;
  code: number;
  minutes: number;
  xg90: number | null;
  xa90: number | null;
  ppg: number;
  total_points: number;
  event_points: number;
  goals_scored: number;
  assists: number;
  bonus: number;
  bps: number;
  transfersInEvent: number;
  transfersOutEvent: number;
}

export interface BootstrapLite {
  events: FplEvent[];
  teams: FplTeam[];
  elementTypes: FplElementType[];
  elements: Record<number, ElementLite>;
  scoring: Record<string, unknown> | null;
  chips: Bootstrap["chips"];
  totalPlayers: number;
}

function shrink(x: number | null, nMinutes: number, prior: number, k = 180): number | null {
  if (x === null || !Number.isFinite(x)) return null;
  if (nMinutes <= 0) return prior;
  const per90 = (x / nMinutes) * 90;
  return (nMinutes * per90 + k * prior) / (nMinutes + k);
}

export const getBootstrapLite = () =>
  cached<BootstrapLite>("gaffer:bootstrap-lite", 300, async () => {
    const boot = await getBootstrap();
    const scoringRaw = (boot.game_config as { scoring?: Record<string, unknown> }).scoring ?? null;

    const elements: Record<number, ElementLite> = {};
    for (const el of boot.elements) {
      elements[el.id] = {
        id: el.id,
        web_name: el.web_name,
        element_type: el.element_type,
        team: el.team,
        team_code: el.team_code,
        now_cost: el.now_cost,
        status: el.status,
        news: el.news,
        chance_of_playing_this_round: el.chance_of_playing_this_round,
        chance_of_playing_next_round: el.chance_of_playing_next_round,
        selected_by_percent: el.selected_by_percent,
        form: el.form,
        ep_next: typeof el.ep_next === "number" ? el.ep_next : null,
        photo: el.photo,
        code: el.code,
        minutes: el.minutes,
        xg90: shrink(el.expected_goals, el.minutes, 0.15),
        xa90: shrink(el.expected_assists, el.minutes, 0.12),
        ppg: el.points_per_game,
        total_points: el.total_points,
        event_points: el.event_points,
        goals_scored: el.goals_scored,
        assists: el.assists,
        bonus: el.bonus,
        bps: el.bps,
        transfersInEvent: el.transfers_in_event,
        transfersOutEvent: el.transfers_out_event,
      };
    }

    return {
      events: boot.events,
      teams: boot.teams,
      elementTypes: boot.element_types,
      elements,
      scoring: scoringRaw,
      chips: boot.chips,
      totalPlayers: boot.total_players,
    };
  });
