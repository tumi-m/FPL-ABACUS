/**
 * teamStats — the twenty clubs, one row each.
 *
 * Player boards answer "who do I buy". This answers the question underneath
 * it: which clubs are actually creating the chances, which are riding their
 * finishing, and which defence is about to be found out. A player is a bet on
 * his club as much as on himself, and the club-level numbers move slower and
 * lie less.
 *
 * What this is NOT: a copy of a scouting table. FPL publishes expected goals
 * and expected assists but not shots, shots on target, chances created or
 * touches in the box — those come from Opta, and inventing them from what FPL
 * does give would be a guess wearing a decimal point. Every column here is
 * either something FPL publishes or something derived from a match result.
 *
 * Two aggregations, and they are not the same:
 *
 *   Summed across the squad — goals, assists, xG, xA, bonus, BPS, DEFCON,
 *   saves. Each player's figure is his own, so the parts add to the whole.
 *
 *   NOT summed — goals conceded and expected goals conceded. FPL reports both
 *   per player, meaning "while he was on the pitch", so adding up eleven
 *   players multiplies the club's season by eleven. The actual concession
 *   comes from the match results instead, which is exact; the expected one
 *   takes the most-played player's figure, which is the club's own number for
 *   anyone close to ever-present and the best available otherwise.
 *
 * Pure functions only — composition happens on the server.
 */

/** The slice of a player this engine reads. */
export interface StatPlayer {
  team: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  xgTotal: number;
  xaTotal: number;
  xgiTotal: number;
  xgcTotal: number;
  cleanSheets: number;
  saves: number;
  defcon: number;
  tackles: number;
  recoveries: number;
  cbi: number;
  total_points: number;
  bps: number;
  bonus: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  pensSaved: number;
  pensMissed: number;
  selected_by_percent: number;
  transfersInEvent: number;
  transfersOutEvent: number;
  costChangeStart: number;
  now_cost: number;
  web_name: string;
  element_type: number;
}

/** The slice of a fixture this engine reads. */
export interface StatFixture {
  event: number | null;
  finished: boolean;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
}

export interface StatTeam {
  id: number;
  name: string;
  short_name: string;
}

export interface TeamStatRow {
  teamId: number;
  name: string;
  short: string;

  /** Matches with a final score. */
  played: number;
  /** Minutes the club's players logged — the sample behind every rate here. */
  minutes: number;

  /* attack */
  xg: number;
  goals: number;
  xa: number;
  assists: number;
  xgi: number;
  /** Goals plus assists — the actual side of xGI. */
  gi: number;

  /* defence */
  xgc: number;
  conceded: number;
  cleanSheets: number;
  saves: number;

  /* defensive contributions */
  defcon: number;
  tackles: number;
  recoveries: number;
  cbi: number;

  /* what it paid */
  points: number;
  bps: number;
  bonus: number;
  yellow: number;
  red: number;
  ownGoals: number;
  pensSaved: number;
  pensMissed: number;

  /* the market */
  /** The club's most-owned player, and by how much. */
  topOwned: { name: string; percent: number } | null;
  transfersIn: number;
  transfersOut: number;
  /** Players whose price has risen / fallen since the season opened. */
  risers: number;
  fallers: number;
  /** The priciest asset at the club, in millions. */
  topPrice: number;
}

const ZERO = (t: StatTeam): TeamStatRow => ({
  teamId: t.id,
  name: t.name,
  short: t.short_name,
  played: 0,
  minutes: 0,
  xg: 0,
  goals: 0,
  xa: 0,
  assists: 0,
  xgi: 0,
  gi: 0,
  xgc: 0,
  conceded: 0,
  cleanSheets: 0,
  saves: 0,
  defcon: 0,
  tackles: 0,
  recoveries: 0,
  cbi: 0,
  points: 0,
  bps: 0,
  bonus: 0,
  yellow: 0,
  red: 0,
  ownGoals: 0,
  pensSaved: 0,
  pensMissed: 0,
  topOwned: null,
  transfersIn: 0,
  transfersOut: 0,
  risers: 0,
  fallers: 0,
  topPrice: 0,
});

/**
 * Played and conceded, straight off the scoreline.
 *
 * A finished fixture with a null score is a fixture the API has not filled in
 * yet, not a nil-nil; counting it would hand the club a clean sheet it did not
 * keep.
 */
export function resultsByTeam(
  fixtures: StatFixture[],
  upToGw?: number,
): Map<number, { played: number; conceded: number; scored: number }> {
  const out = new Map<number, { played: number; conceded: number; scored: number }>();
  const bump = (id: number, scored: number, conceded: number) => {
    const cur = out.get(id) ?? { played: 0, conceded: 0, scored: 0 };
    cur.played += 1;
    cur.scored += scored;
    cur.conceded += conceded;
    out.set(id, cur);
  };
  for (const f of fixtures) {
    if (!f.finished) continue;
    if (f.team_h_score == null || f.team_a_score == null) continue;
    if (upToGw != null && (f.event == null || f.event > upToGw)) continue;
    bump(f.team_h, f.team_h_score, f.team_a_score);
    bump(f.team_a, f.team_a_score, f.team_h_score);
  }
  return out;
}

export function buildTeamStats(input: {
  teams: StatTeam[];
  players: StatPlayer[];
  fixtures: StatFixture[];
  upToGw?: number;
}): TeamStatRow[] {
  const rows = new Map<number, TeamStatRow>();
  for (const t of input.teams) rows.set(t.id, ZERO(t));

  // the club's own expected concession — see the header note on why this is a
  // max and not a sum
  const mostPlayed = new Map<number, StatPlayer>();

  for (const p of input.players) {
    const r = rows.get(p.team);
    if (!r) continue;

    r.minutes += p.minutes;
    r.xg += p.xgTotal;
    r.goals += p.goals_scored;
    r.xa += p.xaTotal;
    r.assists += p.assists;
    r.xgi += p.xgiTotal;
    r.gi += p.goals_scored + p.assists;

    r.cleanSheets = Math.max(r.cleanSheets, p.cleanSheets);
    r.saves += p.saves;

    r.defcon += p.defcon;
    r.tackles += p.tackles;
    r.recoveries += p.recoveries;
    r.cbi += p.cbi;

    r.points += p.total_points;
    r.bps += p.bps;
    r.bonus += p.bonus;
    r.yellow += p.yellowCards;
    r.red += p.redCards;
    r.ownGoals += p.ownGoals;
    r.pensSaved += p.pensSaved;
    r.pensMissed += p.pensMissed;

    r.transfersIn += p.transfersInEvent;
    r.transfersOut += p.transfersOutEvent;
    if (p.costChangeStart > 0) r.risers += 1;
    if (p.costChangeStart < 0) r.fallers += 1;
    r.topPrice = Math.max(r.topPrice, p.now_cost / 10);

    if (!r.topOwned || p.selected_by_percent > r.topOwned.percent) {
      r.topOwned = { name: p.web_name, percent: p.selected_by_percent };
    }

    const best = mostPlayed.get(p.team);
    if (!best || p.minutes > best.minutes) mostPlayed.set(p.team, p);
  }

  // A clean sheet is a team event, so the squad's maximum is the club's count
  // — it is whatever the ever-present players recorded, not eleven copies.
  for (const [teamId, p] of mostPlayed) {
    const r = rows.get(teamId);
    if (r) r.xgc = p.xgcTotal;
  }

  const results = resultsByTeam(input.fixtures, input.upToGw);
  for (const [teamId, res] of results) {
    const r = rows.get(teamId);
    if (!r) continue;
    r.played = res.played;
    r.conceded = res.conceded;
  }

  return [...rows.values()];
}

/** Rate per ninety minutes of football played, guarding an empty sample. */
export function perMatch(total: number, played: number): number {
  return played > 0 ? total / played : 0;
}

/**
 * How far actual ran ahead of expected.
 *
 * Positive means the club banked more than the chances deserved — a run that
 * regresses more often than it continues. Negative means the chances are
 * there and the finishing is not, which is the buy signal of the two.
 */
export function overExpected(actual: number, expected: number): number {
  return actual - expected;
}

/** The largest absolute value in a column, for scaling a diverging bar. */
export function spread(values: number[]): number {
  let max = 0;
  for (const v of values) {
    const a = Math.abs(v);
    if (Number.isFinite(a) && a > max) max = a;
  }
  return max;
}
