import { getBootstrap } from "@/lib/fpl/endpoints";
import { cached } from "@/lib/cache/swr";
import { sampleWeight } from "@/lib/engines/performance";
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
  /** Tenths the price has moved this gameweek and across the season. */
  costChangeEvent: number;
  costChangeStart: number;
  /** Season totals for the Top performers board (raw, unrated). */
  xgTotal: number;
  xaTotal: number;
  xgcTotal: number;
  /** Expected goal involvements — FPL publishes it, so we do not re-derive it. */
  xgiTotal: number;
  /** This gameweek's published expectation, the "projected" side of the
   *  actual-vs-projected read. */
  ep_this: number | null;

  /* ── Season actuals. Everything the over/underperformance work needs comes
        from one bootstrap read; no per-player summary fetches. ── */
  cleanSheets: number;
  goalsConceded: number;
  ownGoals: number;
  saves: number;
  pensSaved: number;
  pensMissed: number;
  yellowCards: number;
  redCards: number;
  starts: number;
  /**
   * Where he stands in the dead-ball queue — the lower of his corner and
   * direct free-kick order, or null when FPL says nothing. 1 is first choice.
   */
  deadBall: number | null;
  /** Defensive contributions — the DEFCON stat FPL scores from 2025/26. */
  defcon: number;
  tackles: number;
  recoveries: number;
  /** Clearances, blocks and interceptions. */
  cbi: number;

  /*
   * FPL's own indices. They are the closest thing the public API has to the
   * chance-creation and shot-volume columns other sites buy from Opta —
   * creativity is built from chances created and passes into the box, threat
   * from shot volume and quality. Not the same numbers, and never presented as
   * them, but they answer the same question from data everybody can check.
   */
  influence: number;
  creativity: number;
  threat: number;
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

/** The more senior of two set-piece duties; null when he takes neither. */
function bestOrder(a: number | null | undefined, b: number | null | undefined): number | null {
  const orders = [a, b].filter((n): n is number => typeof n === "number" && n > 0);
  return orders.length ? Math.min(...orders) : null;
}

/**
 * Per-90 with the canonical shrinkage (lib/engines/performance.ts).
 *
 * The rate boards and the Field's season lines must rank the same players by
 * the same maths, so the shrinkage half-weight is the one constant:
 * `SHRINK_HALF_MINUTES`. A per-90 with no observed minutes falls to the prior
 * scaled by the zero-minute weight (zero) — a player who has not played has
 * no rate.
 */
function shrink(x: number | null, nMinutes: number, prior: number): number | null {
  if (x === null || !Number.isFinite(x)) return null;
  if (nMinutes <= 0) return prior * sampleWeight(0);
  const per90 = (x / nMinutes) * 90;
  return per90 * sampleWeight(nMinutes) + prior * (1 - sampleWeight(nMinutes));
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
        costChangeEvent: el.cost_change_event,
        costChangeStart: el.cost_change_start,
        influence: el.influence,
        creativity: el.creativity,
        threat: el.threat,
        xgTotal: el.expected_goals,
        xaTotal: el.expected_assists,
        xgcTotal: el.expected_goals_conceded,
        xgiTotal: el.expected_goal_involvements,
        ep_this: typeof el.ep_this === "number" ? el.ep_this : null,
        cleanSheets: el.clean_sheets,
        goalsConceded: el.goals_conceded,
        ownGoals: el.own_goals,
        saves: el.saves,
        pensSaved: el.penalties_saved,
        pensMissed: el.penalties_missed,
        yellowCards: el.yellow_cards,
        redCards: el.red_cards,
        starts: el.starts,
        deadBall: bestOrder(
          el.corners_and_indirect_freekicks_order,
          el.direct_freekicks_order,
        ),
        defcon: el.defensive_contribution,
        tackles: el.tackles,
        recoveries: el.recoveries,
        cbi: el.clearances_blocks_interceptions,
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
