export type Pos = 1 | 2 | 3 | 4;
export type Multiplier = 0 | 1 | 2 | 3;
export type Chip = "wildcard" | "freehit" | "bboost" | "3xc" | null;

/** DEFCON thresholds: CBIT for DEF (10+), CBIT+recoveries for MID/FWD (12+). GK n/a. */
export const DEFCON_THRESHOLD: Record<Pos, number> = { 1: 99, 2: 10, 3: 12, 4: 12 };

export interface ScoringConfig {
  goals: Record<Pos, number>;
  cleanSheet: Record<Pos, number>;
  concededPer2: Record<Pos, number>;
  defconPoints: Record<Pos, number>;
  assist: number;
  savesPer3: number;
  penSave: number;
  penMiss: number;
  yellow: number;
  red: number;
  ownGoal: number;
  minutesShort: number;
  minutesLong: number;
}

export interface LiveStatsLite {
  bps: number;
  saves: number;
  goalsScored: number;
  assists: number;
  cleanSheets: number;
  conceded: number;
  ownGoals: number;
  penMissed: number;
  cards: number;
  yellowCards: number;
  redCards: number;
  xg: number;
  xa: number;
  /** Live expected goals conceded — the real number for the GW in play. */
  xgc: number;
}

export interface LivePlayer {
  id: number;
  pos: Pos;
  teamId: number;
  webName: string;
  minutes: number;
  /** live.stats.total_points — official, excludes our provisional bonus */
  basePoints: number;
  provisionalBonus: number;
  livePoints: number;
  /** The bonus that counts: official from the feed when present, else the
   *  bps-race projection. This is the 1·2·3 users actually care about. */
  bonus: number;
  /** False while bonus is still our projection — FPL hasn't added it yet. */
  bonusOfficial: boolean;
  fixtureIds: number[];
  played: boolean;
  fixturesFinished: boolean;
  defcon: { count: number; threshold: number; hit: boolean };
  stats: LiveStatsLite;
}

export interface Pick {
  element: number;
  position: number;
  multiplier: Multiplier;
  isCaptain: boolean;
  isViceCaptain: boolean;
}
