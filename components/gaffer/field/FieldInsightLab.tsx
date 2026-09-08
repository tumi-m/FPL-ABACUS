"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { scaleLinear } from "d3-scale";
import { Est } from "@/components/gaffer/Est";
import { PlayerAvatar, useAvatarMode } from "@/components/gaffer/PlayerAvatar";
import { useMeasure } from "@/lib/charts/useMeasure";
import { FIELD_INSIGHTS, fieldInsightPoints, type InsightKey } from "@/lib/engines/fieldInsights";
import type { PerfPlayer } from "@/lib/engines/performance";
import { cn } from "@/lib/ui/cn";

interface SeasonResponse { season: PerfPlayer[]; currentGw: number }

/** Shares the stat-board cache with CreationScatter. One request when near
 * the viewport, never five upstream requests or five eagerly rendered plots.
 */
export function FieldInsightLab({ mine }: { mine: number[] }) {
  const host = React.useRef<HTMLElement>(null);
  const [near, setNear] = React.useState(false);
  const [key, setKey] = React.useState<InsightKey>("value");
  React.useEffect(() => {
    if (!host.current || near) return;
    if (typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setNear(true);
    }, { rootMargin: "400px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [near]);
  const { data, error, mutate } = useSWR<SeasonResponse>(
    near ? "/api/gaffer/boards?board=top" : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Season statistics unavailable");
      return response.json();
    },
    { revalidateOnFocus: false, dedupingInterval: 120_000 },
  );

  return (
    <section id="field-scouting-lens" ref={host} aria-label="Five angles on the Field" className="scroll-mt-24 space-y-5">
      <div className="planner-intro rounded-lg card-lift p-5 sm:p-6">
        <p className="upper-label text-2xs text-volt">The scouting lens · five new angles</p>
        <h2 className="mt-2 font-display text-2xl font-semibold italic tracking-tight text-ink-hi sm:text-3xl">The points tell one story. Look closer.</h2>
        <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-ink-mid">Explore the trade-offs behind a player’s returns. Every dot is a player, every axis names its unit, and your selected squad stays in view.</p>
      </div>
      <div role="group" aria-label="Scouting charts" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {FIELD_INSIGHTS.map((chart, i) => (
          <button key={chart.key} type="button" aria-pressed={key === chart.key} onClick={() => setKey(chart.key)} className={cn("flex min-h-14 items-center gap-3 rounded-md px-4 text-left text-sm transition-colors motion-reduce:transition-none", key === chart.key ? "bg-volt font-semibold text-on-accent" : "bg-raised text-ink-mid card-ring hover:bg-surface-3")}>
            <span className="fig-num text-lg opacity-70" aria-hidden>0{i + 1}</span>{chart.label}
          </button>
        ))}
      </div>
      {data ? <InsightChart key={key} chartKey={key} players={data.season} mine={mine} /> : (
        <div className="rounded-lg bg-raised card-ring p-8 text-sm text-ink-mid" role="status">
          {error ? <>Season statistics are unavailable. <button type="button" onClick={() => void mutate()} className="min-h-11 px-2 text-volt">Try again</button></> : "Loading the season’s evidence…"}
        </div>
      )}
      <details className="rounded-md bg-sunk card-ring px-4 py-3 text-xs text-ink-lo">
        <summary className="min-h-8 cursor-pointer text-ink-mid">Sources, definitions and what these charts can tell you</summary>
        <p className="mt-2 max-w-[85ch] leading-relaxed">Data comes from the official FPL season feed through GAFFER’s shared cache. These are current-season snapshots, even when you are viewing an earlier gameweek. Per-90 rates use the minutes actually played; they are not forecasts of playing time. Hollow dots have fewer than 450 minutes. Zero-minute players are excluded. The sample filter applies equally to both axes.</p>
        <p className="mt-3 max-w-[85ch] leading-relaxed">The analysis is informed by Opta’s distinction between recorded events and expected outcomes, SofaScore’s player comparisons, and the underlying-stat and position-comparison approaches used by Fantasy Football Hub and Fantasy Football Scout. These services are methodological references, not connected data feeds or endorsements.</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
          <a className="text-volt underline" href="https://www.premierleague.com/en/news/2683145" target="_blank" rel="noreferrer">FPL glossary</a>
          <a className="text-volt underline" href="https://www.statsperform.com/opta-event-definitions/" target="_blank" rel="noreferrer">Opta definitions</a>
          <a className="text-volt underline" href="https://www.sofascore.com/en-us/football/player/compare?leftPlayerId=866385" target="_blank" rel="noreferrer">SofaScore comparisons</a>
          <a className="text-volt underline" href="https://www.fantasyfootballhub.co.uk/player-profile" target="_blank" rel="noreferrer">Hub player profiles</a>
          <a className="text-volt underline" href="https://www.fantasyfootballscout.co.uk/how-to-use-the-comparison-tool-in-the-members-area" target="_blank" rel="noreferrer">Scout comparisons</a>
        </div>
      </details>
    </section>
  );
}

function InsightChart({ chartKey, players, mine }: { chartKey: InsightKey; players: PerfPlayer[]; mine: number[] }) {
  const chart = FIELD_INSIGHTS.find((c) => c.key === chartKey)!;
  const [minimum, setMinimum] = React.useState(90);
  const [pos, setPos] = React.useState(0);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [showTable, setShowTable] = React.useState(false);
  const [avatar] = useAvatarMode();
  const [measure, { width }] = useMeasure<HTMLDivElement>();
  const points = React.useMemo(() => fieldInsightPoints(players, chartKey, minimum, pos), [players, chartKey, minimum, pos]);
  const owned = React.useMemo(() => new Set(mine), [mine]);
  const selected = points.find((p) => p.player.id === picked) ?? points.find((p) => owned.has(p.player.id)) ?? points[0];
  const ordered = [...points].sort((a, b) => Number(owned.has(b.player.id)) - Number(owned.has(a.player.id)) || a.player.name.localeCompare(b.player.name) || a.player.id - b.player.id);
  const w = Math.max(280, width);
  const h = 340;
  const x = scaleLinear().domain([Math.min(0, ...points.map((p) => p.x)), Math.max(1, ...points.map((p) => p.x))]).nice(4).range([60, w - 20]);
  const y = scaleLinear().domain([Math.min(0, ...points.map((p) => p.y)), Math.max(1, ...points.map((p) => p.y))]).nice(4).range([h - 62, 22]);
  const value = (n: number, estimated: boolean) => estimated ? <Est method={chart.method}>{n.toFixed(2)}</Est> : n.toFixed(2);
  const tick = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1);
  const selectClass = "min-h-11 min-w-0 rounded-md border border-hairline bg-sunk px-3 text-sm text-ink-hi";

  return (
    <article className="overflow-hidden rounded-lg bg-raised card-lift" aria-label={chart.label}>
      <header className="border-b border-hairline p-5 sm:p-6">
        <h3 className="font-display text-xl font-semibold italic text-ink-hi sm:text-2xl">{chart.title}</h3>
        <p className="mt-2 max-w-[80ch] text-sm leading-relaxed text-ink-mid">{chart.read}</p>
      </header>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-ink-lo">Minimum minutes
            <select aria-label="Minimum minutes" className={selectClass} value={minimum} onChange={(event) => setMinimum(Number(event.target.value))}>
              {[90, 450, 900, 1800].map((n) => <option key={n} value={n}>{n} minutes</option>)}
            </select>
          </label>
          {chartKey !== "keepers" && <label className="flex flex-col gap-1 text-xs text-ink-lo">Compare position
            <select aria-label="Compare position" className={selectClass} value={pos} onChange={(event) => setPos(Number(event.target.value))}>
              <option value={0}>{chartKey === "value" || chartKey === "workload" ? "All outfield" : "All positions"}</option>
              {chartKey !== "value" && chartKey !== "workload" && <option value={1}>Goalkeepers</option>}
              <option value={2}>Defenders</option><option value={3}>Midfielders</option><option value={4}>Forwards</option>
            </select>
          </label>}
          <button type="button" aria-pressed={showTable} onClick={() => setShowTable(!showTable)} className="ml-auto min-h-11 rounded-md card-ring px-4 text-sm text-ink-mid hover:bg-surface-3">{showTable ? "Show chart" : "Show table"}</button>
        </div>
        <div className="my-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-mid">
          <span><span aria-hidden className="mr-2 inline-block size-2.5 rounded-full bg-series-1" />Selected squad</span>
          <span><span aria-hidden className="mr-2 inline-block size-2.5 rounded-full bg-series-2" />Other players</span>
          <span>○ Under 450 minutes</span>
          <span className="fig-num ml-auto">{points.length} players · {minimum}+ mins</span>
        </div>
        {points.length === 0 ? <p role="status" className="rounded-md bg-sunk px-5 py-12 text-center text-sm text-ink-mid">No players meet this sample and position filter. Try fewer minutes or another position.</p> : (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div ref={measure} className="min-w-0">
              {showTable ? <div className="max-h-96 overflow-auto rounded-md border border-hairline">
                <table className="w-full text-left text-xs"><caption className="sr-only">{chart.title} Source: official FPL season statistics.</caption>
                  <thead className="sticky top-0 bg-raised"><tr><th scope="col" className="p-3 text-ink-lo">Player</th><th scope="col" className="p-3 text-ink-lo">{chart.xLabel}</th><th scope="col" className="p-3 text-ink-lo">{chart.yLabel}</th><th scope="col" className="p-3 text-ink-lo">Minutes</th></tr></thead>
                  <tbody>{ordered.map((point) => <tr key={point.player.id} className="border-t border-hairline"><th scope="row" className="p-3 font-medium text-ink-hi">{point.player.name} <span className="text-ink-lo">{point.player.code}</span></th><td className="fig-num p-3 text-ink-mid">{value(point.x, chart.xEstimated)}</td><td className="fig-num p-3 text-ink-mid">{value(point.y, chart.yEstimated)}</td><td className="fig-num p-3 text-ink-mid">{point.player.minutes}</td></tr>)}</tbody>
                </table>
              </div> : <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${chart.title} X axis: ${chart.xLabel}. Y axis: ${chart.yLabel}. ${points.length} players with at least ${minimum} minutes. Blue marks identify your selected squad; orange marks the rest. Hollow marks have fewer than 450 minutes. Use the player selector for exact values.`}>
                {y.ticks(4).map((n) => <g key={n}><line x1="60" x2={w - 20} y1={y(n)} y2={y(n)} stroke="var(--line)" /><text x="49" y={y(n) + 4} textAnchor="end" fill="var(--ink-lo)" fontSize="11" className="fig-num">{tick(n)}</text></g>)}
                {x.ticks(w < 400 ? 3 : 5).map((n) => <text key={n} x={x(n)} y={h - 42} textAnchor="middle" fill="var(--ink-lo)" fontSize="11" className="fig-num">{tick(n)}</text>)}
                <line x1="60" x2={w - 20} y1={y(0)} y2={y(0)} stroke="var(--line-hi)" />
                {[...points].sort((a, b) => Number(owned.has(a.player.id)) - Number(owned.has(b.player.id))).map((point) => {
                  const color = owned.has(point.player.id) ? "var(--series-1)" : "var(--series-2)";
                  return <circle key={point.player.id} cx={x(point.x)} cy={y(point.y)} r={owned.has(point.player.id) ? 5 : 3.5} fill={point.smallSample ? "var(--bg-raised)" : color} stroke={color} strokeWidth="1.5" onClick={() => setPicked(point.player.id)} className="cursor-pointer"><title>{`${point.player.name} (${point.player.code}): ${chart.xShort} ${point.x.toFixed(2)}; ${chart.yShort} ${point.y.toFixed(2)}; ${point.player.minutes} minutes`}</title></circle>;
                })}
                {selected && <circle cx={x(selected.x)} cy={y(selected.y)} r="9" fill="none" stroke="var(--ink-hi)" strokeWidth="2" pointerEvents="none" />}
                <text x={(60 + w - 20) / 2} y={h - 12} textAnchor="middle" fill="var(--ink-mid)" fontSize="11">{chart.xLabel}</text>
                <text transform={`translate(14 ${(h - 40) / 2}) rotate(-90)`} textAnchor="middle" fill="var(--ink-mid)" fontSize="11">{chart.yLabel}</text>
              </svg>}
              <p className="mt-3 text-xs leading-relaxed text-ink-lo">{chart.method}</p>
            </div>
            <aside className="min-w-0 rounded-md bg-sunk p-4">
              <label className="flex flex-col gap-2 text-xs text-ink-lo">Inspect a player
                <select aria-label="Inspect a player" value={selected?.player.id ?? ""} onChange={(event) => setPicked(Number(event.target.value))} className={selectClass}>
                  {ordered.map((point) => <option key={point.player.id} value={point.player.id}>{point.player.name} · {point.player.code}{owned.has(point.player.id) ? " · your squad" : ""}</option>)}
                </select>
              </label>
              {selected && <div className="mt-5" aria-live="polite">
                <div className="flex items-center gap-3"><div className="h-14 w-12 shrink-0"><PlayerAvatar photo={selected.player.photo} teamId={selected.player.teamId} mode={avatar} /></div><div className="min-w-0"><p className="font-semibold text-ink-hi">{selected.player.name}</p><p className="text-xs text-ink-lo">{selected.player.code} · {owned.has(selected.player.id) ? "Your selected squad" : "Elsewhere in the league"}</p></div></div>
                <dl className="mt-5 space-y-4"><div><dt className="text-xs text-ink-lo">{chart.xLabel}</dt><dd className="fig-num mt-1 text-2xl text-ink-hi">{value(selected.x, chart.xEstimated)}</dd></div><div><dt className="text-xs text-ink-lo">{chart.yLabel}</dt><dd className="fig-num mt-1 text-2xl text-ink-hi">{value(selected.y, chart.yEstimated)}</dd></div></dl>
                <p className="mt-5 text-xs leading-relaxed text-ink-mid"><span className="fig-num">{selected.player.minutes.toLocaleString("en-GB")}</span> season minutes. {selected.smallSample ? "Small sample: a single match can move this rate sharply." : "A larger sample gives more context; role and fixtures can still change."}</p>
                <Link href={`/players/${selected.player.id}`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-volt">Open player profile <span aria-hidden>↗</span></Link>
              </div>}
            </aside>
          </div>
        )}
      </div>
    </article>
  );
}
