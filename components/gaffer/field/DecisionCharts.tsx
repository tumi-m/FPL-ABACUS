"use client";

/**
 * The five decision charts under the pitch.
 *
 * These are the ones that read the maths the app already had but never showed:
 * the Dixon–Coles Monte Carlo behind the correlation web, the Shapley
 * permutation sampler in `lib/quant/understanding`, and the Nash captaincy
 * objective in `lib/quant/decision`. Nothing here invents a number — every
 * chart either renders a figure from the matchday model or runs one of those
 * pure engines over it, and every estimate is wrapped in `<Est>`.
 */

import * as React from "react";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Est } from "@/components/gaffer/Est";
import { crossover, rankAtRisk, type CaptainCandidate } from "@/lib/quant/decision";
import { processVsOutcome, shapleyLedger, type LedgerDecision } from "@/lib/quant/understanding";
import { contribution, counting } from "@/components/gaffer/field/FieldCharts";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

type SquadRow = MatchdayModel["squad"][number];

export interface WebFeed {
  meanPoints: Record<number, number>;
  sdPoints: Record<number, number>;
  totals: number[];
  portfolioSd: number;
  draws: number;
}

const fmtRank = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : Math.abs(n) >= 1_000
      ? `${Math.round(n / 1_000)}k`
      : String(Math.round(n));

const MC_METHOD =
  "Dixon–Coles match simulation over your eleven, 800 correlated draws with a fixed seed — the same engine behind the correlation web.";

/* ────────────────────────────────────────────────────────────────────────────
   1 · Rank at risk — where the gameweek can still land
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The simulated spread of your gameweek, priced in rank.
 *
 * The Monte Carlo gives a distribution of XI totals; the rank curve's local
 * slope (ranks per point) converts a points deviation into a rank deviation
 * around your live estimate. That conversion is linear and only holds near
 * your own position on the curve, which is exactly where these draws sit.
 */
export function RankAtRisk({
  web,
  estimatedRank,
  ranksPerPoint,
}: {
  web: WebFeed;
  estimatedRank: number | null;
  ranksPerPoint: number;
}) {
  const totals = web.totals;
  if (totals.length < 20 || estimatedRank == null || !Number.isFinite(ranksPerPoint) || ranksPerPoint <= 0) {
    return (
      <ChartFrame eyebrow="Monte Carlo" title="Rank at risk" ariaLabel="Simulated rank outcomes for this gameweek">
        <p className="py-8 text-center text-sm text-ink-lo">
          Needs a live rank estimate and a simulated eleven — both arrive once the gameweek has a
          rank curve and your fixtures are known.
        </p>
      </ChartFrame>
    );
  }

  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  // Better points → better (lower) rank, so the sign flips on the way across.
  const raw = totals.map((t) => Math.round(estimatedRank - (t - mean) * ranksPerPoint));
  const ranks = raw.map((r) => Math.max(1, r));
  // Near the top of the table a good half of the draws would land above rank 1,
  // which does not exist. Say so rather than drawing a spike at the wall.
  const clipped = raw.filter((r) => r < 1).length / raw.length;
  const risk = rankAtRisk(ranks);
  const best = Math.min(...ranks);
  const worst = Math.max(...ranks);

  const W = 560;
  const H = 168;
  const M = { top: 22, right: 20, bottom: 40, left: 20 };
  const span = Math.max(1, worst - best);
  const x = (r: number) => M.left + ((W - M.left - M.right) * (r - best)) / span;

  // 24-bin histogram of the rank draws.
  const BINS = 24;
  const counts = new Array(BINS).fill(0);
  for (const r of ranks) counts[Math.min(BINS - 1, Math.floor(((r - best) / span) * BINS))]++;
  const peak = Math.max(1, ...counts);
  const binW = (W - M.left - M.right) / BINS;

  const table = {
    headers: ["Outcome", "Rank"],
    rows: [
      ["Best simulated", fmtRank(best)],
      ["Median", fmtRank(risk.medianRank)],
      ["Bad week (5% tail)", fmtRank(risk.var95)],
      ["If the tail hits (CVaR)", fmtRank(risk.cvar95)],
    ] as (string | number)[][],
  };

  return (
    <ChartFrame
      eyebrow="Monte Carlo"
      title="Rank at risk — where this week can land"
      ariaLabel="Distribution of simulated overall ranks for this gameweek"
      caption={
        clipped > 0.2
          ? `${web.draws.toLocaleString("en-GB")} correlated draws — ${Math.round(clipped * 100)}% of them finish above first place, so the good half of this band is capped by the top of the table.`
          : `${web.draws.toLocaleString("en-GB")} correlated draws · the tail measure is the mean rank given you land in the worst 5%.`
      }
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {counts.map((c, i) => {
          const h = ((H - M.top - M.bottom) * c) / peak;
          return (
            <rect
              key={i}
              x={M.left + i * binW}
              y={H - M.bottom - h}
              width={Math.max(1, binW - 1.5)}
              height={Math.max(0, h)}
              rx="1.5"
              fill="var(--seq-400)"
              opacity={0.85}
            />
          );
        })}
        <line x1={M.left} y1={H - M.bottom} x2={W - M.right} y2={H - M.bottom} stroke="var(--axis)" strokeWidth="1" />

        {/* median and the 5% tail line */}
        {[
          { r: risk.medianRank, label: "median", colour: "var(--volt)" },
          { r: risk.var95, label: "5% tail", colour: "var(--flare)" },
        ].map((mark) => (
          <g key={mark.label}>
            <line
              x1={x(mark.r)}
              y1={M.top - 6}
              x2={x(mark.r)}
              y2={H - M.bottom}
              stroke={mark.colour}
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <text x={x(mark.r)} y={M.top - 10} textAnchor="middle" fontSize="10" fill={mark.colour}>
              {mark.label}
            </text>
          </g>
        ))}

        <text x={M.left} y={H - 22} fontSize="10" className="fill-(--ink-lo)">
          best {fmtRank(best)}
        </text>
        <text x={W - M.right} y={H - 22} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">
          worst {fmtRank(worst)}
        </text>
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
          Overall rank — left is better
        </text>
      </svg>

      <dl className="mt-3 grid grid-cols-3 gap-3">
        {[
          { k: "Median", v: fmtRank(risk.medianRank), tone: "text-ink-hi" },
          { k: "Bad week", v: fmtRank(risk.var95), tone: "text-flare" },
          { k: "Tail mean", v: fmtRank(risk.cvar95), tone: "text-flare" },
        ].map((s) => (
          <div key={s.k}>
            <dt className="upper-label text-2xs text-ink-lo">{s.k}</dt>
            <dd className={`fig-num mt-0.5 text-lg leading-none ${s.tone}`}>
              <Est method={MC_METHOD}>{s.v}</Est>
            </dd>
          </div>
        ))}
      </dl>
    </ChartFrame>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   2 · The Crossover — Nash captaincy
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Which armband the objective actually prefers, and how far behind you have to
 * be before a differential is worth it.
 *
 * The objective is (Δμ + B) / σ_Δ: expected-points edge plus the points you
 * trail by, divided by the spread of the difference. Variance is a liability
 * when you lead and an asset when you chase, which is why the answer moves as
 * B grows. The crossover figure is the B at which each challenger draws level.
 */
export function Crossover({
  rows,
  web,
  pointsBehind,
}: {
  rows: SquadRow[];
  web: WebFeed;
  /** How far you trail the target — 0 when you are level or ahead. */
  pointsBehind: number;
}) {
  const xi = counting(rows);
  const candidates: (CaptainCandidate & { name: string; element: number })[] = xi
    .map((r) => ({
      key: String(r.element),
      element: r.element,
      name: r.webName,
      mu: web.meanPoints[r.element] ?? 0,
      sd: web.sdPoints[r.element] ?? 0,
    }))
    .filter((c) => c.mu > 0 && c.sd > 0)
    .sort((a, b) => b.mu - a.mu)
    .slice(0, 6);

  if (candidates.length < 2) {
    return (
      <ChartFrame eyebrow="Nash" title="The Crossover" ariaLabel="Nash captaincy objective across your candidates">
        <p className="py-8 text-center text-sm text-ink-lo">
          The simulation needs at least two of your eleven with a fixture to compare armbands.
        </p>
      </ChartFrame>
    );
  }

  const result = crossover(candidates, pointsBehind);
  const chosen = candidates.find((c) => c.key === result.choice) ?? candidates[0];
  const safe = candidates[0];

  const W = 560;
  const rowH = 30;
  const H = candidates.length * rowH + 54;
  const M = { top: 14, right: 96, bottom: 26, left: 104 };
  const maxMu = Math.max(...candidates.map((c) => c.mu));

  const table = {
    headers: ["Player", "Mean pts", "Spread", "Overtakes at"],
    rows: candidates.map((c) => [
      c.name,
      c.mu.toFixed(2),
      c.sd.toFixed(2),
      c.key === safe.key ? "—" : `${Math.max(0, result.crossoverPoints.get(c.key) ?? 0).toFixed(1)} behind`,
    ]) as (string | number)[][],
  };

  return (
    <ChartFrame
      eyebrow="Nash"
      title={`The Crossover — ${chosen.name} wins the objective`}
      ariaLabel="Nash captaincy objective across your candidates"
      caption={
        pointsBehind > 0
          ? `Chasing by ${pointsBehind} points, so variance is working for you.`
          : "Level or ahead, so the objective prefers the calmer arm."
      }
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {candidates.map((c, i) => {
          const y = M.top + i * rowH;
          const w = ((W - M.left - M.right) * c.mu) / maxMu;
          const spread = ((W - M.left - M.right) * c.sd) / maxMu;
          const isChoice = c.key === chosen.key;
          const over = result.crossoverPoints.get(c.key);
          return (
            <g key={c.key}>
              <text
                x={M.left - 10}
                y={y + 15}
                textAnchor="end"
                fontSize="11"
                className={isChoice ? "fill-(--ink-hi)" : "fill-(--ink-mid)"}
                fontWeight={isChoice ? 700 : 400}
              >
                {c.name}
              </text>
              {/* mean bar with the simulated spread drawn as a whisker */}
              <rect
                x={M.left}
                y={y + 4}
                width={Math.max(2, w)}
                height={16}
                rx="3"
                fill={isChoice ? "var(--volt)" : "var(--seq-250)"}
              >
                <title>{`${c.name}: ${c.mu.toFixed(2)} mean points, spread ${c.sd.toFixed(2)}`}</title>
              </rect>
              <line
                x1={Math.max(2, w) + M.left - spread / 2}
                x2={Math.max(2, w) + M.left + spread / 2}
                y1={y + 12}
                y2={y + 12}
                stroke="var(--ink-lo)"
                strokeWidth="1.5"
              />
              <text
                x={W - M.right + 8}
                y={y + 16}
                fontSize="10"
                className={c.key === safe.key ? "fill-(--ink-lo)" : "fill-(--ink-mid)"}
              >
                {c.key === safe.key ? "the safe arm" : `at −${Math.max(0, over ?? 0).toFixed(0)} pts`}
              </text>
            </g>
          );
        })}
        <text x={M.left} y={H - 8} fontSize="10" className="fill-(--ink-lo)">
          Bar is simulated mean points · whisker is the spread · right column is how far behind a
          challenger needs you to be
        </text>
      </svg>
    </ChartFrame>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   3 · The Ledger — Shapley attribution over the counterfactuals
   ──────────────────────────────────────────────────────────────────────────── */

const SHAPLEY_METHOD =
  "Shapley values by Monte Carlo permutation sampling (Castro–Gómez–Tejada) over the counterfactual gameweeks — 400 orderings, fixed seed, so the bars sum exactly to the total rank move they explain.";

/**
 * What each decision was worth, in ranks.
 *
 * The multiverse already replays your gameweek under alternative branches —
 * a different captain, the bench left alone, the transfer not made. Each of
 * those is a decision whose value is the rank you got against the rank that
 * branch would have given you, and Shapley is the fair way to split a joint
 * outcome between decisions that interact.
 */
export function DecisionLedger({ multiverse }: { multiverse: MatchdayModel["multiverse"] }) {
  const decisions: LedgerDecision[] = multiverse.results.map((b) => ({
    key: b.label,
    // Positive ranksDelta means the alternative was better — so taking your
    // actual line was worth the negative of it.
    valueWithDecision: 0,
    valueDefault: b.ranksDelta,
  }));

  if (decisions.length === 0) {
    return (
      <ChartFrame eyebrow="Shapley" title="The Ledger" ariaLabel="What each decision was worth in ranks">
        <p className="py-8 text-center text-sm text-ink-lo">
          No counterfactuals yet — the ledger fills in once players in your squad have scored.
        </p>
      </ChartFrame>
    );
  }

  const result = shapleyLedger(decisions, { orderings: 400, seed: 2026 });
  const rowsOut = [...result.attributions.entries()]
    .map(([key, phi]) => ({ key, phi, se: result.standardErrors.get(key) ?? 0 }))
    .sort((a, b) => Math.abs(b.phi) - Math.abs(a.phi))
    .slice(0, 7);

  const W = 560;
  const rowH = 28;
  const H = rowsOut.length * rowH + 46;
  const M = { top: 12, right: 16, bottom: 26, left: 196 };
  const span = Math.max(1, ...rowsOut.map((r) => Math.abs(r.phi)));
  const mid = M.left + (W - M.left - M.right) / 2;
  const half = (W - M.left - M.right) / 2;

  const table = {
    headers: ["Decision", "Ranks"],
    rows: rowsOut.map((r) => [r.key, Math.round(r.phi)]) as (string | number)[][],
  };

  return (
    <ChartFrame
      eyebrow="Shapley · Monte Carlo"
      title="The Ledger — what each decision was worth"
      ariaLabel="Shapley attribution of your rank move across the decisions you took"
      caption="Right of the line is a decision that gained you ranks; left is one that cost you."
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={mid} y1={M.top - 4} x2={mid} y2={H - M.bottom} stroke="var(--axis)" strokeWidth="1" />
        {rowsOut.map((r, i) => {
          const y = M.top + i * rowH;
          const w = (half * Math.abs(r.phi)) / span;
          const gained = r.phi >= 0;
          return (
            <g key={r.key}>
              <text x={M.left - 10} y={y + 15} textAnchor="end" fontSize="11" className="fill-(--ink-mid)">
                {shortDecision(r.key)}
              </text>
              <rect
                x={gained ? mid : mid - w}
                y={y + 4}
                width={Math.max(2, w)}
                height={16}
                rx="3"
                fill={gained ? "var(--surge)" : "var(--flare)"}
              >
                <title>{`${r.key}: ${gained ? "+" : "−"}${fmtRank(Math.abs(r.phi))} ranks`}</title>
              </rect>
              <text
                x={gained ? mid + Math.max(2, w) + 6 : mid - Math.max(2, w) - 6}
                y={y + 16}
                textAnchor={gained ? "start" : "end"}
                fontSize="10"
                className="fill-(--ink-lo)"
              >
                {gained ? "+" : "−"}
                {fmtRank(Math.abs(r.phi))}
              </text>
            </g>
          );
        })}
        <text x={M.left - 10} y={H - 8} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">
          cost you
        </text>
        <text x={mid + 8} y={H - 8} fontSize="10" className="fill-(--ink-lo)">
          gained you
        </text>
      </svg>
      <p className="mt-2 text-2xs text-ink-lo">
        Total attributed:{" "}
        <Est method={SHAPLEY_METHOD}>
          {`${result.totalAttributed >= 0 ? "+" : "−"}${fmtRank(Math.abs(result.totalAttributed))} ranks`}
        </Est>{" "}
        across {result.orderings.toLocaleString("en-GB")} orderings.
      </p>
    </ChartFrame>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   4 · Process vs outcome — did you play well or get lucky
   ──────────────────────────────────────────────────────────────────────────── */

/** Points FPL pays for a goal, by position. */
const GOAL_VALUE: Record<number, number> = { 1: 10, 2: 6, 3: 5, 4: 4 };
const ASSIST_VALUE = 3;

/**
 * The gap between the week you deserved and the week you got.
 *
 * Three channels, all measured rather than guessed: finishing (goals against
 * the xG of the chances), creation (assists against xA), and the bonus bounce
 * (what the official 1·2·3 gave you versus what the BPS projection said). The
 * field channel is your score against the live field average.
 */
export function ProcessVsOutcome({
  rows,
  fieldAvg,
  gwPoints,
}: {
  rows: SquadRow[];
  fieldAvg: number;
  gwPoints: number;
}) {
  const xi = counting(rows);
  const live = xi.filter((r) => r.liveStats != null);

  if (live.length === 0) {
    return (
      <ChartFrame eyebrow="Luck" title="Process vs outcome" ariaLabel="Luck channels in your gameweek">
        <p className="py-8 text-center text-sm text-ink-lo">
          Nothing has kicked off yet — luck needs a match to happen in.
        </p>
      </ChartFrame>
    );
  }

  let finishingLuck = 0;
  let creationLuck = 0;
  let bonusLuck = 0;
  for (const r of live) {
    const s = r.liveStats!;
    finishingLuck += (s.goalsScored - s.xg) * (GOAL_VALUE[r.pos] ?? 4) * r.multiplier;
    creationLuck += (s.assists - s.xa) * ASSIST_VALUE * r.multiplier;
    if (r.bonusOfficial) bonusLuck += (r.bonus - r.provisionalBonus) * r.multiplier;
  }
  const fieldLuck = fieldAvg > 0 ? gwPoints - fieldAvg : 0;

  const result = processVsOutcome({
    bonusLuck: round1(bonusLuck),
    minutesLuck: 0,
    finishingLuck: round1(finishingLuck),
    fieldLuck: round1(fieldLuck),
  });

  const channels = [
    { key: "Finishing", v: round1(finishingLuck), hint: "Goals scored against the xG of the chances, priced at your positions' goal values." },
    { key: "Creation", v: round1(creationLuck), hint: "Assists against expected assists, at three points each." },
    { key: "Bonus bounce", v: round1(bonusLuck), hint: "Official bonus minus the BPS projection — only counted once FPL confirms." },
    { key: "Versus field", v: round1(fieldLuck), hint: "Your score against the live field average." },
  ];

  const W = 560;
  const rowH = 32;
  const H = channels.length * rowH + 42;
  const M = { top: 10, right: 16, bottom: 24, left: 110 };
  const span = Math.max(1, ...channels.map((c) => Math.abs(c.v)));
  const half = (W - M.left - M.right) / 2;
  const mid = M.left + half;

  const table = {
    headers: ["Channel", "Points"],
    rows: channels.map((c) => [c.key, c.v]) as (string | number)[][],
  };

  return (
    <ChartFrame
      eyebrow="Luck"
      title="Process vs outcome"
      ariaLabel="How much of your gameweek was performance and how much was variance"
      caption="Finishing reverts toward xG over a season; the field channel does not — it is just where you stand."
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={mid} y1={M.top - 2} x2={mid} y2={H - M.bottom} stroke="var(--axis)" strokeWidth="1" />
        {channels.map((c, i) => {
          const y = M.top + i * rowH;
          const w = (half * Math.abs(c.v)) / span;
          const good = c.v >= 0;
          return (
            <g key={c.key}>
              <text x={M.left - 10} y={y + 17} textAnchor="end" fontSize="11" className="fill-(--ink-mid)">
                {c.key}
              </text>
              <rect
                x={good ? mid : mid - w}
                y={y + 5}
                width={Math.max(2, w)}
                height={18}
                rx="3"
                fill={good ? "var(--surge)" : "var(--flare)"}
                opacity={0.9}
              >
                <title>{`${c.key}: ${good ? "+" : "−"}${Math.abs(c.v).toFixed(1)} pts — ${c.hint}`}</title>
              </rect>
              <text
                x={good ? mid + Math.max(2, w) + 6 : mid - Math.max(2, w) - 6}
                y={y + 18}
                textAnchor={good ? "start" : "end"}
                fontSize="11"
                fontWeight="800"
                className="fill-(--ink-hi)"
                style={{ fontVariationSettings: '"wdth" 110' }}
              >
                {good ? "+" : "−"}
                {Math.abs(c.v).toFixed(1)}
              </text>
            </g>
          );
        })}
        <text x={M.left - 10} y={H - 6} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">
          went against you
        </text>
        <text x={mid + 8} y={H - 6} fontSize="10" className="fill-(--ink-lo)">
          went your way
        </text>
      </svg>
      {result.advice.length > 0 && (
        <ul className="mt-2 space-y-1">
          {result.advice.map((a) => (
            <li key={a} className="text-2xs leading-relaxed text-ink-mid">
              {a}
            </li>
          ))}
        </ul>
      )}
    </ChartFrame>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   5 · Delivery — live points against what the week promised
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Who is beating their brief.
 *
 * Every player carries a published expectation for the gameweek. Drawing the
 * expectation and the live score as two ends of one line makes the gap the
 * subject: a long line to the right is a player winning you the week, a long
 * line left is the one losing it.
 */
export function Delivery({ rows, expectedByElement }: { rows: SquadRow[]; expectedByElement: Record<number, number> }) {
  const xi = counting(rows)
    .map((r) => {
      const expected = (expectedByElement[r.element] ?? 0) * r.multiplier;
      return { r, expected, actual: contribution(r), delta: contribution(r) - expected };
    })
    .filter((d) => d.expected > 0 || d.actual > 0)
    .sort((a, b) => b.delta - a.delta);

  if (xi.length === 0) {
    return (
      <ChartFrame eyebrow="Delivery" title="Against expectation" ariaLabel="Live points against the published expectation">
        <p className="py-8 text-center text-sm text-ink-lo">
          No expectations published for this gameweek yet.
        </p>
      </ChartFrame>
    );
  }

  const W = 560;
  const rowH = 22;
  const H = xi.length * rowH + 44;
  const M = { top: 12, right: 54, bottom: 26, left: 96 };
  const max = Math.max(2, ...xi.map((d) => Math.max(d.expected, d.actual)));
  const x = (v: number) => M.left + ((W - M.left - M.right) * v) / max;

  const table = {
    headers: ["Player", "Expected", "Actual"],
    rows: xi.map((d) => [d.r.webName, d.expected.toFixed(1), d.actual]) as (string | number)[][],
  };

  return (
    <ChartFrame
      eyebrow="Delivery"
      title="Against expectation"
      ariaLabel="Each player's live points against the expectation published for this gameweek"
      caption="Hollow mark is what the week promised, filled mark is what he has actually put on the board — both counting the multiplier."
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {xi.map((d, i) => {
          const y = M.top + i * rowH + rowH / 2;
          const beat = d.delta >= 0;
          return (
            <g key={d.r.element}>
              <text x={M.left - 10} y={y + 4} textAnchor="end" fontSize="10" className="fill-(--ink-mid)">
                {d.r.webName}
              </text>
              <line
                x1={x(Math.min(d.expected, d.actual))}
                x2={x(Math.max(d.expected, d.actual))}
                y1={y}
                y2={y}
                stroke={beat ? "var(--surge)" : "var(--flare)"}
                strokeWidth="2.5"
                opacity={0.75}
              />
              <circle cx={x(d.expected)} cy={y} r="4" fill="var(--bg-raised)" stroke="var(--ink-lo)" strokeWidth="1.5">
                <title>{`${d.r.webName}: expected ${d.expected.toFixed(1)}`}</title>
              </circle>
              <circle cx={x(d.actual)} cy={y} r="4.5" fill={beat ? "var(--surge)" : "var(--flare)"}>
                <title>{`${d.r.webName}: ${d.actual} actual`}</title>
              </circle>
              <text
                x={W - M.right + 8}
                y={y + 4}
                fontSize="10"
                fontWeight="700"
                className={beat ? "fill-(--surge)" : "fill-(--flare)"}
              >
                {beat ? "+" : "−"}
                {Math.abs(d.delta).toFixed(1)}
              </text>
            </g>
          );
        })}
        <text x={M.left} y={H - 8} fontSize="10" className="fill-(--ink-lo)">
          Points this gameweek
        </text>
      </svg>
    </ChartFrame>
  );
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Branch labels read "Captaining Saka instead" — the verb is the same on every
 * row, so it earns no space. Keep the part that differs.
 */
function shortDecision(label: string): string {
  const trimmed = label
    .replace(/^Captaining\s+/i, "(C) ")
    .replace(/\s+instead$/i, "")
    .replace(/^Benching\s+/i, "Bench ");
  return trimmed.length > 30 ? `${trimmed.slice(0, 29)}…` : trimmed;
}
