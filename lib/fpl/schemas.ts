import { z } from "zod";

const num = z.coerce.number();
const numOrNull = z.union([z.coerce.number(), z.null()]);

/* ─────────────────────────────  bootstrap-static  ───────────────────────── */

export const zEvent = z.object({
  id: z.number(),
  name: z.string(),
  deadline_time: z.string(),
  release_time: z.string().nullable().optional(),
  average_entry_score: z.number(),
  finished: z.boolean(),
  data_checked: z.boolean(),
  highest_scoring_entry: z.number().nullable(),
  deadline_time_epoch: z.number(),
  highest_score: z.number().nullable(),
  is_previous: z.boolean(),
  is_current: z.boolean(),
  is_next: z.boolean(),
  cup_leagues_created: z.boolean(),
  h2h_ko_matches_created: z.boolean(),
  ranked_count: z.number().optional(),
  chip_plays: z.array(z.object({ chip_name: z.string(), num_played: z.number() })),
  most_selected: z.number().nullable(),
  most_transferred_in: z.number().nullable(),
  top_element: z.number().nullable(),
  top_element_info: z.object({ id: z.number(), points: z.number() }).nullable(),
  transfers_made: z.number(),
  most_captained: z.number().nullable(),
  most_vice_captained: z.number().nullable(),
});

export const zTeam = z.object({
  id: z.number(),
  code: z.number(),
  name: z.string(),
  short_name: z.string(),
  strength: z.number().nullable(),
  strength_overall_home: z.number(),
  strength_overall_away: z.number(),
  strength_attack_home: z.number(),
  strength_attack_away: z.number(),
  strength_defence_home: z.number(),
  strength_defence_away: z.number(),
  played: z.number(),
  win: z.number(),
  draw: z.number(),
  loss: z.number(),
  points: z.number(),
  position: z.number(),
  pulse_id: z.number(),
});

export const zElementType = z.object({
  id: z.number(),
  singular_name: z.string(),
  singular_name_short: z.string(),
  plural_name: z.string(),
  plural_name_short: z.string(),
  squad_select: z.number(),
  squad_min_play: z.number(),
  squad_max_play: z.number(),
  element_count: z.number(),
});

export const zElement = z.object({
  id: z.number(),
  code: z.number(),
  first_name: z.string(),
  second_name: z.string(),
  web_name: z.string(),
  team: z.number(),
  team_code: z.number(),
  element_type: z.number(),
  status: z.enum(["a", "d", "i", "s", "u", "n"]),
  news: z.string(),
  news_added: z.string().nullable(),
  chance_of_playing_this_round: z.number().nullable(),
  chance_of_playing_next_round: z.number().nullable(),
  now_cost: z.number(),
  cost_change_event: z.number(),
  cost_change_event_fall: z.number(),
  cost_change_start: z.number(),
  cost_change_start_fall: z.number(),
  selected_by_percent: num,
  form: num,
  points_per_game: num,
  total_points: z.number(),
  event_points: z.number(),
  transfers_in: z.number(),
  transfers_out: z.number(),
  transfers_in_event: z.number(),
  transfers_out_event: z.number(),
  minutes: z.number(),
  starts: z.number(),
  goals_scored: z.number(),
  assists: z.number(),
  clean_sheets: z.number(),
  goals_conceded: z.number(),
  own_goals: z.number(),
  penalties_saved: z.number(),
  penalties_missed: z.number(),
  yellow_cards: z.number(),
  red_cards: z.number(),
  saves: z.number(),
  bonus: z.number(),
  bps: z.number(),
  clearances_blocks_interceptions: z.number(),
  recoveries: z.number(),
  tackles: z.number(),
  defensive_contribution: z.number(),
  influence: num,
  creativity: num,
  threat: num,
  ict_index: num,
  expected_goals: num,
  expected_assists: num,
  expected_goal_involvements: num,
  expected_goals_conceded: num,
  expected_goals_per_90: num.optional(),
  expected_assists_per_90: num.optional(),
  saves_per_90: num.optional(),
  clean_sheets_per_90: num.optional(),
  defensive_contribution_per_90: num.optional(),
  dreamteam_count: z.number(),
  in_dreamteam: z.boolean(),
  ep_this: numOrNull,
  ep_next: numOrNull,
  photo: z.string(),
  /* Set-piece duty. FPL publishes who takes them but never splits a player's
     expected assists by how the chance began, so this is the only dead-ball
     signal available. Optional throughout: the fields are absent from some
     recordings and were absent from the API entirely before 2022. */
  corners_and_indirect_freekicks_order: z.number().nullable().optional(),
  direct_freekicks_order: z.number().nullable().optional(),
  penalties_order: z.number().nullable().optional(),
  can_transact: z.boolean().optional(),
  can_select: z.boolean().optional(),
  price_change_percent: num.optional(),
});

export const zChip = z.object({
  id: z.number(),
  name: z.string(),
  number: z.number(),
  start_event: z.number(),
  stop_event: z.number(),
  chip_type: z.enum(["transfer", "team"]),
});

export const zBootstrap = z.object({
  events: z.array(zEvent),
  teams: z.array(zTeam),
  elements: z.array(zElement),
  element_types: z.array(zElementType),
  element_stats: z.array(z.object({ label: z.string(), name: z.string() })),
  chips: z.array(zChip),
  phases: z.array(
    z.object({ id: z.number(), name: z.string(), start_event: z.number(), stop_event: z.number() }),
  ),
  total_players: z.number(),
  game_settings: z.record(z.unknown()),
  game_config: z.record(z.unknown()),
});

/* ────────────────────────────────  fixtures  ────────────────────────────── */

export const zFixtureStat = z.object({
  identifier: z.enum([
    "goals_scored",
    "assists",
    "own_goals",
    "penalties_saved",
    "penalties_missed",
    "yellow_cards",
    "red_cards",
    "saves",
    "bonus",
    "bps",
    "defensive_contribution",
  ]),
  a: z.array(z.object({ value: z.number(), element: z.number() })),
  h: z.array(z.object({ value: z.number(), element: z.number() })),
});

export const zFixture = z.object({
  id: z.number(),
  code: z.number(),
  event: z.number().nullable(),
  kickoff_time: z.string().nullable(),
  started: z.boolean().nullable(),
  finished: z.boolean(),
  finished_provisional: z.boolean(),
  minutes: z.number(),
  provisional_start_time: z.boolean(),
  team_h: z.number(),
  team_a: z.number(),
  team_h_score: z.number().nullable(),
  team_a_score: z.number().nullable(),
  team_h_difficulty: z.number(),
  team_a_difficulty: z.number(),
  stats: z.array(zFixtureStat),
  pulse_id: z.number(),
});

/* ──────────────────────────────  event live  ────────────────────────────── */

export const zLiveStats = z.object({
  minutes: z.number(),
  goals_scored: z.number(),
  assists: z.number(),
  clean_sheets: z.number(),
  goals_conceded: z.number(),
  own_goals: z.number(),
  penalties_saved: z.number(),
  penalties_missed: z.number(),
  yellow_cards: z.number(),
  red_cards: z.number(),
  saves: z.number(),
  bonus: z.number(),
  bps: z.number(),
  influence: num,
  creativity: num,
  threat: num,
  ict_index: num,
  clearances_blocks_interceptions: z.number(),
  recoveries: z.number(),
  tackles: z.number(),
  defensive_contribution: z.number(),
  starts: z.number(),
  expected_goals: num,
  expected_assists: num,
  expected_goal_involvements: num,
  expected_goals_conceded: num,
  total_points: z.number(),
  in_dreamteam: z.boolean(),
  played: z.boolean().optional(),
});

export const zLiveExplain = z.object({
  fixture: z.number(),
  stats: z.array(
    z.object({
      identifier: z.string(),
      points: z.number(),
      value: z.number(),
      points_modification: z.number().optional(),
    }),
  ),
});

export const zLive = z.object({
  elements: z.array(
    z.object({
      id: z.number(),
      stats: zLiveStats,
      explain: z.array(zLiveExplain),
      modified: z.boolean().optional(),
    }),
  ),
});

/* ────────────────────────────────  entry  ───────────────────────────────── */

export const zEntry = z.object({
  id: z.number(),
  name: z.string(),
  player_first_name: z.string(),
  player_last_name: z.string(),
  player_region_name: z.string().nullable(),
  player_region_iso_code_short: z.string().nullable(),
  summary_overall_points: z.number().nullable(),
  summary_overall_rank: z.number().nullable(),
  summary_event_points: z.number().nullable(),
  summary_event_rank: z.number().nullable(),
  current_event: z.number().nullable(),
  started_event: z.number(),
  last_deadline_bank: z.number().nullable(),
  last_deadline_value: z.number().nullable(),
  last_deadline_total_transfers: z.number().nullable(),
  favourite_team: z.number().nullable(),
  leagues: z.object({
    classic: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        entry_rank: z.number().nullable(),
        entry_last_rank: z.number().nullable(),
        created: z.string(),
        league_type: z.string(),
        scoring: z.string(),
        start_event: z.number(),
        entry_can_leave: z.boolean().optional(),
        rank_count: z.number().nullable().optional(),
      }),
    ),
    h2h: z.array(z.unknown()),
    cup: z.unknown().optional(),
    cup_matches: z.array(z.unknown()).optional(),
  }),
});

export const zEntryHistory = z.object({
  current: z.array(
    z.object({
      event: z.number(),
      points: z.number(),
      total_points: z.number(),
      rank: z.number().nullable(),
      rank_sort: z.number().nullable(),
      overall_rank: z.number().nullable(),
      percentile_rank: z.number().nullable().optional(),
      bank: z.number(),
      value: z.number(),
      event_transfers: z.number(),
      event_transfers_cost: z.number(),
      points_on_bench: z.number(),
    }),
  ),
  past: z.array(
    z.object({ season_name: z.string(), total_points: z.number(), rank: z.number() }),
  ),
  chips: z.array(z.object({ name: z.string(), time: z.string(), event: z.number() })),
});

export const zTransfers = z.array(
  z.object({
    element_in: z.number(),
    element_in_cost: z.number(),
    element_out: z.number(),
    element_out_cost: z.number(),
    entry: z.number(),
    event: z.number(),
    time: z.string(),
  }),
);

export const zPicks = z.object({
  active_chip: z.string().nullable(),
  automatic_subs: z.array(
    z.object({
      entry: z.number(),
      element_in: z.number(),
      element_out: z.number(),
      event: z.number(),
    }),
  ),
  entry_history: z.object({
    event: z.number(),
    points: z.number(),
    total_points: z.number(),
    rank: z.number().nullable(),
    rank_sort: z.number().nullable(),
    overall_rank: z.number().nullable(),
    percentile_rank: z.number().nullable().optional(),
    bank: z.number(),
    value: z.number(),
    event_transfers: z.number(),
    event_transfers_cost: z.number(),
    points_on_bench: z.number(),
  }),
  picks: z.array(
    z.object({
      element: z.number(),
      position: z.number(),
      multiplier: z.number(),
      is_captain: z.boolean(),
      is_vice_captain: z.boolean(),
      element_type: z.number().optional(),
      selling_price: z.number().optional(),
      purchase_price: z.number().optional(),
    }),
  ),
});

/* ────────────────────────────────  leagues  ─────────────────────────────── */

export const zClassicStandings = z.object({
  league: z.object({
    id: z.number(),
    name: z.string(),
    created: z.string(),
    closed: z.boolean(),
    max_entries: z.number().nullable(),
    league_type: z.string(),
    scoring: z.string(),
    admin_entry: z.number().nullable(),
    start_event: z.number(),
    code_privacy: z.string().optional(),
    has_cup: z.boolean().optional(),
    cup_league: z.number().nullable().optional(),
    rank: z.number().nullable(),
  }),
  new_entries: z.object({ has_next: z.boolean(), page: z.number(), results: z.array(z.unknown()) }),
  last_updated_data: z.string().nullable(),
  standings: z.object({
    has_next: z.boolean(),
    page: z.number(),
    results: z.array(
      z.object({
        id: z.number().optional(),
        event_total: z.number(),
        player_name: z.string(),
        rank: z.number(),
        last_rank: z.number(),
        rank_sort: z.number(),
        total: z.number(),
        entry: z.number(),
        entry_name: z.string(),
        has_played: z.boolean().optional(),
      }),
    ),
  }),
});

/* ───────────────────────────  element-summary  ──────────────────────────── */

export const zElementSummary = z.object({
  fixtures: z.array(
    z.object({
      id: z.number(),
      code: z.number(),
      event: z.number().nullable(),
      team_h: z.number(),
      team_a: z.number(),
      is_home: z.boolean(),
      difficulty: z.number(),
      kickoff_time: z.string().nullable(),
      event_name: z.string().nullable(),
      finished: z.boolean(),
    }),
  ),
  history: z.array(
    z.object({
      element: z.number(),
      fixture: z.number(),
      opponent_team: z.number(),
      total_points: z.number(),
      was_home: z.boolean(),
      kickoff_time: z.string(),
      team_h_score: z.number().nullable(),
      team_a_score: z.number().nullable(),
      round: z.number(),
      minutes: z.number(),
      goals_scored: z.number(),
      assists: z.number(),
      clean_sheets: z.number(),
      goals_conceded: z.number(),
      own_goals: z.number(),
      penalties_saved: z.number(),
      penalties_missed: z.number(),
      yellow_cards: z.number(),
      red_cards: z.number(),
      saves: z.number(),
      bonus: z.number(),
      bps: z.number(),
      influence: num,
      creativity: num,
      threat: num,
      ict_index: num,
      clearances_blocks_interceptions: z.number(),
      recoveries: z.number(),
      tackles: z.number(),
      defensive_contribution: z.number(),
      starts: z.number(),
      expected_goals: num,
      expected_assists: num,
      expected_goal_involvements: num,
      expected_goals_conceded: num,
      value: z.number(),
      transfers_balance: z.number(),
      selected: z.number(),
      transfers_in: z.number(),
      transfers_out: z.number(),
    }),
  ),
  history_past: z.array(
    z
      .object({
        season_name: z.string(),
        element_code: z.number(),
        start_cost: z.number(),
        end_cost: z.number(),
        total_points: z.number(),
        minutes: z.number(),
        goals_scored: z.number(),
        assists: z.number(),
      })
      .passthrough(),
  ),
});

export const zEventStatus = z.object({
  status: z.array(
    z.object({
      bonus_added: z.boolean(),
      date: z.string(),
      event: z.number(),
      points: z.string(),
    }),
  ),
  leagues: z.string(),
});

/* ───────────────────────────────  inferred  ─────────────────────────────── */

export type FplEvent = z.infer<typeof zEvent>;
export type FplTeam = z.infer<typeof zTeam>;
export type FplElement = z.infer<typeof zElement>;
export type FplElementType = z.infer<typeof zElementType>;
export type Bootstrap = z.infer<typeof zBootstrap>;
export type Fixture = z.infer<typeof zFixture>;
export type Live = z.infer<typeof zLive>;
export type Entry = z.infer<typeof zEntry>;
export type EntryHistory = z.infer<typeof zEntryHistory>;
export type Transfer = z.infer<typeof zTransfers>[number];
export type PicksResponse = z.infer<typeof zPicks>;
export type ClassicStandings = z.infer<typeof zClassicStandings>;
export type ElementSummary = z.infer<typeof zElementSummary>;
export type EventStatus = z.infer<typeof zEventStatus>;

export type GwPhase =
  | "pre_deadline"
  | "awaiting_kickoff"
  | "live"
  | "provisional"
  | "bonus_added"
  | "final";

export const CHIP_NAMES = ["wildcard", "freehit", "bboost", "3xc"] as const;
export type ChipName = (typeof CHIP_NAMES)[number];

export function parseChip(raw: string | null): ChipName | null {
  if (raw === null) return null;
  return (CHIP_NAMES as readonly string[]).includes(raw) ? (raw as ChipName) : null;
}
