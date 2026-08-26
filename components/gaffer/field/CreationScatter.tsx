"use client";

import * as React from "react";
import useSWR from "swr";
import { scaleLinear } from "d3-scale";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { cn } from "@/lib/ui/cn";
import { POSITION_SHORT } from "@/lib/ui/format";
import type { PerfPlayer } from "@/lib/engines/performance";

/**
 * The whole league on one pair of axes: how much a player creates against
 * everything he is expected to be involved in.
 *
 * A note on what this is and is not. The broadcast version of this chart plots
 * chances created from open play against total chances created, and FPL
 * publishes neither: chances created is Opta's, and nothing in the FPL API
 * splits creation into open play and dead balls. Inventing that split would
 * give the chart a shape it has not earned.
 *
 * What FPL does publish is expected assists — the summed value of the chances
 * a player's passes actually produced — and expected goal involvements, which
 * is that plus his own expected goals. So the same geometry survives with real
 * numbers underneath it: y is a part of x, every point sits under the
 * diagonal, and where it sits says what kind of player he is.
 *
 *   On the diagonal   everything he threatens with, he makes for someone else
 *   On the x-axis     he takes his own chances and creates nothing
 *   Far from origin   he does a lot of it, whichever kind
 *
 * The league costs a request, so it is fetched when the chart comes into view
 * and not before — a Field visit that never scrolls this far pays nothing. The
 * endpoint is the one the stat boards already use, so opening Top first warms
 * it and this arrives instantly.
 */

const DOT = 3.4;
const MINE = 5.2;

/** Below this there is not enough football behind a season total to plot. */
const FLOORS = [0, 180, 450, 900] as const;
type Floor = (typeof FLOORS)[number];

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
 * The four charts above this one are drawn from data the page already has.
 * This one is not, and a Field visit that stops at the pitch should not pay
 * for a request it never sees the result of.
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

export function CreationScatter({ mine }: { mine: number[] }) {
  const [host, near] = useNearViewport<HTMLDivElement>();
  const [floor, setFloor] = React.useState<Floor>(450);
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

  const points = React.useMemo(() => {
    const all = data?.season ?? [];
    return all
      .filter((p) => p.minutes >= floor && (pos === 0 || p.pos === pos))
      .filter((p) => Number.isFinite(p.xgi) && Number.isFinite(p.xa) && p.xgi > 0 && p.xa >= 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        pos: p.pos,
        teamId: p.teamId,
        /* xGI is xG plus xA, so xA cannot exceed it and the diagonal is a real
           ceiling. FPL rounds the two figures independently, though, and a
           point sitting a hair above a line labelled "all creation" would be
           the chart telling a small lie — so the total is floored at the part
           it contains and a rounding disagreement lands exactly on the line. */
        total: Math.max(p.xgi, p.xa),
        creating: p.xa,
        minutes: p.minutes,
        owned: mineSet.has(p.id),
      }))
      // yours last, so they draw on top of the crowd rather than under it
      .sort((a, b) => Number(a.owned) - Number(b.owned));
  }, [data, floor, pos, mineSet]);

  return (
    <div ref={host}>
      <ChartFrame
        eyebrow="The league"
        title="Creating, against everything he does"
        ariaLabel="Scatter of expected assists against expected goal involvements for every player in the league"
        caption="Every point sits under the diagonal because creating is part of the total, not separate from it. Up on the line is a pure creator; down on the floor is a pure finisher; far out is a player doing plenty of either."
        legend={
          <>
            <Controls
              floor={floor}
              onFloor={setFloor}
              pos={pos}
              onPos={setPos}
              count={points.length}
            />
          </>
        }
        table={
          points.length > 0
            ? {
                headers: ["Player", "xGI", "xA", "Creating share"],
                rows: [...points]
                  .sort((a, b) => b.creating - a.creating)
                  .slice(0, 40)
                  .map((p) => [
                    p.name,
                    p.total.toFixed(2),
                    p.creating.toFixed(2),
                    `${Math.round((p.creating / p.total) * 100)}%`,
                  ]) as (string | number)[][],
              }
            : undefined
        }
      >
        {!near || isLoading ? (
          <div className="h-[320px] animate-pulse rounded-md bg-surface-3/40" />
        ) : error ? (
          <p className="py-16 text-center text-sm text-ink-lo">
            The league board did not answer. It will try again when you come back.
          </p>
        ) : points.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-lo">
            Nobody clears {floor} minutes yet — drop the filter, or come back a few gameweeks in.
          </p>
        ) : (
          <Plot points={points} />
        )}
      </ChartFrame>
    </div>
  );
}

function Controls({
  floor,
  onFloor,
  pos,
  onPos,
  count,
}: {
  floor: Floor;
  onFloor: (f: Floor) => void;
  pos: PosFilter;
  onPos: (p: PosFilter) => void;
  count: number;
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

      <div role="group" aria-label="Minutes floor" className="flex gap-1 rounded-md glass-edge p-1">
        {FLOORS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFloor(f)}
            aria-pressed={floor === f}
            title={f === 0 ? "Everyone with a minute" : `At least ${f} minutes played`}
            className={cn(
              "skewed rounded-sm px-2.5 py-1 text-2xs uppercase-label num-tabular transition-colors dur-instant",
              floor === f ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
            )}
          >
            <span>{f === 0 ? "Any" : `${f}′`}</span>
          </button>
        ))}
      </div>

      <p className="ml-auto text-2xs text-ink-lo num-tabular">{count} players</p>
    </div>
  );
}

interface Point {
  id: number;
  name: string;
  pos: number;
  teamId: number;
  total: number;
  creating: number;
  minutes: number;
  owned: boolean;
}

function Plot({ points }: { points: Point[] }) {
  const W = 560;
  const H = 340;
  const M = { top: 14, right: 16, bottom: 42, left: 46 };

  const xMax = Math.max(1, ...points.map((p) => p.total)) * 1.06;
  /* The y axis stops at the data, not at the x axis.
     Both quantities share a unit, so a square domain is the tidy instinct —
     but nobody's creation ever approaches their whole involvement at volume,
     so a square domain spends the top half of the canvas proving it. The
     diagonal stays the true locus of y = x either way: the two scales differ,
     so it simply renders steeper, and a point above it is still impossible. */
  const yMax = Math.min(xMax, Math.max(1, ...points.map((p) => p.creating)) * 1.12);
  const x = scaleLinear().domain([0, xMax]).range([M.left, W - M.right]);
  const y = scaleLinear().domain([0, yMax]).range([H - M.bottom, M.top]);

  return (
    <>
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {y.ticks(5).map((t) => (
          <g key={`y${t}`}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--line)"
              strokeWidth="1"
            />
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

        {/* the ceiling — a player whose whole threat is what he makes for
            others. It runs to wherever y = x leaves the plot. */}
        {(() => {
          const end = Math.min(xMax, yMax);
          const angle =
            (Math.atan2(y(0) - y(end), x(end) - x(0)) * 180) / Math.PI;
          const lx = x(end * 0.55);
          const ly = y(end * 0.55) - 7;
          return (
            <>
              <line
                x1={x(0)}
                y1={y(0)}
                x2={x(end)}
                y2={y(end)}
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
          );
        })()}

        {points.map((p) => (
          <circle
            key={p.id}
            cx={x(p.total)}
            cy={y(p.creating)}
            r={p.owned ? MINE : DOT}
            /* One colour for the league. Twenty club rails at three pixels
               across is a rainbow rather than an encoding, and it buries the
               only distinction that matters here — which of them are yours. */
            fill={p.owned ? "var(--volt)" : "var(--ink-lo)"}
            fillOpacity={p.owned ? 1 : 0.4}
            stroke={p.owned ? "var(--bg-raised)" : "none"}
            strokeWidth={p.owned ? 1.5 : 0}
          >
            <title>
              {`${p.name} · ${POSITION_SHORT[p.pos] ?? ""} — ${p.creating.toFixed(2)} xA of ${p.total.toFixed(2)} xGI (${Math.round((p.creating / p.total) * 100)}% creating), ${p.minutes} minutes`}
            </title>
          </circle>
        ))}

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

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-lo">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-volt" />
          yours
        </span>
        <span>
          The broadcast version of this splits creation into open play and dead balls. FPL publishes
          no such split — and no chances-created column at all — so this is its nearest honest
          equivalent: the value of the chances a player made, against the value of everything he was
          involved in.
        </span>
      </p>
    </>
  );
}
