"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { Est } from "@/components/gaffer/Est";
import { EOScatter } from "@/components/charts/EOScatter";
import { PriceGauge } from "@/components/charts/PriceGauge";
import { FixtureSwing } from "@/components/charts/FixtureSwing";
import { DefconRate } from "@/components/charts/DefconRate";
import { XgVsActual } from "@/components/charts/XgVsActual";
import { DistributionCurve } from "@/components/charts/DistributionCurve";
import { SwingBars } from "@/components/charts/SwingBars";
import { ChipTimeline } from "@/components/charts/ChipTimeline";
import { Meter } from "@/components/charts/Meter";
import { ProbabilityBand } from "@/components/charts/ProbabilityBand";

/**
 * Every card the gaffer can answer with, in its own chunk.
 *
 * The Ask button lives in the app shell, so this module used to be on the
 * critical path of every single screen — ten chart components and the whole of
 * d3 downloaded and parsed before anybody had asked anything. It is loaded
 * when a card actually needs rendering instead.
 */

/** Registry-driven renderer — every branch is a grounded engine product. */
export function AskCard({
  component,
  props,
}: {
  component: string;
  props: Record<string, unknown>;
}) {
  return <>{renderCard(component, props)}</>;
}

function renderCard(component: string, props: Record<string, unknown>): React.ReactNode | null {
  switch (component) {
    case "exposure-scatter":
      return <EOScatter rows={props.rows as never} />;
    case "price-gauge": {
      if (Array.isArray(props.tonight)) {
        const rows = props.tonight as {
          element: number;
          name: string;
          pRise: number;
          direction: "up" | "down";
          net: number;
          covered: boolean;
        }[];
        return (
          <div className="rounded-lg bg-surface-1 card-ring p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="upper-label text-2xs text-ink-lo">Tonight — pressure watch</div>
              <div className="text-2xs text-ink-lo num-tabular">
                {typeof props.todayRises === "number" && typeof props.todayFalls === "number"
                  ? `today ${props.todayRises}↑ · ${props.todayFalls}↓`
                  : (props.scope as string) ?? ""}
              </div>
            </div>
            <ul className="mt-2 space-y-1.5">
              {rows.map((r) => (
                <li key={r.element} className={cn("flex items-center justify-between gap-3 text-sm", !r.covered && "opacity-50")}>
                  <span className="text-ink-hi">{r.name}</span>
                  <span className="flex items-center gap-2">
                    {r.covered ? (
                      <span
                        className={cn(
                          "fig-num text-xs",
                          r.direction === "up" ? "text-surge" : "text-flare",
                        )}
                      >
                        {r.direction === "up" ? "↑" : "↓"}{" "}
                        <Est method="rise model on stored hourly snapshots — an estimate">
                          {`${Math.round(r.pRise * 100)}%`}
                        </Est>
                      </span>
                    ) : (
                      <span className="text-2xs text-ink-lo">no history yet</span>
                    )}
                    <span className="w-16 text-right fig-num text-xs text-ink-mid">
                      {(r.net >= 0 ? "+" : "−") +
                        Math.abs(Math.round(r.net)).toLocaleString("en-GB")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-2xs leading-relaxed text-ink-lo">
              Ranked by modelled probability of a price move before the deadline
              {typeof props.scope === "string" ? ` — ${props.scope}` : ""}.
            </p>
          </div>
        );
      }
      return <PriceGauge {...(props as React.ComponentProps<typeof PriceGauge>)} />;
    }
    case "fixture-run":
      return <FixtureSwing {...(props as React.ComponentProps<typeof FixtureSwing>)} />;
    case "defcon-check":
      return <DefconRate {...(props as React.ComponentProps<typeof DefconRate>)} />;
    case "xg-vs-actual":
      return <XgVsActual {...(props as React.ComponentProps<typeof XgVsActual>)} />;
    case "rank-projection":
      return (
        <DistributionCurve
          bins={props.bins as { x: number; y: number }[]}
          yourScore={(props.yourScore as number) ?? 0}
          ariaLabel="Field score distribution with your score marked"
        />
      );
    case "swing-impact":
      return <SwingBars rows={props.rows as never} ariaLabel="Rank impact by event" />;
    case "chip-timeline":
      return props.plays ? (
        <ChipTimeline plays={props.plays as never} gwRange={props.gwRange as [number, number]} />
      ) : null;
    case "captain-compare": {
      const rows = props.rows as { name: string; epNext: number; eo: number }[];
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="upper-label text-2xs text-ink-lo">Captaincy board</div>
          <table className="mt-2 w-full text-sm num-tabular">
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-hairline last:border-0">
                  <td className="py-1.5 text-ink-hi">{r.name}</td>
                  <td className="py-1.5 text-right fig-num">{r.epNext}</td>
                  <td className="w-24 py-1.5 pl-3">
                    <span className="fig-num text-xs text-ink-lo">{r.eo.toFixed(0)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "injury-list": {
      const players = props.players as {
        name: string;
        news: string;
        status: string;
        chance: number | null;
      }[];
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="upper-label text-2xs text-ink-lo">Availability desk</div>
          <ul className="mt-2 space-y-1.5">
            {players.map((p) => (
              <li key={p.name} className="text-sm">
                <span className="font-medium text-ink-hi">{p.name}</span>{" "}
                <span className="text-flare">{p.news}</span>
                {p.chance != null && <span className="ml-1 text-xs text-ink-lo">({p.chance}% to play)</span>}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "news-search": {
      const items = props.items as { title: string; url: string; source: string }[];
      return (
        <ul className="space-y-1.5 rounded-lg bg-surface-1 card-ring p-4 text-sm">
          {items.map((i) => (
            <li key={i.url}>
              <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-ink-hi hover:text-volt">
                {i.title}
              </a>{" "}
              <span className="text-2xs uppercase-label text-ink-lo">{i.source}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "transfer-sim":
      return null; // prose carries the verdict; ledger maths lives on the Board
    case "effective-bets":
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <Meter
            value={props.value as number}
            label={(props.label as string) ?? "Effective bets"}
            hint={props.hint as string}
          />
          <p className="mt-2 text-2xs leading-relaxed text-ink-lo">
            Participation ratio of your squad&apos;s simulated correlation matrix — 11 means fully
            independent bets, lower means stacking.
          </p>
        </div>
      );
    case "true-form":
      return (
        <ProbabilityBand
          points={props.points as never}
          xLabel="Gameweek"
          ariaLabel="Kalman-filtered per-90 contribution with uncertainty band"
        />
      );
    case "squad-generator": {
      const players = props.players as {
        elementId: number; webName: string; posLabel: string; cost: number; epNext: number | null;
      }[];
      const totalCost = props.totalCost as number;
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="flex items-baseline justify-between">
            <div className="upper-label text-2xs text-ink-lo">Generated 15</div>
            <div className="fig-num text-sm text-ink-hi">£{(totalCost / 10).toFixed(1)}m</div>
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-3">
            {players.map((p) => (
              <li key={p.elementId} className="flex items-baseline justify-between gap-2 rounded-md bg-surface-0 px-2.5 py-2 card-ring">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-hi">{p.webName}</span>
                  <span className="text-2xs uppercase-label text-ink-lo">{p.posLabel}</span>
                </span>
                <span className="text-right num-tabular">
                  <span className="fig-num block text-xs text-ink-hi">£{(p.cost / 10).toFixed(1)}</span>
                  <span className="block text-2xs text-ink-lo">{p.epNext ?? "—"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "transfer-watch": {
      const players = props.players as { name: string; epNext: number | null; cost: number; flagged: boolean; news: string }[];
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="upper-label text-2xs text-ink-lo">Weakest projected links</div>
          <ul className="mt-2 divide-y divide-hairline">
            {players.map((p) => (
              <li key={p.name} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-sm font-medium text-ink-hi">
                  {p.name}
                  {p.flagged && <span className="ml-2 text-2xs uppercase-label text-flare">flagged</span>}
                </span>
                <span className="num-tabular text-xs text-ink-lo">
                  {p.epNext ?? "—"} pts · £{(p.cost / 10).toFixed(1)}m
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "chip-timing": {
      const gws = props.gws as number[];
      const payoffs = props.payoffs as number[];
      const exerciseIndex = props.exerciseIndex as number;
      const best = Math.max(...payoffs, 1);
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="upper-label text-2xs text-ink-lo">Projected payoff by week</div>
          <ul className="mt-3 space-y-1.5">
            {gws.map((gw, i) => (
              <li key={gw} className="flex items-center gap-3">
                <span className={cn("w-12 text-xs num-tabular", i === exerciseIndex ? "font-semibold text-volt" : "text-ink-mid")}>
                  GW{gw}
                </span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(payoffs[i] / best) * 100}%`, background: i === exerciseIndex ? "var(--volt)" : "var(--seq-400)" }}
                  />
                </span>
                <span className="w-10 text-right fig-num text-xs text-ink-mid">{payoffs[i]}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "crowding": {
      const rows = props.rows as {
        posLabel: string; effectivePicks: number; players: number; topName: string | null; topShare: number;
      }[];
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="upper-label text-2xs text-ink-lo">Effective picks by position</div>
          <table className="mt-2 w-full text-sm num-tabular">
            <tbody>
              {rows.map((r) => (
                <tr key={r.posLabel} className="border-b border-hairline last:border-0">
                  <td className="py-1.5 text-ink-hi">{r.posLabel}</td>
                  <td className="py-1.5 text-right fig-num">{r.effectivePicks.toFixed(1)}</td>
                  <td className="w-28 py-1.5 pl-3 text-right text-xs text-ink-lo">
                    {r.topName != null ? `${r.topName} ${Math.round(r.topShare * 100)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-2xs leading-relaxed text-ink-lo">
            1/HHI over the field&apos;s ownership shares — low means the market collapsed onto
            one template, high means genuine disagreement to attack.
          </p>
        </div>
      );
    }
    case "wpa": {
      const winProb = props.winProb as number;
      const rivalName = props.rivalName as string;
      const moments = props.moments as { name: string; side: "you" | "them"; wpa: number }[];
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="flex items-baseline justify-between">
            <div className="upper-label text-2xs text-ink-lo">Win probability</div>
            <div className="text-2xs uppercase-label text-ink-lo">vs {rivalName}</div>
          </div>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-l-full" style={{ width: `${winProb}%`, background: "var(--surge)" }} />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="fig-num text-sm text-surge">{winProb}%</span>
            <span className="text-2xs text-ink-lo">paired simulations — shared fixtures drawn once</span>
          </div>
          <ul className="mt-3 space-y-1">
            {moments.map((m) => (
              <li key={`${m.side}-${m.name}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-hi">
                  {m.name}
                  <span className="ml-1.5 text-2xs uppercase-label text-ink-lo">{m.side === "you" ? "yours" : "theirs"}</span>
                </span>
                <span className={`fig-num text-xs ${m.wpa >= 0 ? "text-surge" : "text-flare"}`}>
                  {m.wpa >= 0 ? "+" : "−"}{Math.abs(m.wpa).toFixed(1)}pp
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "twin-study": {
      const arms = props.arms as { arm: string; n: number; mean: number; median: number }[];
      const n = props.n as number;
      const reliable = props.reliable as boolean;
      const best = arms.length ? Math.max(...arms.map((a) => a.mean)) : 0;
      return (
        <div className={cn("rounded-lg bg-surface-1 card-ring p-4", !reliable && "opacity-60")}>
          <div className="flex items-baseline justify-between">
            <div className="upper-label text-2xs text-ink-lo">Twin study — observational</div>
            <div className="text-2xs text-ink-lo num-tabular">n = {n.toLocaleString("en-GB")}{reliable ? "" : " · thin"}</div>
          </div>
          <ul className="mt-2 space-y-1.5">
            {arms.map((a) => (
              <li key={a.arm} className="flex items-center gap-3">
                <span className="w-16 text-xs uppercase-label text-ink-mid">{a.arm}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${best > 0 ? (a.mean / best) * 100 : 0}%`, background: "var(--series-1)" }}
                  />
                </span>
                <span className="w-16 text-right fig-num text-xs text-ink-hi">{a.mean.toFixed(1)}</span>
                <span className="w-14 text-right text-2xs text-ink-lo num-tabular">n={a.n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-2xs leading-relaxed text-ink-lo">
            Managers with near-identical squads and bank, split by the decision they actually
            made. Observational — selection is visible in the arms, not controlled.
          </p>
        </div>
      );
    }
    default:
      return null;
  }
}
