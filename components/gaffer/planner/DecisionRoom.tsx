"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { Est } from "@/components/gaffer/Est";
import { compareDecision } from "@/lib/engines/decision";
import { PROJECTION_METHOD, type PlanMove, type PlannerGw, type PlannerPlayer } from "@/lib/engines/planner";
import { cn } from "@/lib/ui/cn";

const NAMES = { now: "Move now", wait: "Wait one week", hold: "Hold your squad" };
const METHOD = `${PROJECTION_METHOD} Cumulative player-point difference against keeping the outgoing players, minus transfer hits. Assumes all compared players score for you; no captaincy, bench optimisation, chips or future price changes.`;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;

export function DecisionRoom({ moves, playerOf, sellPriceOf, freeTransfers, bankTenths, gws }: {
  moves: PlanMove[];
  playerOf: (id: number) => PlannerPlayer | undefined;
  sellPriceOf: (id: number) => number;
  freeTransfers: number;
  bankTenths: number;
  gws: PlannerGw[];
}) {
  const [window, setWindow] = React.useState(3);
  const [factor, setFactor] = React.useState(100);
  const [table, setTable] = React.useState(false);
  const sliderId = React.useId();
  const weeks = Math.min(window, gws.length);
  const result = compareDecision({ moves, playerOf, freeTransfers, weeks, incomingFactor: factor / 100 });
  if (!moves.length) return null;
  if (!result) return <section id="decision-room" aria-label="Decision room" className="rounded-lg bg-raised card-ring p-4 text-sm text-ink-mid"><p>The decision comparison needs a complete projection for every staged player. Your transfers are saved.</p>{weeks > 1 && <button type="button" onClick={() => setWindow(1)} className="mt-2 min-h-11 text-volt">Try next gameweek only</button>}</section>;
  const committed = moves.reduce((sum, m) => sum + (playerOf(m.in)?.cost ?? 0) - sellPriceOf(m.out), 0);
  const points = [{ week: -1, now: -result.nowHit, wait: 0, hold: 0 }, ...result.rows];
  const all = points.flatMap((p) => [p.now, p.wait, 0]);
  const x = scaleLinear().domain([-1, weeks - 1]).range([42, 550]);
  const y = scaleLinear().domain([Math.min(...all, -1), Math.max(...all, 1)]).nice(4).range([164, 20]);
  const bestValue = result.best === "now" ? result.nowNet : result.best === "wait" ? result.waitNet! : 0;
  const paths = [
    { key: "now" as const, color: "var(--series-1)", dash: undefined },
    ...(weeks > 1 ? [{ key: "wait" as const, color: "var(--series-2)", dash: "7 5" }] : []),
    { key: "hold" as const, color: "var(--series-3)", dash: "2 5" },
  ];
  return (
    <section id="decision-room" aria-label="Decision room" className="decision-room scroll-mt-24 overflow-hidden rounded-lg bg-raised card-lift">
      <header className="has-gloss border-b border-hairline px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="upper-label text-2xs text-volt">The decision room</p>
          <div role="group" aria-label="Decision horizon" className="flex gap-1 rounded-md bg-sunk p-1">
            {[...new Set([1, Math.min(3, gws.length), Math.min(6, gws.length)])].filter((n) => n > 0 && n <= gws.length).map((n) => <button key={n} type="button" aria-pressed={weeks === n} onClick={() => setWindow(n)} className={cn("min-h-10 rounded-sm px-3 text-xs", weeks === n ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3")}><span className="fig-num">{n}</span> GW</button>)}
          </div>
        </div>
        <h3 className="mt-3 font-display text-2xl font-semibold italic tracking-tight text-ink-hi sm:text-3xl">Make the move earn its place.</h3>
        <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-ink-mid">Compare this plan with patience. Every path starts with your actual free transfers and includes the hit.</p>
      </header>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-3">
          {(["now", "wait", "hold"] as const).map((key) => {
            const value = key === "now" ? result.nowNet : key === "wait" ? result.waitNet : 0;
            return <div key={key} className={cn("rounded-md border p-3", result.best === key ? "border-volt bg-sunk" : "border-hairline")}>
              <p className="text-sm font-semibold text-ink-hi">{NAMES[key]}</p>
              <p className="fig-num my-2 text-3xl leading-none text-ink-hi">{value == null ? "—" : <Est method={METHOD}>{signed(value)}</Est>}</p>
              <p className="text-xs text-ink-lo">{key === "hold" ? "Your comparison baseline" : value == null ? "Needs at least two gameweeks" : `${key === "now" ? result.nowHit : result.waitHit} points in hits`}</p>
              <p className={cn("mt-3 text-2xs uppercase-label", result.best === key ? "text-volt" : "text-ink-lo")}>{result.best === key ? "Leads this scenario" : value == null ? "Outside this window" : "Points versus holding"}</p>
            </div>;
          })}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <figure className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <figcaption className="text-sm font-semibold text-ink-hi">When the move pays you back</figcaption>
            <button type="button" aria-pressed={table} onClick={() => setTable(!table)} className="min-h-11 rounded-md card-ring px-3 text-xs text-ink-mid hover:bg-surface-3">{table ? "Show chart" : "Show table"}</button>
          </div>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-mid">{paths.map((p) => <span key={p.key} className="inline-flex items-center gap-2"><svg width="24" height="8" aria-hidden><line x1="0" x2="24" y1="4" y2="4" stroke={p.color} strokeWidth="3" strokeDasharray={p.dash} /></svg>{NAMES[p.key]}</span>)}</div>
          {table ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Estimated cumulative player-point gains against holding, including hits</caption><thead><tr><th scope="col" className="py-3 font-medium text-ink-lo">Gameweek</th>{paths.map((p) => <th key={p.key} scope="col" className="px-2 py-3 font-medium text-ink-lo">{NAMES[p.key]}</th>)}</tr></thead><tbody>{result.rows.map((row) => <tr key={row.week} className="border-t border-hairline"><th scope="row" className="fig-num py-3 text-ink-mid">GW {gws[row.week].id}</th>{paths.map((p) => <td key={p.key} className="fig-num px-2 py-3 text-ink-hi"><Est method={METHOD}>{signed(row[p.key])}</Est></td>)}</tr>)}</tbody></table></div> :
            <svg viewBox="0 0 580 200" className="h-auto w-full overflow-visible" role="img" aria-label={`Estimated cumulative points versus holding. ${NAMES[result.best]} leads at ${signed(bestValue)} points over ${weeks} gameweeks. Solid blue: move now. Dashed orange: wait. Dotted green: hold. Transfer hits appear when paid.`}>
              {y.ticks(4).map((tick) => <g key={tick}><line x1="42" x2="550" y1={y(tick)} y2={y(tick)} stroke="var(--line)" /><text x="32" y={y(tick) + 4} textAnchor="end" fill="var(--ink-lo)" fontSize="12" className="fig-num">{tick}</text></g>)}
              {paths.map((p) => <path key={p.key} d={line<typeof points[number]>().x((r) => x(r.week)).y((r) => y(r[p.key]))(points)!} fill="none" stroke={p.color} strokeWidth="3" strokeDasharray={p.dash} />)}
              {points.map((r) => <text key={r.week} x={x(r.week)} y="190" textAnchor="middle" fill="var(--ink-lo)" fontSize="12" className="fig-num">{r.week < 0 ? "Now" : `GW ${gws[r.week].id}`}</text>)}
            </svg>}
          <p className="mt-2 text-xs leading-relaxed text-ink-lo">{result.paybackWeek == null ? "Moving now does not recover its cost within this window." : <>Moving now matches or beats holding from <Est method={METHOD}>{`GW ${gws[result.paybackWeek].id}`}</Est> through the end of this window.</>}</p>
        </figure>

        <div className="rounded-md bg-sunk p-4">
          <div className="flex items-start justify-between gap-3"><label htmlFor={sliderId} className="text-sm font-semibold text-ink-hi">What if the arrivals deliver less?</label><output htmlFor={sliderId} className="fig-num text-lg text-ink-hi">{factor}%</output></div>
          <p className="mt-1 text-xs leading-relaxed text-ink-lo">Adjust their projected points. This is your assumption, not a fitness rating or a confidence interval.</p>
          <input id={sliderId} type="range" min="50" max="150" step="5" value={factor} onChange={(e) => setFactor(Number(e.target.value))} className="mt-3 h-11 w-full accent-volt" />
          <div className="flex items-center justify-between text-xs text-ink-lo"><span>Half the projection</span><button type="button" onClick={() => setFactor(100)} className="min-h-11 px-2 text-volt">Reset to model</button><span>Half as much again</span></div>
          <p className="mt-2 text-xs leading-relaxed text-ink-mid">{result.breakEvenFactor == null ? "The arrivals have no projected points in this window, so there is no meaningful break-even percentage." : <>To justify moving now over holding, the arrivals need <Est method={METHOD}>{`${Math.ceil(result.breakEvenFactor * 100)}%`}</Est> of their original projection.</>}</p>
        </div>

        </div>

        <dl className="grid grid-cols-2 gap-4 border-t border-hairline pt-4">
          <div><dt className="text-xs text-ink-lo">{committed >= 0 ? "Extra money committed" : "Money released"}</dt><dd className="fig-num mt-1 text-xl text-ink-hi">£{(Math.abs(committed) / 10).toFixed(1)}m</dd><dd className="mt-1 text-xs text-ink-lo">£{((bankTenths - committed) / 10).toFixed(1)}m left after the moves</dd></div>
          <div><dt className="text-xs text-ink-lo">Next week’s flexibility</dt><dd className="fig-num mt-1 text-xl text-ink-hi">{result.nowNextFt} <span className="text-sm text-ink-lo">vs {result.holdNextFt} FT</span></dd><dd className="mt-1 text-xs text-ink-lo">Move now versus roll this week</dd></div>
        </dl>
        <details className="border-t border-hairline pt-4 text-xs text-ink-lo"><summary className="min-h-8 cursor-pointer text-ink-mid">What this comparison assumes</summary><p className="mt-2 leading-relaxed">{METHOD} Waiting means making every staged transfer next gameweek at today’s prices, with one additional free transfer (maximum five). Holding means making none. No other transfers are assumed. A chip plan needs separate evaluation.</p></details>
      </div>
    </section>
  );
}
