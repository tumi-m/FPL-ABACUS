"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { Est } from "@/components/gaffer/Est";
import { PlayerPhoto } from "@/components/gaffer/PlayerPhoto";
import { deskVerdict, priceMove } from "@/lib/engines/solverLite";
import {
  MAX_PLANS,
  activePlan,
  addPlan,
  emptyPlans,
  loadPlans,
  removePlan,
  withActive,
  type PlansState,
} from "@/lib/engines/boardPlans";

export interface DeskSquadRow {
  element: number;
  webName: string;
  pos: number;
  nowCost: number;
  /** FPL's real selling price (tenths) when exposed; falls back to nowCost. */
  sellPrice: number | null;
  epNext: number | null;
  /** Headshot code for the PlayerPhoto cascade. */
  photo?: string;
  /** Next-three fixture run, e.g. "lei(H) mun(A) —". */
  runLabel?: string;
  /** Solver-lite projected xP per horizon GW (blanks zero, doubles stacked). */
  horizon?: number[];
}
export interface DeskCandidate {
  id: number;
  webName: string;
  pos: number;
  nowCost: number;
  epNext: number | null;
  photo?: string;
  runLabel?: string;
  horizon?: number[];
}

export interface GwMarker {
  kind: "double" | "blank";
  detail: string;
}

interface DeskState {
  moves: { out: number; in: number }[];
  chips: Record<string, number>; // chipKey → gw
}

const POS_LABEL: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
const HIT_COST = 4;

/**
 * BoardDesk — transfer staging (ledger + payback marker) and the chip lane
 * with the set-1 hard wall. Multiple device-local plan slots; nothing
 * auto-applies.
 */
export function BoardDesk({
  teamId,
  squad,
  candidates,
  gws,
  currentGw,
  wallGw,
  chips,
  bankTenths,
  freeTransfers = 1,
  markers,
  ranksPerPoint = null,
}: {
  teamId: number;
  squad: DeskSquadRow[];
  candidates: DeskCandidate[];
  gws: number[];
  currentGw: number;
  /** Earliest stop_event across set-1 chips — the hard wall (typically GW19). */
  wallGw: number | null;
  chips: { key: string; label: string; stopEvent: number }[];
  bankTenths: number;
  /** Rolling free transfers replayed from entry history. */
  freeTransfers?: number;
  /** Blank/double flags per horizon GW. */
  markers?: Record<number, GwMarker>;
  /** Ranks per extra point at the hero's season total — null without a curve. */
  ranksPerPoint?: number | null;
}) {
  const storageKey = `gaffer_board_v2_${teamId}`;
  const legacyKey = `gaffer_board_v1_${teamId}`;
  const [plans, setPlans] = React.useState<PlansState>(() => emptyPlans());

  React.useEffect(() => {
    try {
      setPlans(
        loadPlans(localStorage.getItem(storageKey) ?? localStorage.getItem(legacyKey)),
      );
    } catch {
      /* fresh board */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: PlansState) => {
    setPlans(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* storage full or blocked — session-only */
    }
  };

  const squadById = React.useMemo(() => new Map(squad.map((s) => [s.element, s])), [squad]);
  const candById = React.useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  // Affordability: FPL's selling price when exposed (else current price) + bank.
  const bank = bankTenths / 10;
  const canAfford = (cand: DeskCandidate | undefined, outEl: DeskSquadRow | undefined): boolean => {
    if (!cand) return false;
    if (!outEl) return cand.nowCost <= bank;
    const sell = (outEl.sellPrice ?? outEl.nowCost) / 10;
    return cand.nowCost <= sell + bank;
  };

  const plan = activePlan(plans);
  const state: DeskState = { moves: plan.moves, chips: plan.chips };

  const addMove = (out: number, inc: number) => {
    if (!out || !inc || out === inc) return;
    if (plan.moves.some((m) => m.out === out || m.in === inc)) return;
    persist(withActive(plans, (p) => ({ ...p, moves: [...p.moves, { out, in: inc }] })));
  };
  const removeMove = (i: number) =>
    persist(withActive(plans, (p) => ({ ...p, moves: p.moves.filter((_, idx) => idx !== i) })));

  // Free transfers: rolling bank replayed from entry history (cap 5).
  const FREE_FT = freeTransfers;
  const hits = Math.max(0, plan.moves.length - FREE_FT);
  const hitTotal = hits * HIT_COST;

  // Solver-lite verdict — rank-priced across the full horizon, not ep-next deltas.
  const verdict = React.useMemo(
    () =>
      deskVerdict(
        plan.moves.map((m, i) => {
          const o = squadById.get(m.out);
          const n = candById.get(m.in);
          return o?.horizon && n?.horizon
            ? priceMove(o.horizon, n.horizon, {
                hitCost: i >= FREE_FT ? HIT_COST : 0,
                ranksPerPoint,
              })
            : { gain: 0, hitCost: 0, paybackGw: null, rankSwing: null };
        }),
      ),
    [plan.moves, squadById, candById, FREE_FT, ranksPerPoint],
  );

  const assignChip = (key: string, gw: number | null) => {
    persist(
      withActive(plans, (p) => {
        const nextChips = { ...p.chips };
        if (gw == null) delete nextChips[key];
        else nextChips[key] = gw;
        return { ...p, chips: nextChips };
      }),
    );
  };

  const isPastWall = (gw: number, stopEvent: number) => gw > stopEvent;

  // Guided staging: tap OUT on the squad grid, tap an IN suggestion — staged.
  const [outSel, setOutSel] = React.useState<number | null>(null);
  const outRow = outSel != null ? squadById.get(outSel) : undefined;

  // Ranked INs for the selected OUT — the solver is the guide, not a dropdown.
  const suggestions = React.useMemo(() => {
    if (!outRow?.horizon) return [];
    return candidates
      .filter((c) => c.pos === outRow.pos && c.horizon && !plan.moves.some((m) => m.in === c.id))
      .map((c) => ({
        cand: c,
        gain: priceMove(outRow.horizon!, c.horizon!, { hitCost: 0, ranksPerPoint: null }).gain,
        affordable: canAfford(c, outRow),
      }))
      .sort((a, b) => Number(b.affordable) - Number(a.affordable) || b.gain - a.gain)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outRow, candidates, plan.moves]);

  const stageIn = (inId: number) => {
    if (outSel == null) return;
    addMove(outSel, inId);
    setOutSel(null);
  };

  return (
    <section aria-label="Transfer staging and chip lane" className="space-y-4 rounded-lg has-gloss card-lift bg-raised p-4 md:p-5">
      {/* hero strip — resources read at a glance */}
      <dl className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-md bg-sunk card-ring px-4 py-3" aria-label="Your resources">
        <div>
          <dt className="upper-label text-2xs text-ink-lo">Free transfers</dt>
          <dd className="fig-num mt-0.5 text-xl leading-none text-ink-hi" aria-label={`${FREE_FT} free transfer${FREE_FT === 1 ? "" : "s"} banked`}>
            {FREE_FT}
          </dd>
        </div>
        <div>
          <dt className="upper-label text-2xs text-ink-lo">Bank</dt>
          <dd className="fig-num mt-0.5 text-xl leading-none text-ink-hi">£{bank.toFixed(1)}m</dd>
        </div>
        <div>
          <dt className="upper-label text-2xs text-ink-lo">Hits staged</dt>
          <dd
            className={cn("fig-num mt-0.5 text-xl leading-none", hitTotal > 0 ? "text-flare" : "text-ink-mid")}
            aria-label={`${hits} point hit${hits === 1 ? "" : "s"} planned, costing ${hitTotal} points`}
          >
            {hits > 0 ? `${hits} · −${hitTotal}` : "—"}
          </dd>
        </div>
      </dl>

      {/* plan slots — device-local, one desk per strategy */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Plans" className="flex gap-1 rounded-md card-ring p-1">
          {plans.plans.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === plan.id}
              onClick={() => persist({ ...plans, active: p.id })}
              className={`skewed rounded-sm px-3 py-1.5 text-xs uppercase-label transition-colors dur-instant ${
                p.id === plan.id ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi"
              }`}
            >
              <span>
                {p.name}
                {p.moves.length > 0 ? ` · ${p.moves.length}` : ""}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => persist(addPlan(plans))}
            disabled={plans.plans.length >= MAX_PLANS}
            className="inline-flex h-11 items-center rounded-md card-ring px-4 text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi disabled:cursor-not-allowed disabled:opacity-40"
          >
            New plan
          </button>
          {plans.plans.length > 1 && (
            <button
              type="button"
              onClick={() => persist(removePlan(plans, plan.id))}
              className="inline-flex h-11 items-center rounded-md card-ring px-4 text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-flare"
            >
              Delete plan
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="upper-label text-2xs text-ink-lo">Staging desk</h2>
        <p className="text-2xs text-ink-lo">
          Every move staged here stays local until you make it in the official game.
        </p>
      </div>

      {/* the verdict — what this plan earns, in plain words */}
      {(plan.moves.length > 0 || hits > 0) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md bg-sunk card-ring px-4 py-3" aria-label="Plan verdict">
          <div>
            <p className="upper-label text-2xs text-ink-lo">This plan over {gws.length} GW</p>
            <p className="fig-num mt-0.5 text-2xl leading-none text-volt">
              {verdict.netPoints >= 0 ? "+" : "−"}
              {Math.abs(verdict.netPoints).toFixed(1)} pts
            </p>
          </div>
          {verdict.netRankSwing != null && (
            <div>
              <p className="upper-label text-2xs text-ink-lo">Rank swing</p>
              <p className={cn("fig-num mt-0.5 text-2xl leading-none", verdict.netRankSwing >= 0 ? "text-surge" : "text-flare")}>
                {verdict.netRankSwing >= 0 ? "+" : "−"}
                {Math.abs(verdict.netRankSwing).toLocaleString("en-GB")}
              </p>
            </div>
          )}
          <div>
            <p className="upper-label text-2xs text-ink-lo">Cost</p>
            <p className={cn("fig-num mt-0.5 text-2xl leading-none", hitTotal > 0 ? "text-flare" : "text-ink-hi")}>
              {hitTotal > 0 ? `−${hitTotal}` : "free"}
            </p>
          </div>
        </div>
      )}

      {/* step 1 — the squad grid: tap who makes way */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <h3 className="upper-label text-2xs text-ink-lo">
            {outRow ? `Out: ${outRow.webName} — now pick who comes in` : "1 · Tap who makes way"}
          </h3>
          {outRow && (
            <button
              type="button"
              onClick={() => setOutSel(null)}
              className="text-2xs uppercase-label text-ink-lo transition-colors dur-instant hover:text-ink-hi"
            >
              Cancel
            </button>
          )}
        </div>
        <ul aria-label="Squad — tap who makes way" className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
          {squad.map((s) => {
            const selected = outSel === s.element;
            const staged = plan.moves.some((m) => m.out === s.element);
            return (
              <li key={s.element}>
                <button
                  type="button"
                  onClick={() => setOutSel(selected ? null : s.element)}
                  aria-pressed={selected}
                  className={cn(
                    "w-full rounded-md p-1.5 text-center transition-all dur-instant",
                    selected ? "bg-surface-3" : "bg-sunk card-ring hover:bg-surface-3",
                  )}
                  style={selected ? { boxShadow: "inset 0 0 0 1.5px var(--volt), 0 0 14px 1px color-mix(in oklab, var(--volt) 40%, transparent)" } : undefined}
                >
                  <span className="mx-auto block h-10 w-10 overflow-hidden rounded-sm bg-surface-2">
                    {s.photo ? (
                      <PlayerPhoto photo={s.photo} teamId={s.element} className="h-10 w-10 object-cover object-top" />
                    ) : (
                      <span className="grid h-10 w-10 place-items-center text-2xs font-bold text-ink-mid">
                        {s.webName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-2xs font-semibold text-ink-hi">{s.webName}</span>
                  <span className="block text-[9px] leading-tight text-ink-lo num-tabular">
                    {POS_LABEL[s.pos]} £{(s.nowCost / 10).toFixed(1)}
                    {staged && <span className="text-volt"> ·</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* step 2 — ranked ins from the solver */}
      {outRow && (
        <div>
          <h3 className="mb-1.5 upper-label text-2xs text-ink-lo">
            2 · Who comes in — ranked by {gws.length}-GW gain
          </h3>
          {suggestions.length === 0 ? (
            <p className="text-xs text-ink-lo">
              No {POS_LABEL[outRow.pos]} candidates in the top-50 pool for this move.
            </p>
          ) : (
            <ul aria-label="Ranked ins for the selected player" className="grid gap-1.5 sm:grid-cols-2">
              {suggestions.map(({ cand, gain, affordable }) => (
                <li key={cand.id}>
                  <button
                    type="button"
                    disabled={!affordable}
                    onClick={() => stageIn(cand.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md p-2 text-left transition-all dur-instant",
                      affordable
                        ? "bg-sunk card-ring hover:bg-surface-3"
                        : "cursor-not-allowed bg-sunk opacity-45 card-ring",
                    )}
                  >
                    <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-surface-2">
                      {cand.photo ? (
                        <PlayerPhoto photo={cand.photo} teamId={cand.id} className="h-10 w-10 object-cover object-top" />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center text-2xs font-bold text-ink-mid">
                          {cand.webName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-hi">{cand.webName}</span>
                      <span className="block truncate text-2xs text-ink-lo num-tabular">
                        {POS_LABEL[cand.pos]} · £{(cand.nowCost / 10).toFixed(1)}
                        {cand.runLabel ? ` · ${cand.runLabel}` : ""}
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-right", affordable ? "" : "text-flare")}>
                      {affordable ? (
                        <Est method="solver-lite: projected points over the horizon vs the player out">
                          {`${gain >= 0 ? "+" : "−"}${Math.abs(gain).toFixed(1)}`}
                        </Est>
                      ) : (
                        <span className="block text-2xs uppercase-label">£ short</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* the ledger */}
      {state.moves.length === 0 ? (
        <p className="text-xs text-ink-lo">
          {FREE_FT >= 2
            ? `${FREE_FT} free transfers banked — rolling is often the best move. The board is clean.`
            : "No moves staged. The board is clean."}
        </p>
      ) : (
        <table className="w-full text-xs num-tabular">
          <thead>
            <tr className="border-b border-hairline text-left">
              {["Out", "In", "Horizon", ""].map((h) => (
                <th key={h} className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.moves.map((m, i) => {
              const o = squadById.get(m.out);
              const n = candById.get(m.in);
              const beyondFt = i >= FREE_FT;
              const hitCost = beyondFt ? HIT_COST : 0;
              const price =
                o?.horizon && n?.horizon
                  ? priceMove(o.horizon, n.horizon, { hitCost, ranksPerPoint })
                  : null;
              const payback = price?.paybackGw ?? null;
              const paybackLabel =
                payback != null ? `pays back in ~${payback} GW` : "never pays back";
              return (
                <tr key={`${m.out}-${m.in}`} className="border-b border-hairline last:border-0">
                  <td className="px-2 py-1.5 text-ink-mid">
                    {o?.webName ?? m.out} <span className="text-ink-lo">£{((o?.nowCost ?? 0) / 10).toFixed(1)}</span>
                    {o?.runLabel && <span className="block text-2xs text-ink-lo">{o.runLabel}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-ink-hi">
                    {n?.webName ?? m.in} <span className="text-ink-lo">£{((n?.nowCost ?? 0) / 10).toFixed(1)}</span>
                    {n?.runLabel && <span className="block text-2xs text-ink-lo">{n.runLabel}</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    {!beyondFt ? (
                      <span className="text-surge">free</span>
                    ) : payback != null && payback <= gws.length ? (
                      <Est method={`6-GW fixture-model projection ${price?.gain.toFixed(1) ?? "?"} pts vs −${HIT_COST} hit`}>
                        {paybackLabel}
                      </Est>
                    ) : (
                      <span className="text-flare">{paybackLabel}</span>
                    )}
                    {price?.rankSwing != null && (
                      <span
                        className={cn(
                          "mt-0.5 block w-fit text-2xs",
                          price.rankSwing >= 0 ? "text-surge" : "text-flare",
                        )}
                      >
                        <Est method="net horizon points × ranks-per-point at your season total">
                          {`${price.rankSwing >= 0 ? "+" : "−"}${Math.abs(price.rankSwing).toLocaleString("en-GB")} ranks`}
                        </Est>
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeMove(i)}
                      className="relative text-2xs uppercase-label text-ink-lo transition-colors dur-instant after:absolute after:inset-x-2 after:-inset-y-3 after:content-[''] hover:text-flare"
                    >
                      Drop
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="px-2 pt-2 text-2xs uppercase-label text-ink-lo">
                {state.moves.length} staged · {hits} hit{hits === 1 ? "" : "s"}
              </td>
              <td colSpan={2} className={cn("px-2 pt-2 text-right fig-num text-sm", hitTotal > 0 ? "text-flare" : "text-surge")}>
                −{hitTotal}
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* chip lane — one chip per GW; set-1 chips stop at the wall */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <h3 className="upper-label text-2xs text-ink-lo">Chip lane</h3>
          {wallGw != null && (
            <span className="text-2xs text-ink-lo">
              Set-1 wall at GW{wallGw} — enforced, not warned
            </span>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {gws.map((gw) => {
            const chipHere = Object.entries(state.chips).find(([, g]) => g === gw);
            const marker = markers?.[gw];
            return (
              <div
                key={gw}
                className={cn(
                  "min-w-[64px] rounded-md border px-1.5 py-1.5 text-center",
                  chipHere ? "border-transparent btn-glow" : "card-ring",
                  gw === currentGw && "bg-surface-3",
                )}
              >
                <div className="text-2xs font-semibold uppercase-label text-ink-lo">
                  GW{gw}
                  {marker && (
                    <span
                      title={marker.detail}
                      className={cn(
                        "ml-1 rounded-full px-1 text-[9px] leading-[1.4]",
                        marker.kind === "double" ? "bg-surge/15 text-surge" : "bg-flare/15 text-flare",
                      )}
                    >
                      {marker.kind === "double" ? "×2" : "bye"}
                    </span>
                  )}
                </div>
                {chipHere ? (
                  <button
                    type="button"
                    onClick={() => assignChip(chipHere[0], null)}
                    title="Remove chip"
                    className="mt-0.5 w-full rounded-sm bg-volt px-1 py-0.5 text-2xs font-bold uppercase-label text-on-accent"
                  >
                    {chips.find((c) => c.key === chipHere[0])?.label ?? chipHere[0]}
                  </button>
                ) : (
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {chips.map((c) => {
                      const blocked = isPastWall(gw, c.stopEvent);
                      const taken = state.chips[c.key] != null;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          disabled={blocked || taken}
                          onClick={() => assignChip(c.key, gw)}
                          title={taken ? `Planned for GW${state.chips[c.key]}` : blocked ? `Set-1 wall: this chip expires after GW${c.stopEvent}` : undefined}
                          className={cn(
                            "rounded-sm px-1 py-0.5 text-2xs uppercase-label",
                            blocked || taken
                              ? "cursor-not-allowed text-ink-lo opacity-40"
                              : "bg-raised text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
                          )}
                        >
                          {shortChip(c.label)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {(state.moves.length > 0 || Object.keys(state.chips).length > 0) && (
        <button
          type="button"
          onClick={() => persist(withActive(plans, (p) => ({ ...p, moves: [], chips: {} })))}
          className="inline-flex h-11 items-center self-start rounded-md card-ring px-4 text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-flare"
        >
          Clear the desk
        </button>
      )}
    </section>
  );
}

function shortChip(label: string): string {
  switch (label) {
    case "Wildcard":
      return "WC";
    case "Free Hit":
      return "FH";
    case "Bench Boost":
      return "BB";
    default:
      return label.slice(0, 2).toUpperCase();
  }
}
