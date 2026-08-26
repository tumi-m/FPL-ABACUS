"use client";

import * as React from "react";
import useSWR from "swr";
import { scaleLinear } from "d3-scale";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { cn } from "@/lib/ui/cn";
import { POSITION_SHORT } from "@/lib/ui/format";
import type { PerfPlayer } from "@/lib/engines/performance";

/**
 * The league on one pair of axes: how much a player creates against everything
 * he is expected to be involved in.
 *
 * A note on what this is and is not. The broadcast version plots chances
 * created from open play against total chances created, and FPL publishes
 * neither: chances created is Opta's, and nothing in the API splits creation
 * into open play and dead balls. Inventing that split would give the chart a
 * shape it has not earned.
 *
 * What FPL does publish is expected assists — the summed value of the chances
 * a player's passes produced — and expected goal involvements, which is that
 * plus his own expected goals. So the geometry survives with real numbers: y
 * is a part of x, every point sits under the diagonal, and where it sits says
 * what kind of player he is.
 *
 *   On the diagonal   everything he threatens with, he makes for someone else
 *   On the floor      he takes his own chances and creates nothing
 *   Far from zero     he does plenty of it, whichever kind
 *
 * The one piece of the dead-ball question FPL will answer is *who takes them*.
 * A ringed dot is his club's first-choice corner or free-kick taker, so a
 * share of that creation began from a stopped ball — which is the read the
 * broadcast chart exists to give, arrived at the only way the data allows.
 * When FPL omits the fields nothing is ringed and the legend says nothing.
 *
 * The league costs a request, so it is fetched when the chart comes into view
 * and not before. The endpoint is the one the stat boards already use, so
 * opening Top first warms it and this arrives instantly.
 */

const DOT = 3.2;
const NAMED = 5.4;

/** How many of the leaders get a name. Past thirty the labels are a wall. */
const CUTS = [15, 30, 0] as const;
type Cut = (typeof CUTS)[number];
const cutLabel = (c: Cut) => (c === 0 ? "All" : `Top ${c}`);

type PosFilter = 0 | 2 | 3 | 4;
const POS_FILTERS: { id: PosFilter; label: string }[] = [
  { id: 0, label: "All" },
  { id: 2, label: "Def" },
  { id: 3, label: "Mid" },
  { id: 4, label: "Fwd" },
];

interface BoardTop {
  currentGw: number;
  season: PerfPlayer[];
}

/**
 * Render nothing heavy until the reader is nearly here.
 *
 * The charts above this one are drawn from data the page already has. This one
 * is not, and a Field visit that stops at the pitch should not pay for a
 * request it never sees the result of.
 */
function useNearViewport<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [near, setNear] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  return [ref, near] as const;
}

interface Point {
  id: number;
  name: string;
  pos: number;
  total: number;
  creating: number;
  minutes: number;
  owned: boolean;
  deadBall: boolean;
  /** Named and drawn large — one of the leaders under this filter. */
  lead: boolean;
}

export function CreationScatter({ mine }: { mine: number[] }) {
  const [host, near] = useNearViewport<HTMLDivElement>();
  const [cut, setCut] = React.useState<Cut>(15);
  const [pos, setPos] = React.useState<PosFilter>(0);

  const { data, isLoading, error } = useSWR<BoardTop>(
    near ? "/api/gaffer/boards?board=top" : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as BoardTop;
    },
    { revalidateOnFocus: false, dedupingInterval: 120_000 },
  );

  const mineSet = React.useMemo(() => new Set(mine), [mine]);

  const points = React.useMemo<Point[]>(() => {
    const all = data?.season ?? [];
    const eligible = all
      .filter((p) => pos === 0 || p.pos === pos)
      .filter((p) => Number.isFinite(p.xgi) && Number.isFinite(p.xa) && p.xgi > 0 && p.xa >= 0)
      /* Ranked by involvement, which is what makes a player worth naming. It
         also does the job the minutes floor used to: nobody reaches the top of
         this list on a cameo, so the control for it came off. */
      .sort((a, b) => b.xgi - a.xgi);

    const shown = cut === 0 ? eligible : eligible.slice(0, cut);
    const leaders = new Set(eligible.slice(0, cut === 0 ? 15 : cut).map((p) => p.id));

    return shown
      .map((p) => ({
        id: p.id,
        name: p.name,
        pos: p.pos,
        /* xGI is xG plus xA, so xA cannot exceed it and the diagonal is a real
           ceiling. FPL rounds the two independently, though, and a point a
           hair above a line labelled "all creation" would be the chart telling
           a small lie — so the total is floored at the part it contains. */
        total: Math.max(p.xgi, p.xa),
        creating: p.xa,
        minutes: p.minutes,
        owned: mineSet.has(p.id),
        deadBall: p.deadBall === 1,
        lead: leaders.has(p.id),
      }))
      // named and owned dots draw last, on top of the crowd rather than under
      .sort((a, b) => Number(a.lead) - Number(b.lead) || Number(a.owned) - Number(b.owned));
  }, [data, cut, pos, mineSet]);

  const named = points.filter((p) => p.lead).length;
  const anyDeadBall = points.some((p) => p.deadBall);

  return (
    <div ref={host}>
      <ChartFrame
        eyebrow="The league"
        title="Creating, against everything he does"
        ariaLabel="Scatter of expected assists against expected goal involvements for every player in the league"
        caption="Creating is part of the total rather than separate from it, so nobody can sit above the line y = x. The higher a player is, the more of his threat he makes for somebody else; the lower, the more of it he takes himself."
        legend={
          <Controls
            cut={cut}
            onCut={setCut}
            pos={pos}
            onPos={setPos}
            count={points.length}
            named={named}
          />
        }
        table={
          points.length > 0
            ? {
                headers: ["Player", "xGI", "xA", "Creating share", "Mins"],
                rows: [...points]
                  .sort((a, b) => b.creating - a.creating)
                  .slice(0, 40)
                  .map((p) => [
                    p.name,
                    p.total.toFixed(2),
                    p.creating.toFixed(2),
                    `${Math.round((p.creating / p.total) * 100)}%`,
                    p.minutes,
                  ]) as (string | number)[][],
              }
            : undefined
        }
      >
        {!near || isLoading ? (
          <div className="h-[340px] animate-pulse rounded-md bg-surface-3/40" />
        ) : error ? (
          <p className="py-16 text-center text-sm text-ink-lo">
            The league board did not answer. It will try again when you come back.
          </p>
        ) : points.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-lo">
            Nobody has an expected involvement yet — come back a gameweek or two in.
          </p>
        ) : (
          <Plot points={points} anyDeadBall={anyDeadBall} />
        )}
      </ChartFrame>
    </div>
  );
}

function Controls({
  cut,
  onCut,
  pos,
  onPos,
  count,
  named,
}: {
  cut: Cut;
  onCut: (c: Cut) => void;
  pos: PosFilter;
  onPos: (p: PosFilter) => void;
  count: number;
  named: number;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
      <div role="group" aria-label="Position" className="flex gap-1 rounded-md glass-edge p-1">
        {POS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onPos(f.id)}
            aria-pressed={pos === f.id}
            className={cn(
              "skewed rounded-sm px-2.5 py-1 text-2xs uppercase-label transition-colors dur-instant",
              pos === f.id ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
            )}
          >
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      <div role="group" aria-label="How many" className="flex gap-1 rounded-md glass-edge p-1">
        {CUTS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onCut(c)}
            aria-pressed={cut === c}
            title={
              c === 0
                ? "Every player, with the fifteen leaders named"
                : `The ${c} highest expected involvements, all named`
            }
            className={cn(
              "skewed rounded-sm px-2.5 py-1 text-2xs uppercase-label transition-colors dur-instant",
              cut === c ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
            )}
          >
            <span>{cutLabel(c)}</span>
          </button>
        ))}
      </div>

      <p className="ml-auto text-2xs text-ink-lo num-tabular">
        {count} plotted{count > named ? ` · ${named} named` : ""}
      </p>
    </div>
  );
}

const W = 560;
const H = 360;
const M = { top: 16, right: 20, bottom: 44, left: 46 };

/**
 * Keep the names apart.
 *
 * Leaders bunch along the floor of the chart, so their labels land on each
 * other. Walking them in draw order and trying a few offsets — above the dot
 * first, then below, then further out — separates a couple of dozen without a
 * layout solver. A label that still cannot fit is dropped rather than printed
 * on top of one that did: an unreadable pile of names is worse than a dot you
 * can hover.
 */
/**
 * A window around the values, padded, never running below zero.
 *
 * A tenth of the range either side keeps the extremes off the axis lines. A
 * column where everybody has the same figure would collapse to a point, so it
 * falls back to a small span around the value.
 */
function frame(values: number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo;
  const pad = span > 0 ? span * 0.1 : Math.max(0.05, Math.abs(hi) * 0.1);
  return [Math.max(0, lo - pad), hi + pad];
}

function placeLabels(pts: { x: number; y: number }[]): (number | null)[] {
  const placed: { x: number; y: number }[] = [];
  const NEAR_X = 46;
  const NEAR_Y = 11;
  return pts.map((p) => {
    for (const dy of [-9, 14, -21, 26]) {
      const at = { x: p.x, y: p.y + dy };
      const clash = placed.some(
        (q) => Math.abs(q.x - at.x) < NEAR_X && Math.abs(q.y - at.y) < NEAR_Y,
      );
      if (!clash) {
        placed.push(at);
        return dy;
      }
    }
    return null;
  });
}

function Plot({ points, anyDeadBall }: { points: Point[]; anyDeadBall: boolean }) {
  /*
   * Both axes frame the data, not the origin.
   *
   * Neither quantity has a meaningful zero to anchor to — nobody is at the
   * origin except players who have not kicked a ball — and on a Top 15 the
   * fifteen highest involvements in the league sit in one corner with four
   * fifths of the canvas below them proving they are not beginners. Framing to
   * the range spreads them out, which is the only way the thing the chart is
   * actually for — how high above the floor a player sits — is readable.
   *
   * The diagonal survives it. y = x is a locus, not a corner: it holds
   * wherever the window is, and it is drawn as whatever segment of itself
   * falls inside the visible box.
   */
  const [xLo, xHi] = frame(points.map((p) => p.total));
  const [yLo, yHi] = frame(points.map((p) => p.creating));
  const x = scaleLinear().domain([xLo, xHi]).range([M.left, W - M.right]);
  const y = scaleLinear().domain([yLo, yHi]).range([H - M.bottom, M.top]);

  const leaders = points.filter((p) => p.lead);
  const offsets = placeLabels(leaders.map((p) => ({ x: x(p.total), y: y(p.creating) })));


  // the run of y = x that is on screen, if any of it is
  const dLo = Math.max(xLo, yLo);
  const dHi = Math.min(xHi, yHi);
  const diagonal = dHi > dLo;
  const angle = diagonal ? (Math.atan2(y(dLo) - y(dHi), x(dHi) - x(dLo)) * 180) / Math.PI : 0;
  const mid = dLo + (dHi - dLo) * 0.55;
  const lx = x(mid);
  const ly = y(mid) - 7;

  return (
    <>
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {y.ticks(5).map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={M.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">
              {t}
            </text>
          </g>
        ))}
        {x.ticks(5).map((t) => (
          <text
            key={`x${t}`}
            x={x(t)}
            y={H - M.bottom + 14}
            textAnchor="middle"
            fontSize="10"
            className="fill-(--ink-lo)"
          >
            {t}
          </text>
        ))}

        {/* the ceiling — a player whose whole threat is what he makes for others */}
        {diagonal && (
          <>
            <line
              x1={x(dLo)}
              y1={y(dLo)}
              x2={x(dHi)}
              y2={y(dHi)}
              stroke="var(--line-hi)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={lx}
              y={ly}
              fontSize="9"
              className="fill-(--ink-lo)"
              transform={`rotate(${-angle} ${lx} ${ly})`}
            >
              all creation
            </text>
          </>
        )}

        {/* the crowd first, the named on top — the sort above put them in order */}
        {points
          .filter((p) => !p.lead)
          .map((p) => (
            <circle
              key={p.id}
              cx={x(p.total)}
              cy={y(p.creating)}
              r={p.owned ? NAMED - 1 : DOT}
              fill={p.owned ? "var(--volt)" : "var(--ink-lo)"}
              fillOpacity={p.owned ? 1 : 0.35}
            >
              <title>{tip(p)}</title>
            </circle>
          ))}

        {leaders.map((p, i) => {
          const cx = x(p.total);
          const cy = y(p.creating);
          const dy = offsets[i];
          const anchor = cx > W - 92 ? "end" : cx < M.left + 42 ? "start" : "middle";
          return (
            <a
              key={p.id}
              href={`/players/${p.id}`}
              aria-label={`${p.name} — open his page`}
              className="cursor-pointer"
            >
              <title>{tip(p)}</title>
              {/* The visible dot is five pixels across, which is a fine mark
                  and a hopeless tap target. This one is invisible and
                  twenty-four wide — `transparent` rather than `none`, because
                  only the former still takes the tap. */}
              <circle cx={cx} cy={cy} r={12} fill="transparent" />
              <circle
                cx={cx}
                cy={cy}
                r={NAMED}
                fill={p.owned ? "var(--volt)" : "var(--ultra)"}
                fillOpacity={p.owned ? 1 : 0.85}
                /* the one dead-ball signal FPL will give: first-choice taker */
                stroke={p.deadBall ? "var(--amber)" : "var(--bg-raised)"}
                strokeWidth={p.deadBall ? 2 : 1}
              />
              {dy != null && (
                <text x={cx} y={cy + dy} textAnchor={anchor} fontSize="9.5" className="fill-(--ink-mid)">
                  {p.name}
                </text>
              )}
            </a>
          );
        })}

        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
          expected goal involvements — everything he threatens with
        </text>
        <text
          x={12}
          y={H / 2}
          textAnchor="middle"
          fontSize="10"
          className="fill-(--ink-lo)"
          transform={`rotate(-90 12 ${H / 2})`}
        >
          expected assists
        </text>
      </svg>

      <div className="mt-2 space-y-1.5 text-2xs leading-relaxed text-ink-lo">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-volt" />
            yours
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-ultra" />
            named
          </span>
          {anyDeadBall && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border-2 border-amber" />
              takes his club&rsquo;s corners or free-kicks
            </span>
          )}
          <span>tap a named dot for his page</span>
        </p>
        {!diagonal && (
          <p>
            {/* Zooming to the leaders can push y = x off the window entirely.
                Saying so beats leaving the reader to wonder where it went. */}
            The <em>all creation</em> line is off this window — every player here is a long way
            below it, which is what being one of the league&rsquo;s biggest threats looks like.
          </p>
        )}
        <p>
          The broadcast version splits creation into open play and dead balls. FPL publishes no such
          split — and no chances-created column at all — so this is its nearest honest equivalent:
          the value of the chances a player made, against the value of everything he was involved
          in.
          {anyDeadBall
            ? " The one piece of the dead-ball question FPL will answer is who takes them, and that is what the ringed dots mark."
            : ""}
        </p>
      </div>
    </>
  );
}

function tip(p: Point): string {
  const share = Math.round((p.creating / p.total) * 100);
  const duty = p.deadBall ? " · first-choice set pieces" : "";
  return `${p.name} · ${POSITION_SHORT[p.pos] ?? ""} — ${p.creating.toFixed(2)} xA of ${p.total.toFixed(2)} xGI (${share}% creating), ${p.minutes} minutes${duty}`;
}
