"use client";

import * as React from "react";
import { CrestBadge } from "@/components/gaffer/CrestBadge";
import { PlayerAvatar, useAvatarMode } from "@/components/gaffer/PlayerAvatar";
import { Est } from "@/components/gaffer/Est";
import { Published } from "@/components/gaffer/Provenance";
import { cn } from "@/lib/ui/cn";
import { formatPrice, POSITION_SHORT } from "@/lib/ui/format";
import { spendLabel, suggestTransfers } from "@/lib/engines/suggest";
import { defaultMinutesFloor } from "@/lib/engines/performance";
import { POSTURES, applyPosture, fixtureEaseOf, type PosturePlayer } from "@/lib/ai/posture";
import { useGafferPersona } from "@/components/gaffer/ask/GafferStrip";
import { personaById } from "@/lib/ai/personas";
import type { PlannerPlayer } from "@/lib/engines/planner";

const METHOD =
  "Projected points over the planning window, from FPL's own expected points blended with form and adjusted for each fixture. A projection, not a promise.";

/**
 * Recommended transfers, on the desk that makes them.
 *
 * This existed only on the Board, which is the wrong place twice over: the
 * Board has to build the entire planner — seven hundred players projected
 * across six gameweeks — purely to feed it, behind a deadline guard because
 * that is slow; and having read the recommendation there you then travel to
 * the Planner to act on it, carrying the swap in the query string. Here the
 * planner data is already loaded, so the list costs nothing, and a row can
 * simply stage itself.
 *
 * The important difference from the Board's version: this reads the squad you
 * are *planning*, not the one you own. Stage a move and the next
 * recommendation accounts for it — the sold player stops being suggested, the
 * bank reflects what the sale raised, and the club cap counts the incoming
 * man. A static list stops being true the moment you act on it.
 */
export function PlannerSuggestions({
  squad,
  market,
  bankTenths,
  weeks,
  freeTransfers,
  staged,
  sellPriceOf,
  onStage,
}: {
  /** The working fifteen — after staged moves, not the ones you own today. */
  squad: PlannerPlayer[];
  market: PlannerPlayer[];
  bankTenths: number;
  weeks: number;
  freeTransfers: number;
  /** How many moves are already in the ledger, for the hit warning. */
  staged: number;
  sellPriceOf: (id: number) => number;
  onStage: (outId: number, inId: number) => void;
}) {
  const [avatar] = useAvatarMode();
  const [personaId] = useGafferPersona();
  const persona = personaById(personaId);
  const posture = POSTURES[persona.id];

  const rows = React.useMemo(() => {
    if (squad.length === 0) return [];
    const desk = suggestTransfers({
      squad,
      market,
      bankTenths,
      sellPriceOf,
      weeks,
      // One extra so a posture that demotes the desk's top can still fill five.
      limit: 8,
      // Scaled to how much football has been played, so the opening weeks are
      // not blank and a late-season board is not full of one-appearance names.
      minMinutes: defaultMinutesFloor(market),
    });
    // The persona's judgement, applied by the engine rather than the prompt:
    // the same legal moves, ranked through this gaffer's weights. The reason
    // a posture gives must name its own weighting — the card shows why.
    const marketBase =
      market.length > 0
        ? market.reduce((a, p) => a + (p.horizon?.[0] ?? 0), 0) / market.length
        : 0;
    const postureOf = (id: number): PosturePlayer | undefined => {
      const p = byIdRef(id);
      if (!p) return undefined;
      return { ...p, fixtureEase: fixtureEaseOf(p.horizon, weeks, marketBase) };
    };
    function byIdRef(id: number): PlannerPlayer | undefined {
      return market.find((p) => p.id === id) ?? squad.find((p) => p.id === id);
    }
    return applyPosture(desk, postureOf, posture).slice(0, 5);
  }, [squad, market, bankTenths, sellPriceOf, weeks, posture]);

  const byId = React.useMemo(() => {
    const m = new Map<number, PlannerPlayer>();
    for (const p of [...market, ...squad]) m.set(p.id, p);
    return m;
  }, [market, squad]);

  // Minutes certainty for the OUT side (v10 D2): selling a player who starts
  // every week is a different decision from selling one who rotates, and the
  // projection alone does not say which. One batched fetch for the players
  // the suggestions name.
  const outIds = React.useMemo(
    () => [...new Set(rows.map((s) => s.outId))].join(","),
    [rows],
  );
  const minutesByPlayer = useMinutesCertainty(outIds);

  const free = Math.max(0, freeTransfers - staged);

  return (
    <section aria-label="Recommended transfers" className="space-y-2 rounded-lg bg-raised card-ring p-3 md:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="fig-num text-base leading-none text-ink-hi">Worth doing next</h3>
        <p className="text-2xs text-ink-lo num-tabular">
          <Published>{`${free} free · ${formatPrice(bankTenths)} banked`}</Published>
        </p>
      </div>
      <p className="text-2xs leading-relaxed text-ink-lo">
        Every legal one-for-one swap over the next {weeks} gameweeks — position, budget and the
        three-per-club cap already checked — ranked the way{" "}
        <span className="font-semibold text-ink-2">{persona.name}</span> reads them: {posture.reason}
      </p>

      {squad.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-3 py-5 text-center text-2xs text-ink-lo">
          Your picks are not visible yet, so there is nothing to swap out of. Sign in on the FPL
          site and reload — the market table below works regardless.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-3 py-5 text-center text-2xs text-ink-lo">
          Nothing in the market beats what you already own over the next {weeks} gameweeks. Holding
          the transfer is the recommendation.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((s) => {
            const out = byId.get(s.outId);
            const inc = byId.get(s.inId);
            if (!out || !inc) return null;
            /* The gain is over the window; the hit is a one-off. A move that
               gains 3.2 over six weeks is not worth −4 today, and the row
               should say so rather than leaving the arithmetic to the reader. */
            const costsHit = staged >= freeTransfers;
            const net = costsHit ? s.gain - 4 : s.gain;
            return (
              <li key={`${s.outId}-${s.inId}`} className="rounded-md bg-surface-1 p-2">
                <div className="flex items-center gap-2">
                  <Face p={out} avatar={avatar} dim />
                  <span aria-hidden className="shrink-0 text-xs text-ink-lo">→</span>
                  <Face p={inc} avatar={avatar} />
                  <span className="ml-auto shrink-0 text-right">
                    <span
                      className={cn(
                        "block text-sm font-bold leading-none num-tabular",
                        net > 0 ? "text-surge" : "text-flare",
                      )}
                    >
                      <Est method={METHOD}>{`${net > 0 ? "+" : ""}${net.toFixed(1)}`}</Est>
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-none text-ink-lo num-tabular">
                      {spendLabel(s.spend ?? 0)}
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-ink-lo num-tabular">
                    {s.outPoints.toFixed(1)} → {s.inPoints.toFixed(1)} pts
                    {costsHit ? " · after a −4 hit" : ""}
                    {minutesByPlayer.get(s.outId)?.reliable && minutesByPlayer.get(s.outId)?.pStart != null
                      ? ` · sells at P(start) ${Math.round(minutesByPlayer.get(s.outId)!.pStart! * 100)}%`
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => onStage(s.outId, s.inId)}
                    className="skewed h-7 shrink-0 rounded-sm bg-volt px-3 text-[10px] uppercase-label text-on-accent transition-transform dur-instant active:scale-[0.98]"
                  >
                    <span>Stage it</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Face({
  p,
  avatar,
  dim = false,
}: {
  p: PlannerPlayer;
  avatar: ReturnType<typeof useAvatarMode>[0];
  dim?: boolean;
}) {
  return (
    <span className={cn("flex min-w-0 flex-1 items-center gap-1.5", dim && "opacity-70")}>
      <span className="relative block h-7 w-7 shrink-0">
        <span className="block h-7 w-7 overflow-hidden rounded-sm bg-surface-2">
          <PlayerAvatar photo={p.photo} teamId={p.team} mode={avatar} className="h-7 w-7 object-cover object-top" />
        </span>
        <CrestBadge teamId={p.team} size={11} className="absolute -bottom-0.5 -right-0.5 rounded-[2px] bg-surface-1" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-ink-hi">{p.name}</span>
        <span className="block truncate text-[10px] leading-tight text-ink-lo num-tabular">
          <Published>{`${POSITION_SHORT[p.pos]} · ${formatPrice(p.cost)}`}</Published>
        </span>
      </span>
    </span>
  );
}

interface MinutesApiRow {
  id: number;
  pStart: number | null;
  p60: number | null;
  expectedMinutes: number | null;
  interval: [number, number] | null;
  appearances: number;
  reliable: boolean;
  note: string;
}

/**
 * Batched minutes-certainty fetch for the named players (v10 D2). Empty map
 * while loading or when ids are blank — the rows render without the chip,
 * never with a placeholder number.
 */
function useMinutesCertainty(idsCsv: string): Map<number, MinutesApiRow> {
  const [map, setMap] = React.useState<Map<number, MinutesApiRow>>(new Map());
  React.useEffect(() => {
    if (!idsCsv) {
      setMap(new Map());
      return;
    }
    let alive = true;
    fetch(`/api/gaffer/minutes?players=${idsCsv}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { players: MinutesApiRow[] }) => {
        if (!alive) return;
        const next = new Map<number, MinutesApiRow>();
        for (const row of data.players) next.set(row.id, row);
        setMap(next);
      })
      .catch(() => {
        if (alive) setMap(new Map());
      });
    return () => {
      alive = false;
    };
  }, [idsCsv]);
  return map;
}
