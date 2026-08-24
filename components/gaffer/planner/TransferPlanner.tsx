"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { Est } from "@/components/gaffer/Est";
import { PlannerPitch, type PitchMode, type PitchSlot } from "@/components/gaffer/planner/PlannerPitch";
import { MarketPanel } from "@/components/gaffer/planner/MarketPanel";
import { FixtureTicker } from "@/components/gaffer/planner/FixtureTicker";
import { PriceWatch } from "@/components/gaffer/planner/PriceWatch";
import { ChipLane } from "@/components/gaffer/planner/ChipLane";
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
import {
  HIT_COST,
  POS_LABEL,
  applyMoves,
  checkSwap,
  stageMove,
  summarisePlan,
  windowPoints,
  type PlanMove,
  type PlannerPlayer,
} from "@/lib/engines/planner";
import type { TickerCell } from "@/lib/engines/planner";
import type { PlannerData } from "@/lib/server/buildPlanner";

const MODES: { key: PitchMode; label: string; weeks: number }[] = [
  { key: "gw", label: "Next GW", weeks: 1 },
  { key: "run", label: "Next 3 GWs", weeks: 3 },
  { key: "price", label: "Price change", weeks: 1 },
];

type Tab = "squad" | "ticker" | "prices";

const PROJECTION_METHOD =
  "Projected points: FPL's own next-gameweek expectation blended with recent form, then scaled per gameweek by the opponent's attack and defence rates and the venue. Doubles stack, blanks score zero.";

/**
 * The transfer planner.
 *
 * Two taps make a transfer: choose who leaves on the pitch, choose who arrives
 * from the market. Everything the plan costs — the bank, the hits, the points
 * it buys you over the window — updates as you go, and nothing here touches
 * your real team: the plan lives in this browser until you make the moves in
 * the official game.
 */
export function TransferPlanner({ data }: { data: PlannerData }) {
  const [tab, setTab] = React.useState<Tab>("squad");
  const [mode, setMode] = React.useState<PitchMode>("run");
  const [selected, setSelected] = React.useState<number | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  // Up to four device-local slots so a patient plan and an aggressive one can
  // sit side by side. Desks saved by the old Board migrate in untouched.
  const [plans, setPlans] = React.useState<PlansState>(() => emptyPlans());

  const storageKey = `gaffer_board_v2_${data.teamId}`;
  const legacyKey = `gaffer_board_v1_${data.teamId}`;

  React.useEffect(() => {
    try {
      setPlans(loadPlans(localStorage.getItem(storageKey) ?? localStorage.getItem(legacyKey)));
    } catch {
      /* fresh plan */
    }
  }, [storageKey, legacyKey]);

  const persistPlans = React.useCallback(
    (next: PlansState) => {
      setPlans(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* storage blocked — the plan stays for this session */
      }
    },
    [storageKey],
  );

  const plan = activePlan(plans);
  const moves = plan.moves;

  const persist = React.useCallback(
    (next: PlanMove[]) => {
      persistPlans(withActive(plans, (pl) => ({ ...pl, moves: next })));
    },
    [plans, persistPlans],
  );

  const assignChip = React.useCallback(
    (key: string, gw: number | null) => {
      persistPlans(
        withActive(plans, (pl) => {
          const chips = { ...pl.chips };
          if (gw == null) delete chips[key];
          else chips[key] = gw;
          return { ...pl, chips };
        }),
      );
    },
    [plans, persistPlans],
  );

  const playersById = React.useMemo(
    () => new Map(data.players.map((p) => [p.id, p])),
    [data.players],
  );
  const playerOf = React.useCallback((id: number) => playersById.get(id), [playersById]);

  const sellPrices = React.useMemo(
    () => new Map(data.squad.map((s) => [s.element, s.sellPrice])),
    [data.squad],
  );
  const sellPriceOf = React.useCallback(
    (id: number) => sellPrices.get(id) ?? playersById.get(id)?.cost ?? 0,
    [sellPrices, playersById],
  );

  const baseIds = React.useMemo(() => data.squad.map((s) => s.element), [data.squad]);
  const workingIds = React.useMemo(() => applyMoves(baseIds, moves), [baseIds, moves]);
  const ownedIds = React.useMemo(() => new Set(workingIds), [workingIds]);

  const weeks = MODES.find((m) => m.key === mode)?.weeks ?? 3;

  const summary = React.useMemo(
    () =>
      summarisePlan(moves, {
        freeTransfers: data.freeTransfers,
        weeks,
        bankTenths: data.bankTenths,
        playerOf,
        sellPriceOf,
      }),
    [moves, data.freeTransfers, data.bankTenths, weeks, playerOf, sellPriceOf],
  );

  const fixtureFor = React.useCallback(
    (teamId: number, gw: number): TickerCell[] => data.ticker[teamId]?.[gw] ?? [],
    [data.ticker],
  );

  // The pitch shows the squad as it would be *after* the plan: staged arrivals
  // stand in their new slot with a marker naming who they replaced.
  const slots: PitchSlot[] = React.useMemo(() => {
    const replacedBy = new Map(moves.map((m) => [m.in, m.out]));
    return data.squad
      .map((s, i) => {
        const id = workingIds[i] ?? s.element;
        const player = playersById.get(id);
        if (!player) return null;
        const origin = replacedBy.get(id);
        return {
          player,
          replacing: origin != null ? (playersById.get(origin) ?? null) : null,
          bench: s.slot > 11,
          isCaptain: s.isCaptain && origin == null,
          isVice: s.isVice && origin == null,
        } satisfies PitchSlot;
      })
      .filter((s): s is PitchSlot => s !== null);
  }, [data.squad, workingIds, playersById, moves]);

  const outPlayer = selected != null ? (playersById.get(selected) ?? null) : null;
  const budgetTenths =
    outPlayer != null ? summary.bankTenths + sellPriceOf(outPlayer.id) : null;

  const swapCtx = React.useMemo(
    () => ({
      squadIds: workingIds,
      bankTenths: summary.bankTenths,
      playerOf,
      sellPriceOf,
    }),
    [workingIds, summary.bankTenths, playerOf, sellPriceOf],
  );

  const reasonFor = React.useCallback(
    (inId: number) => {
      if (selected == null) return null;
      const res = checkSwap(selected, inId, swapCtx);
      return res.ok ? null : (res.reason ?? "Not allowed");
    },
    [selected, swapCtx],
  );

  const pick = (inId: number) => {
    if (selected == null) return;
    const res = checkSwap(selected, inId, swapCtx);
    if (!res.ok) {
      setNotice(res.reason ?? "That move is not allowed");
      return;
    }
    persist(stageMove(moves, selected, inId));
    setSelected(null);
    setNotice(null);
  };

  const drop = (i: number) => persist(moves.filter((_, idx) => idx !== i));
  const reset = () => {
    persistPlans(withActive(plans, (pl) => ({ ...pl, moves: [], chips: {} })));
    setSelected(null);
  };

  React.useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const ownedClubs = React.useMemo(
    () => new Set(workingIds.map((id) => playersById.get(id)?.team).filter((t): t is number => t != null)),
    [workingIds, playersById],
  );

  if (data.squadUnavailable) {
    return (
      <div className="space-y-4">
        <PlannerNotice />
        <FixtureTicker clubs={data.clubs} gws={data.gws} ticker={data.ticker} />
        <PriceWatch players={data.players} clubs={data.clubs} ownedIds={new Set()} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* what the plan costs and buys — the numbers you decide on */}
      <PlanHeader
        summary={summary}
        freeTransfers={data.freeTransfers}
        weeks={weeks}
        squadValueTenths={data.squadValueTenths}
      />

      {/* plan slots — one desk per strategy, all device-local */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Plans" className="flex gap-1 rounded-md card-ring p-1">
          {plans.plans.map((pl) => (
            <button
              key={pl.id}
              type="button"
              aria-pressed={pl.id === plan.id}
              onClick={() => {
                persistPlans({ ...plans, active: pl.id });
                setSelected(null);
              }}
              className={cn(
                "skewed rounded-sm px-3 py-1.5 text-2xs uppercase-label transition-colors dur-instant",
                pl.id === plan.id ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
              )}
            >
              <span>
                {pl.name}
                {pl.moves.length > 0 ? ` · ${pl.moves.length}` : ""}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => persistPlans(addPlan(plans))}
            disabled={plans.plans.length >= MAX_PLANS}
            className="inline-flex h-11 items-center rounded-md card-ring px-4 text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi disabled:cursor-not-allowed disabled:opacity-40"
          >
            New plan
          </button>
          {plans.plans.length > 1 && (
            <button
              type="button"
              onClick={() => persistPlans(removePlan(plans, plan.id))}
              className="inline-flex h-11 items-center rounded-md card-ring px-4 text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-flare"
            >
              Delete plan
            </button>
          )}
        </div>
      </div>

      <div role="group" aria-label="Planner sections" className="flex flex-wrap gap-1 rounded-md card-ring p-1">
        {(
          [
            { key: "squad", label: "Squad & transfers" },
            { key: "ticker", label: "Fixture ticker" },
            { key: "prices", label: "Price watch" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "skewed rounded-sm px-3 py-2 text-2xs uppercase-label transition-colors dur-instant",
              tab === t.key ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
            )}
          >
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "squad" && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div role="group" aria-label="Pitch figure" className="flex gap-1 rounded-md card-ring p-1">
                {MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    aria-pressed={mode === m.key}
                    onClick={() => setMode(m.key)}
                    className={cn(
                      "skewed rounded-sm px-3 py-1.5 text-2xs uppercase-label transition-colors dur-instant",
                      mode === m.key ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
                    )}
                  >
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-2xs text-ink-lo" role="status">
                {selected
                  ? `${playersById.get(selected)?.name ?? ""} is on the block — pick a replacement from the market.`
                  : "Tap a player to put him on the block."}
              </p>
            </div>

            {notice && (
              <p role="alert" className="rounded-md bg-sunk card-ring px-3 py-2 text-xs text-flare">
                {notice}
              </p>
            )}

            <PlannerPitch
              slots={slots}
              mode={mode}
              weeks={weeks}
              selected={selected}
              onSelect={(id) => {
                setSelected((cur) => (cur === id ? null : id));
                setNotice(null);
              }}
              fixtureFor={fixtureFor}
              currentGw={data.gws[0]?.id ?? data.currentGw}
            />

            <PlanLedger
              moves={moves}
              weeks={weeks}
              playerOf={playerOf}
              sellPriceOf={sellPriceOf}
              freeTransfers={data.freeTransfers}
              onDrop={drop}
              onReset={reset}
            />

            <ChipLane
              gws={data.gws}
              chips={data.chips}
              wallGw={data.wallGw}
              currentGw={data.currentGw}
              assigned={plan.chips}
              onAssign={assignChip}
            />
          </div>

          <MarketPanel
            players={data.players}
            gws={data.gws}
            clubs={data.clubs}
            ownedIds={ownedIds}
            budgetTenths={budgetTenths}
            outPlayer={outPlayer}
            onPick={pick}
            reasonFor={reasonFor}
            fixtureFor={fixtureFor}
          />
        </div>
      )}

      {tab === "ticker" && (
        <FixtureTicker
          clubs={data.clubs}
          gws={data.gws}
          ticker={data.ticker}
          highlightTeams={ownedClubs}
        />
      )}

      {tab === "prices" && (
        <PriceWatch players={data.players} clubs={data.clubs} ownedIds={ownedIds} />
      )}

      <p className="text-2xs leading-relaxed text-ink-lo">
        Nothing here changes your real team. The plan is saved in this browser so you can come back
        to it, and the projections are estimates — check them against the fixtures before you commit.
      </p>
    </div>
  );
}

function PlanHeader({
  summary,
  freeTransfers,
  weeks,
  squadValueTenths,
}: {
  summary: ReturnType<typeof summarisePlan>;
  freeTransfers: number;
  weeks: number;
  squadValueTenths: number;
}) {
  const overdrawn = summary.bankTenths < 0;
  return (
    <dl
      aria-label="Plan resources"
      className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg has-gloss card-lift bg-raised px-4 py-3 sm:grid-cols-4 lg:grid-cols-5"
    >
      <div>
        <dt className="upper-label text-2xs text-ink-lo">In the bank</dt>
        <dd className={cn("fig-num mt-0.5 text-xl leading-none", overdrawn ? "text-flare" : "text-ink-hi")}>
          £{(summary.bankTenths / 10).toFixed(1)}m
        </dd>
      </div>
      <div>
        <dt className="upper-label text-2xs text-ink-lo">Free transfers</dt>
        <dd className="fig-num mt-0.5 text-xl leading-none text-ink-hi">
          {Math.max(0, freeTransfers - summary.transfers)}
          <span className="text-sm text-ink-lo"> / {freeTransfers}</span>
        </dd>
      </div>
      <div>
        <dt className="upper-label text-2xs text-ink-lo">Hits</dt>
        <dd className={cn("fig-num mt-0.5 text-xl leading-none", summary.hitCost > 0 ? "text-flare" : "text-ink-mid")}>
          {summary.hitCost > 0 ? `−${summary.hitCost}` : "—"}
        </dd>
      </div>
      <div>
        <dt className="upper-label text-2xs text-ink-lo">
          Net over {weeks} GW
        </dt>
        <dd
          className={cn(
            "fig-num mt-0.5 text-xl leading-none",
            summary.transfers === 0 ? "text-ink-mid" : summary.net >= 0 ? "text-surge" : "text-flare",
          )}
        >
          {summary.transfers === 0 ? (
            "—"
          ) : (
            <Est method={PROJECTION_METHOD}>
              {`${summary.net >= 0 ? "+" : "−"}${Math.abs(summary.net).toFixed(1)}`}
            </Est>
          )}
        </dd>
      </div>
      <div className="hidden lg:block">
        <dt className="upper-label text-2xs text-ink-lo">Squad value</dt>
        <dd className="fig-num mt-0.5 text-xl leading-none text-ink-hi">
          £{((squadValueTenths + summary.bankTenths) / 10).toFixed(1)}m
        </dd>
      </div>
    </dl>
  );
}

function PlanLedger({
  moves,
  weeks,
  playerOf,
  sellPriceOf,
  freeTransfers,
  onDrop,
  onReset,
}: {
  moves: PlanMove[];
  weeks: number;
  playerOf: (id: number) => PlannerPlayer | undefined;
  sellPriceOf: (id: number) => number;
  freeTransfers: number;
  onDrop: (i: number) => void;
  onReset: () => void;
}) {
  if (moves.length === 0) {
    return (
      <p className="rounded-md bg-sunk card-ring px-3 py-2.5 text-xs text-ink-lo">
        {freeTransfers >= 2
          ? `${freeTransfers} free transfers banked. Rolling is often the best move — nothing is staged.`
          : "No transfers staged. Tap a player on the pitch to start."}
      </p>
    );
  }
  return (
    <section aria-label="Staged transfers" className="rounded-md bg-sunk card-ring p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="upper-label text-2xs text-ink-lo">
          {moves.length} transfer{moves.length === 1 ? "" : "s"} staged
        </h3>
        <button
          type="button"
          onClick={onReset}
          className="relative text-2xs uppercase-label text-ink-lo transition-colors dur-instant after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] hover:text-flare"
        >
          Clear plan
        </button>
      </div>
      <ul className="space-y-1.5">
        {moves.map((m, i) => {
          const out = playerOf(m.out);
          const incoming = playerOf(m.in);
          const gain =
            windowPoints(incoming?.horizon, weeks) - windowPoints(out?.horizon, weeks);
          const cost = incoming && out ? (incoming.cost - sellPriceOf(out.id)) / 10 : 0;
          const free = i < freeTransfers;
          return (
            <li
              key={`${m.out}-${m.in}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm bg-raised px-2.5 py-2 text-xs"
            >
              <span className="text-ink-mid">
                {out?.name ?? m.out}
                <span className="ml-1 text-2xs text-ink-lo">
                  {out ? POS_LABEL[out.pos] : ""}
                </span>
              </span>
              <span aria-hidden className="text-ink-lo">
                →
              </span>
              <span className="font-semibold text-ink-hi">{incoming?.name ?? m.in}</span>
              <span className="text-2xs text-ink-lo num-tabular">
                {cost >= 0 ? "costs" : "frees"} £{Math.abs(cost).toFixed(1)}m
              </span>
              <span
                className={cn(
                  "ml-auto num-tabular",
                  gain >= 0 ? "text-surge" : "text-flare",
                )}
              >
                <Est method={PROJECTION_METHOD}>
                  {`${gain >= 0 ? "+" : "−"}${Math.abs(gain).toFixed(1)} over ${weeks} GW`}
                </Est>
              </span>
              <span className={cn("text-2xs uppercase-label", free ? "text-ink-lo" : "text-flare")}>
                {free ? "free" : `−${HIT_COST}`}
              </span>
              <button
                type="button"
                onClick={() => onDrop(i)}
                aria-label={`Undo ${out?.name ?? "this"} to ${incoming?.name ?? "this"}`}
                className="relative text-2xs uppercase-label text-ink-lo transition-colors dur-instant after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] hover:text-flare"
              >
                Undo
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PlannerNotice() {
  return (
    <div className="rounded-lg bg-raised card-ring p-4">
      <h2 className="fig-num text-lg leading-none text-ink-hi">Squad not available yet</h2>
      <p className="mt-2 max-w-[62ch] text-xs leading-relaxed text-ink-mid">
        FPL has not published picks for this team this gameweek — that happens before the season&apos;s
        first deadline, or briefly while the game updates. The fixture ticker and price watch below
        work regardless; come back for the pitch once the deadline passes.
      </p>
    </div>
  );
}
