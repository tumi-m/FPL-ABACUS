"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { Est } from "@/components/gaffer/Est";

export interface DeskSquadRow {
  element: number;
  webName: string;
  pos: number;
  nowCost: number;
  /** FPL's real selling price (tenths) when exposed; falls back to nowCost. */
  sellPrice: number | null;
  epNext: number | null;
}
export interface DeskCandidate {
  id: number;
  webName: string;
  pos: number;
  nowCost: number;
  epNext: number | null;
}

interface DeskState {
  moves: { out: number; in: number }[];
  chips: Record<string, number>; // chipKey → gw
}

const POS_LABEL: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
const HIT_COST = 4;

/**
 * BoardDesk — transfer staging (ledger + payback marker) and the chip lane
 * with the set-1 hard wall. Local to this device; nothing auto-applies.
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
}) {
  const storageKey = `gaffer_board_v1_${teamId}`;
  const [state, setState] = React.useState<DeskState>({ moves: [], chips: {} });

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setState(JSON.parse(raw) as DeskState);
    } catch {
      /* fresh board */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: DeskState) => {
    setState(next);
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

  const addMove = (out: number, inc: number) => {
    if (!out || !inc || out === inc) return;
    if (state.moves.some((m) => m.out === out || m.in === inc)) return;
    persist({ ...state, moves: [...state.moves, { out, in: inc }] });
  };
  const removeMove = (i: number) =>
    persist({ ...state, moves: state.moves.filter((_, idx) => idx !== i) });

  // Free transfers: assume 1 rolling FT (the plan's budget engine lands later).
  const FREE_FT = 1;
  const hits = Math.max(0, state.moves.length - FREE_FT);
  const hitTotal = hits * HIT_COST;

  const assignChip = (key: string, gw: number | null) => {
    const nextChips = { ...state.chips };
    if (gw == null) delete nextChips[key];
    else nextChips[key] = gw;
    persist({ ...state, chips: nextChips });
  };

  const isPastWall = (gw: number, stopEvent: number) => gw > stopEvent;

  const [outSel, setOutSel] = React.useState<number>(squad[0]?.element ?? 0);
  const [inSel, setInSel] = React.useState<number>(candidates[0]?.id ?? 0);

  const outRow = squadById.get(outSel);
  const inRow = candById.get(inSel);
  const affordable = canAfford(inRow, outRow);

  return (
    <section aria-label="Transfer staging and chip lane" className="space-y-4 rounded-lg has-gloss card-lift bg-raised p-4 md:p-5">
      {/* hero strip — resources read at a glance */}
      <dl className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-md bg-sunk card-ring px-4 py-3" aria-label="Your resources">
        <div>
          <dt className="upper-label text-2xs text-ink-lo">Free transfers</dt>
          <dd className="fig-num mt-0.5 text-xl leading-none text-ink-hi">
            <Est method="budget engine lands with the v4 Plan object">{`${FREE_FT}`}</Est>
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

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="upper-label text-2xs text-ink-lo">Staging desk</h2>
        <p className="text-2xs text-ink-lo">
          Every move staged here stays local until you make it in the official game.
        </p>
      </div>

      {/* staging controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={outSel}
          onChange={(e) => setOutSel(Number(e.target.value))}
          aria-label="Player out"
          className="h-10 rounded-sm border border-line bg-sunk px-2 text-xs text-ink-hi focus-visible:outline focus-visible:outline-volt"
        >
          {squad.map((s) => (
            <option key={s.element} value={s.element}>
              OUT · {s.webName} ({POS_LABEL[s.pos]}) £{(s.nowCost / 10).toFixed(1)}
            </option>
          ))}
        </select>
        <select
          value={inSel}
          onChange={(e) => setInSel(Number(e.target.value))}
          aria-label="Player in"
          className="h-10 rounded-sm border border-line bg-sunk px-2 text-xs text-ink-hi focus-visible:outline focus-visible:outline-volt"
        >
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              IN · {c.webName} ({POS_LABEL[c.pos]}) £{(c.nowCost / 10).toFixed(1)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!affordable}
          onClick={() => addMove(outSel, inSel)}
          className="skewed inline-flex h-11 items-center rounded-sm bg-volt px-5 text-xs uppercase-label text-on-accent transition-opacity dur-instant disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>{affordable ? "Stage move" : "£ short"}</span>
        </button>
      </div>

      {/* the ledger */}
      {state.moves.length === 0 ? (
        <p className="text-xs text-ink-lo">No moves staged. The board is clean.</p>
      ) : (
        <table className="w-full text-xs num-tabular">
          <thead>
            <tr className="border-b border-hairline text-left">
              {["Out", "In", "Payback", ""].map((h) => (
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
              const gain = (n?.epNext ?? 0) - (o?.epNext ?? 0);
              const beyondFt = i >= FREE_FT;
              const payback =
                gain > 0 ? Math.ceil(HIT_COST / gain) : null;
              const paybackLabel =
                payback != null ? `pays back in ~${payback} GW` : "never pays back";
              return (
                <tr key={`${m.out}-${m.in}`} className="border-b border-hairline last:border-0">
                  <td className="px-2 py-1.5 text-ink-mid">
                    {o?.webName ?? m.out} <span className="text-ink-lo">£{((o?.nowCost ?? 0) / 10).toFixed(1)}</span>
                  </td>
                  <td className="px-2 py-1.5 text-ink-hi">
                    {n?.webName ?? m.in} <span className="text-ink-lo">£{((n?.nowCost ?? 0) / 10).toFixed(1)}</span>
                  </td>
                  <td className="px-2 py-1.5">
                    {beyondFt ? (
                      payback != null && payback <= 6 ? (
                        <Est method={`xP-next delta ${gain.toFixed(1)} vs −${HIT_COST} hit`}>
                          {paybackLabel}
                        </Est>
                      ) : (
                        <span className="text-flare">{paybackLabel}</span>
                      )
                    ) : (
                      <span className="text-surge">free</span>
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
            return (
              <div
                key={gw}
                className={cn(
                  "min-w-[64px] rounded-md border px-1.5 py-1.5 text-center",
                  chipHere ? "border-transparent btn-glow" : "card-ring",
                  gw === currentGw && "bg-surface-3",
                )}
              >
                <div className="text-2xs font-semibold uppercase-label text-ink-lo">GW{gw}</div>
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
          onClick={() => persist({ moves: [], chips: {} })}
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
