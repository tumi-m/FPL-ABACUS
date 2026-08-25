/**
 * fixtureTicker — the league-wide fixture run, per club.
 *
 * The Board used to grid your fifteen players. That answers "how do my
 * fixtures look", which is the smaller half of the question: a fixture ticker
 * exists so you can scan the *league* and find who to buy, and you cannot see
 * a club you do not already own. So the rows are the twenty clubs, and your
 * squad is marked on them rather than being the whole grid.
 *
 * Two things separate this from a generic difficulty ticker:
 *
 * 1. **Attack and defence are different fixtures.** Brighton at home to a
 *    leaky side is a fine attacking fixture and a poor defensive one. One
 *    number for both is the compromise that makes most tickers useless for
 *    picking defenders, so the two are scored separately and switched
 *    between.
 *
 * 2. **The scores are quantities, not indices.** An attacking run is the
 *    goals the model expects that club to score across it; a defensive run is
 *    the clean sheets it expects to keep — the Poisson shutout probability
 *    e^(−xGA) summed over the matches. Both are readable on their own terms,
 *    which "3.4 FDR" is not.
 *
 * Pure functions only; composition happens on the server.
 */
import type { Fixture } from "@/lib/fpl/schemas";
import { projectFixture, type FixtureModel } from "@/lib/engines/fixtureModel";

/** Which half of the game a run is being judged for. */
export type TickerSide = "attack" | "defence";

/** One club's single fixture inside a gameweek. */
export interface TickerFixture {
  opponentId: number;
  home: boolean;
  /** Goals this club is projected to score. */
  xgFor: number;
  /** Goals it is projected to concede. */
  xgAgainst: number;
  /** Poisson probability of a shutout at that concession rate. */
  cleanSheet: number;
}

/** One club's gameweek: none, one, or several fixtures. */
export interface TickerCell {
  gw: number;
  fixtures: TickerFixture[];
  /**
   * The cell's value on the selected side, summed across a double.
   *
   * Summing is the honest aggregate for both sides: two matches are two
   * chances to score and two chances at a shutout. A blank scores nothing —
   * not "average", which would hide it — and is flagged so the grid can paint
   * it as the hole it is rather than as a middling fixture.
   */
  value: number;
  kind: "single" | "double" | "blank";
}

export interface TickerRow {
  teamId: number;
  cells: TickerCell[];
  /** Sum of the cells' values across the selected range. */
  score: number;
  /** 1 = best run in the league on this side, over this range. */
  rank: number;
}

/** Poisson P(0 goals) at rate λ — the clean-sheet probability. */
export function cleanSheetChance(xgAgainst: number): number {
  if (!Number.isFinite(xgAgainst) || xgAgainst <= 0) return 1;
  return Math.exp(-xgAgainst);
}

/** What one fixture is worth to a club on the given side. */
export function fixtureValue(f: TickerFixture, side: TickerSide): number {
  return side === "attack" ? f.xgFor : f.cleanSheet;
}

export interface TickerInput {
  model: FixtureModel;
  fixtures: Fixture[];
  teamIds: number[];
  /** Gameweeks to grid, ascending. */
  gws: number[];
}

/**
 * Grid every club against the gameweeks, scored on one side.
 *
 * The projection is computed per fixture regardless of side, so switching
 * between attack and defence re-ranks the same numbers rather than refetching
 * anything — the whole grid is small enough to hand to the client once and let
 * it slice.
 */
export function buildTicker(input: TickerInput, side: TickerSide): TickerRow[] {
  const { model, fixtures, teamIds, gws } = input;

  // One pass over the fixture list per gameweek beats a scan per club-cell:
  // twenty clubs times thirty-eight weeks is 760 scans of the season otherwise.
  const byGw = new Map<number, Fixture[]>();
  for (const f of fixtures) {
    if (f.event == null) continue;
    const list = byGw.get(f.event);
    if (list) list.push(f);
    else byGw.set(f.event, [f]);
  }

  const rows: TickerRow[] = teamIds.map((teamId) => {
    const cells = gws.map((gw): TickerCell => {
      const played = (byGw.get(gw) ?? []).filter(
        (f) => f.team_h === teamId || f.team_a === teamId,
      );
      const fx: TickerFixture[] = played.map((f) => {
        const home = f.team_h === teamId;
        const opponentId = home ? f.team_a : f.team_h;
        const p = projectFixture(model, teamId, opponentId, home);
        return {
          opponentId,
          home,
          xgFor: p.xgFor,
          xgAgainst: p.xgAgainst,
          cleanSheet: cleanSheetChance(p.xgAgainst),
        };
      });
      return {
        gw,
        fixtures: fx,
        value: fx.reduce((s, f) => s + fixtureValue(f, side), 0),
        kind: fx.length === 0 ? "blank" : fx.length > 1 ? "double" : "single",
      };
    });

    return {
      teamId,
      cells,
      score: cells.reduce((s, c) => s + c.value, 0),
      rank: 0,
    };
  });

  // Rank on the run, best first, with the club id as a stable tiebreak so the
  // order never shuffles between renders of identical data.
  const order = [...rows].sort((a, b) => b.score - a.score || a.teamId - b.teamId);
  order.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}

/**
 * Quantile cut points over the cells that actually carry a fixture.
 *
 * Blanks are excluded on purpose: a third of the grid scoring zero in a
 * double-gameweek week would drag the cut points down and paint ordinary
 * fixtures green. They get their own tone instead.
 */
export function tickerCuts(rows: TickerRow[], steps = 6): number[] {
  const values = rows
    .flatMap((r) => r.cells)
    .filter((c) => c.kind !== "blank")
    .map((c) => c.value)
    .sort((a, b) => a - b);
  if (values.length === 0) return [];
  const cuts: number[] = [];
  for (let i = 1; i < steps; i++) {
    const idx = (values.length - 1) * (i / steps);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    cuts.push(values[lo] + (values[hi] - values[lo]) * (idx - lo));
  }
  return cuts;
}

/** Map a cell onto the 1..6 heat. Blanks return 0 — outside the ramp. */
export function tickerHeat(cell: TickerCell, cuts: number[]): number {
  if (cell.kind === "blank") return 0;
  let b = 0;
  for (const c of cuts) if (cell.value > c) b++;
  return b + 1;
}

/**
 * Re-score an already-built grid for the other side, or a shorter range.
 *
 * The projections do not change — only which half of them is being counted
 * and how many weeks are in view — so the client can retune the whole board
 * without another request.
 */
export function rescore(rows: TickerRow[], side: TickerSide, gws: number[]): TickerRow[] {
  const want = new Set(gws);
  const out = rows.map((r) => {
    const cells = r.cells
      .filter((c) => want.has(c.gw))
      .map((c) => ({
        ...c,
        value: c.fixtures.reduce((s, f) => s + fixtureValue(f, side), 0),
      }));
    return {
      teamId: r.teamId,
      cells,
      score: cells.reduce((s, c) => s + c.value, 0),
      rank: 0,
    };
  });
  const order = [...out].sort((a, b) => b.score - a.score || a.teamId - b.teamId);
  order.forEach((r, i) => {
    r.rank = i + 1;
  });
  return out;
}

/** How the run reads in one line: "2.9 goals" or "1.4 clean sheets". */
export function scoreLabel(score: number, side: TickerSide): string {
  const n = score.toFixed(1);
  if (side === "attack") return `${n} goals`;
  return `${n} clean sheet${score >= 0.95 && score < 1.05 ? "" : "s"}`;
}
