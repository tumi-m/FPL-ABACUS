"use client";

import * as React from "react";
import { Est } from "@/components/gaffer/Est";
import { cn } from "@/lib/ui/cn";
import { formatPrice } from "@/lib/ui/format";
import { solvePlan, type SolveResult } from "@/lib/engines/solver/beam";
import { POSTURES } from "@/lib/ai/posture";
import { useGafferPersona } from "@/components/gaffer/ask/GafferStrip";
import { personaById } from "@/lib/ai/personas";
import { defaultMinutesFloor } from "@/lib/engines/performance";
import type { PlannerData } from "@/lib/server/buildPlanner";
import type { PlannerPlayer } from "@/lib/engines/planner";

/**
 * The branching solver's plan (v10 D6) — the multi-gameweek answer.
 *
 * The suggestions board prices single swaps; this prices the *plan*: what
 * to do over the whole window, with the hit arithmetic and the risk
 * posture the chosen gaffer carries. It runs in the browser over the same
 * market payload the page already loaded — no second request — and every
 * move it names is legal through checkSwap, the desk's own rules.
 *
 * The heuristic says what it is: the horizon, the beam width, and that
 * this is the best plan found, not the best possible. Claiming more would
 * be the same sin as inventing a number.
 */

const METHOD =
  "Beam-searched across the gameweek tree: the best plan found over the horizon, scored by projected points with the hit priced in. A heuristic, not a proof of optimality.";

export function SolverPlan({
  data,
  onStage,
}: {
  data: PlannerData;
  onStage: (outId: number, inId: number) => void;
}) {
  const [personaId] = useGafferPersona();
  const persona = personaById(personaId);
  const posture = POSTURES[persona.id];

  const result = React.useMemo<SolveResult | null>(() => {
    if (data.squadUnavailable || data.squad.length === 0) return null;
    const working = data.squad
      .map((s) => data.players.find((p) => p.id === s.element))
      .filter((p): p is PlannerPlayer => p != null);
    if (working.length < 11) return null;
    return solvePlan({
      squad: working,
      market: data.players,
      bankTenths: data.bankTenths,
      sellPriceOf: (id) => data.squad.find((s) => s.element === id)?.sellPrice ?? 0,
      weeks: data.gws.length,
      risk: posture.momentum * 0.5 + posture.differential * 0.5,
      minMinutes: defaultMinutesFloor(data.players),
    });
  }, [data, posture]);

  if (result == null) return null;

  const byId = new Map(data.players.map((p) => [p.id, p]));

  return (
    <section
      aria-label="The season plan"
      className="space-y-2 rounded-lg bg-raised card-ring p-3 md:p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="fig-num text-base leading-none text-ink-hi">
          {persona.name}&rsquo;s plan — GW{data.gws[0]?.id}
          {data.gws.length > 1 && `–${data.gws[data.gws.length - 1].id}`}
        </h3>
        <p className="text-2xs text-ink-lo num-tabular">
          {result.hits > 0 ? (
            <span className="text-warning">{result.hits} hit{result.hits > 1 ? "s" : ""} · −{result.hits * 4}</span>
          ) : (
            "no hits"
          )}{" "}
          ·{" "}
          <Est method="The worst projected week along the plan — the week the plan leaves you thinnest.">
            {`worst ${result.worstGwPoints.toFixed(1)}`}
          </Est>
        </p>
      </div>

      <p className="text-2xs leading-relaxed text-ink-lo">
        {posture.reason} Searched {result.explored.toLocaleString("en-GB")} branches over{" "}
        {result.horizon} gameweeks at width {result.beamWidth} —{" "}
        <span className="text-ink-2">the best plan found, not the best possible.</span>
      </p>

      <ol className="space-y-1.5">
        {result.moves.map((m, i) => {
          const out = byId.get(m.out);
          const inc = byId.get(m.in);
          if (!out || !inc) return null;
          return (
            <li key={`${m.out}-${m.in}`} className="flex items-center gap-2 rounded-md bg-surface-1 p-2">
              <span className="fig-num w-5 shrink-0 text-center text-2xs text-ink-lo">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-ink-1">
                <span className="text-ink-3">{out.name}</span>
                <span aria-hidden className="mx-1.5 text-ink-lo">→</span>
                <span className="font-semibold">{inc.name}</span>
                <span className="ml-2 text-2xs text-ink-lo">
                  GW{data.gws[m.gw - 1]?.id ?? "?"} · {formatPrice(inc.cost - out.cost)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onStage(m.out, m.in)}
                className="skewed h-7 shrink-0 rounded-sm bg-volt px-3 text-[10px] uppercase-label text-on-accent transition-transform dur-instant active:scale-[0.98]"
              >
                <span>Stage it</span>
              </button>
            </li>
          );
        })}
        {result.moves.length === 0 && (
          <li className="rounded-md bg-surface-1 px-3 py-4 text-center text-2xs text-ink-lo">
            Hold everything — no move across the window beats holding the transfers, priced hit-inclusive.
          </li>
        )}
      </ol>

      <p className="text-2xs text-ink-lo">
        {result.perGw.length > 0 && (
          <>
            Weekly projection:{" "}
            {result.perGw.map((pts, i) => (
              <span key={i} className={cn("mr-2 num-tabular", pts === 0 && "text-critical")}>
                <Est method={METHOD}>{pts.toFixed(1)}</Est>
              </span>
            ))}
          </>
        )}
      </p>
    </section>
  );
}