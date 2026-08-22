export interface LiveBarData {
  phase: string;
  gameweek: number;
  fixturesInPlay: number;
  latestMinute: number | null;
  /** This entry's live gameweek score (null while unknown/upstream down). */
  gwPoints?: number | null;
  /** Season-to-date total for the entry. */
  seasonTotal?: number | null;
}
