"use client";

import * as React from "react";
import Link from "next/link";
import { scaleLinear } from "d3-scale";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { CrestBadge } from "@/components/gaffer/CrestBadge";
import { cn } from "@/lib/ui/cn";
import { POSITION_SHORT } from "@/lib/ui/format";
import {
  buildCombo,
  costBand,
  headToHead,
  type Combo,
  type ComboPlayer,
} from "@/lib/engines/combos";

/**
 * The combination board.
 *
 * Four reads of the same shortlist, in the order the question actually gets
 * asked: put two sides against each other, see what each budget buys, see the
 * shape of the whole trade-off, then browse the leaders.
 */

export interface ComboBoardData {
  gw: number;
  pool: ComboPlayer[];
  best: Combo[];
  value: Combo[];
  differential: Combo[];
  ladder: Combo[];
  frontier: Combo[];
  rate: number;
  floor: number;
  owned: number[];
}

const money = (m: number) => `£${m.toFixed(1)}m`;

export function ComboBoards({ data }: { data: ComboBoardData }) {
  const ownedSet = React.useMemo(() => new Set(data.owned), [data.owned]);
  const byId = React.useMemo(() => new Map(data.pool.map((p) => [p.id, p])), [data.pool]);

  return (
    <div className="space-y-8">
      <Duel pool={data.pool} byId={byId} rate={data.rate} owned={ownedSet} />
      <Ladder rows={data.ladder} rate={data.rate} owned={ownedSet} />
      <CostPoints best={data.best} frontier={data.frontier} owned={ownedSet} />
      <Boards data={data} owned={ownedSet} />
    </div>
  );
}

/* ── 1. two sides, one budget ───────────────────────────────────────────────
   The screen the page exists for. Two mid-price players against one premium is
   the commonest decision in the game and the hardest to eyeball, because the
   sides never cost the same and the difference has to go somewhere. */

function Duel({
  pool,
  byId,
  rate,
  owned,
}: {
  pool: ComboPlayer[];
  byId: Map<number, ComboPlayer>;
  rate: number;
  owned: Set<number>;
}) {
  /* Opening positions that make the point without being asked: the two best
     value players on one side, the single biggest scorer on the other. */
  const [sideA, setSideA] = React.useState<number[]>(() =>
    [...pool]
      .filter((p) => p.cost > 0)
      .sort((a, b) => b.points / b.cost - a.points / a.cost)
      .slice(0, 2)
      .map((p) => p.id),
  );
  const [sideB, setSideB] = React.useState<number[]>(() =>
    [...pool].sort((a, b) => b.points - a.points).slice(0, 1).map((p) => p.id),
  );

  const pick = (ids: number[]) => ids.map((id) => byId.get(id)).filter(Boolean) as ComboPlayer[];
  const a = buildCombo(pick(sideA));
  const b = buildCombo(pick(sideB));
  const h = headToHead(a, b, rate);
  const live = sideA.length > 0 && sideB.length > 0;

  return (
    <section aria-label="Head to head" className="space-y-3">
      <Heading
        eyebrow="Head to head"
        title="Two sides, the same money"
        blurb="The cheaper side is credited with what its spare million buys at replacement level, because in a real squad that money is not sitting in the bank — it is buying somebody."
      />

      <div className="grid gap-3 md:grid-cols-2">
        <Side label="Side A" tone="volt" ids={sideA} onChange={setSideA} pool={pool} byId={byId} owned={owned} />
        <Side label="Side B" tone="ultra" ids={sideB} onChange={setSideB} pool={pool} byId={byId} owned={owned} />
      </div>

      {live ? (
        <div className="rounded-lg bg-surface-1 card-ring p-4 md:p-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
            <TotalCell label="Side A" combo={a} adjusted={h.adjustedA} spare={h.spareOn === "a" ? h.spareWorth : 0} align="right" />
            <div className="shrink-0 text-center">
              <span
                className={cn(
                  "skewed inline-flex h-9 min-w-[70px] items-center justify-center rounded-md px-3",
                  h.margin === 0 ? "bg-surface-3 text-ink-mid" : h.margin > 0 ? "bg-volt" : "bg-ultra",
                  h.margin !== 0 && "text-on-accent",
                )}
                aria-label={
                  h.margin === 0
                    ? "The two sides are level"
                    : `Side ${h.margin > 0 ? "A" : "B"} is ${Math.abs(h.margin).toFixed(1)} points better at the same spend`
                }
              >
                <span className="fig-num text-xl leading-none">
                  {h.margin === 0 ? "level" : `${h.margin > 0 ? "+" : "−"}${Math.abs(h.margin).toFixed(1)}`}
                </span>
              </span>
              <p aria-hidden className="upper-label mt-1 text-[9px] text-ink-lo">
                {h.margin === 0 ? "" : h.margin > 0 ? "A ahead" : "B ahead"}
              </p>
            </div>
            <TotalCell label="Side B" combo={b} adjusted={h.adjustedB} spare={h.spareOn === "b" ? h.spareWorth : 0} align="left" />
          </div>

          <p className="mt-4 border-t border-hairline pt-3 text-xs leading-relaxed text-ink-lo">
            {h.spareOn == null ? (
              <>Both sides cost {money(a.cost)}, so nothing needs settling — this is a straight comparison.</>
            ) : h.unpriced ? (
              <>
                Side {h.spareOn.toUpperCase()} is {money(h.spare)} cheaper, but nobody in the game is
                yet both cheap and playing enough to price that money. The totals above are raw.
              </>
            ) : (
              <>
                Side {h.spareOn.toUpperCase()} is {money(h.spare)} cheaper. At{" "}
                <span className="num-tabular text-ink-mid">{rate.toFixed(1)}</span> points per
                million — what a playing enabler actually returns this season — that money is worth{" "}
                <span className="num-tabular text-ink-mid">{h.spareWorth.toFixed(1)}</span> points
                elsewhere, and it has been added to that side.
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="rounded-lg bg-surface-1 card-ring p-8 text-center text-sm text-ink-lo">
          Put at least one player on each side.
        </p>
      )}
    </section>
  );
}

function Side({
  label,
  tone,
  ids,
  onChange,
  pool,
  byId,
  owned,
}: {
  label: string;
  tone: "volt" | "ultra";
  ids: number[];
  onChange: (ids: number[]) => void;
  pool: ComboPlayer[];
  byId: Map<number, ComboPlayer>;
  owned: Set<number>;
}) {
  const taken = new Set(ids);
  const combo = buildCombo(ids.map((id) => byId.get(id)).filter(Boolean) as ComboPlayer[]);

  return (
    <div className="rounded-lg bg-surface-1 card-ring p-3 md:p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn("upper-label text-2xs", tone === "volt" ? "text-volt" : "text-ultra")}>
          {label}
        </p>
        <p className="text-2xs text-ink-lo num-tabular">
          {money(combo.cost)} · {combo.points} pts
        </p>
      </div>

      <ul className="mt-2 space-y-1.5">
        {ids.map((id) => {
          const p = byId.get(id);
          if (!p) return null;
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-md bg-surface-3/60 px-2 py-1.5"
            >
              <CrestBadge teamId={p.teamId} size={16} />
              <Link href={`/players/${p.id}`} className="min-w-0 flex-1 truncate text-sm text-ink-hi hover:text-volt">
                {p.name}
              </Link>
              {owned.has(p.id) && (
                <span className="upper-label shrink-0 text-[9px] text-volt" title="in your squad">
                  yours
                </span>
              )}
              <span className="shrink-0 text-2xs text-ink-lo num-tabular">
                {money(p.cost / 10)} · {p.points}
              </span>
              <button
                type="button"
                onClick={() => onChange(ids.filter((x) => x !== id))}
                aria-label={`Take ${p.name} off ${label}`}
                className="shrink-0 rounded-sm px-1 text-ink-lo transition-colors dur-instant hover:text-flare"
              >
                ×
              </button>
            </li>
          );
        })}
        {ids.length === 0 && <li className="py-1.5 text-xs text-ink-lo">Nobody yet.</li>}
      </ul>

      {ids.length < 3 && (
        <label className="mt-2 block">
          <span className="sr-only">Add a player to {label}</span>
          <select
            value=""
            onChange={(e) => {
              const id = Number(e.target.value);
              if (id) onChange([...ids, id]);
            }}
            className="h-9 w-full rounded-md bg-sunk px-2 text-sm text-ink-hi card-ring focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt"
          >
            <option value="">Add a player…</option>
            {[2, 3, 4, 1].map((pos) => {
              const group = pool.filter((p) => p.pos === pos && !taken.has(p.id));
              if (group.length === 0) return null;
              return (
                <optgroup key={pos} label={POSITION_SHORT[pos] ?? "Other"}>
                  {group.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {money(p.cost / 10)}, {p.points} pts
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
      )}
    </div>
  );
}

function TotalCell({
  label,
  combo,
  adjusted,
  spare,
  align,
}: {
  label: string;
  combo: Combo;
  adjusted: number;
  spare: number;
  align: "left" | "right";
}) {
  return (
    <div className={cn("min-w-0", align === "right" ? "text-right" : "text-left")}>
      <p className="upper-label truncate text-2xs text-ink-lo">{label}</p>
      <p className="fig-num mt-0.5 text-[clamp(28px,6vw,40px)] leading-none">
        {adjusted.toFixed(adjusted % 1 === 0 ? 0 : 1)}
      </p>
      <p className="mt-1 text-2xs text-ink-lo num-tabular">
        {combo.points} pts · {money(combo.cost)}
        {spare > 0 && <span className="text-surge"> +{spare.toFixed(1)} spare</span>}
      </p>
    </div>
  );
}

/* ── 2. what each budget buys ───────────────────────────────────────────────
   A ladder rather than a leaderboard. Sorting pairs by points returns the most
   expensive pairs and tells you nothing; the best pair in each bracket tells
   you what the next two million actually adds. */

function Ladder({ rows, rate, owned }: { rows: Combo[]; rate: number; owned: Set<number> }) {
  const max = Math.max(1, ...rows.map((r) => r.points));

  return (
    <section aria-label="What each budget buys" className="space-y-3">
      <Heading
        eyebrow="The ladder"
        title="What each budget buys"
        blurb="The best pair inside every two-million bracket. Read down it and the question stops being who is good and starts being whether the next two million is worth what it adds."
      />
      <ul className="space-y-1.5">
        {rows.map((r, i) => {
          const prev = rows[i - 1];
          const stepPoints = prev ? r.points - prev.points : null;
          const stepCost = prev ? r.cost - prev.cost : null;
          const stepRate = stepPoints != null && stepCost ? stepPoints / stepCost : null;
          return (
            <li key={r.key} className="rounded-lg bg-surface-1 card-ring p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="upper-label w-[104px] shrink-0 text-2xs text-ink-lo num-tabular">
                  {costBand(r.cost, 2)}
                </span>
                <ComboNames combo={r} owned={owned} />
                <span className="ml-auto flex shrink-0 items-baseline gap-2">
                  <span className="fig-num text-lg leading-none text-ink-hi">{r.points}</span>
                  <span className="text-2xs text-ink-lo num-tabular">{money(r.cost)}</span>
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-sunk">
                  <span
                    className="block h-full rounded-full bg-volt transition-[width] dur-slow"
                    style={{ width: `${Math.max(2, (r.points / max) * 100)}%` }}
                  />
                </span>
                {stepRate != null && (
                  <span
                    className={cn(
                      "shrink-0 text-2xs num-tabular",
                      stepRate >= rate ? "text-surge" : "text-ink-lo",
                    )}
                    title={
                      stepRate >= rate
                        ? "This step beats what the same money returns at replacement level"
                        : "This step returns less than the same money would elsewhere"
                    }
                  >
                    +{stepPoints} for {money(stepCost ?? 0)} · {stepRate.toFixed(1)}/m
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-2xs leading-relaxed text-ink-lo">
        A step in <span className="text-surge">green</span> returns more per million than the{" "}
        <span className="num-tabular">{rate.toFixed(1)}</span> a playing enabler does, so it is worth
        the upgrade. A grey step is money that would do more work somewhere else in the squad.
      </p>
    </section>
  );
}

/* ── 3. the whole trade-off, at once ────────────────────────────────────────
   Every leading pair on money against points, with the frontier drawn through
   the ones nothing beats on both. Anything below the line is a pair you can
   improve on without spending a penny more. */

function CostPoints({
  best,
  frontier,
  owned,
}: {
  best: Combo[];
  frontier: Combo[];
  owned: Set<number>;
}) {
  const W = 560;
  const H = 320;
  const M = { top: 14, right: 18, bottom: 42, left: 46 };
  const all = [...best, ...frontier];
  if (all.length === 0) return null;

  const xs = all.map((c) => c.cost);
  const ys = all.map((c) => c.points);
  const x = scaleLinear().domain([Math.min(...xs) * 0.96, Math.max(...xs) * 1.03]).range([M.left, W - M.right]);
  const y = scaleLinear().domain([Math.min(...ys) * 0.94, Math.max(...ys) * 1.04]).range([H - M.bottom, M.top]);

  const line = frontier
    .map((c, i) => `${i === 0 ? "M" : "L"}${x(c.cost).toFixed(1)},${y(c.points).toFixed(1)}`)
    .join(" ");

  return (
    <ChartFrame
      eyebrow="The trade-off"
      title="Money against points, every leading pair"
      ariaLabel="Scatter of combined cost against combined points for the leading pairs, with the efficient frontier"
      caption="The line joins the pairs nothing else beats on both money and points. A dot below it is a pair you can improve on without spending anything more."
      table={{
        headers: ["Pair", "Cost", "Points", "Per £m"],
        rows: frontier.map((c) => [
          c.players.map((p) => p.name).join(" + "),
          money(c.cost),
          c.points,
          c.ppm.toFixed(1),
        ]) as (string | number)[][],
      }}
    >
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
          <text key={`x${t}`} x={x(t)} y={H - M.bottom + 14} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
            £{t}m
          </text>
        ))}

        {frontier.length > 1 && (
          <path d={line} fill="none" stroke="var(--surge)" strokeWidth="1.75" strokeDasharray="5 4" />
        )}

        {best.map((c) => {
          const mine = c.players.some((p) => owned.has(p.id));
          return (
            <circle
              key={c.key}
              cx={x(c.cost)}
              cy={y(c.points)}
              r={mine ? 5 : 3.4}
              fill={mine ? "var(--volt)" : "var(--ink-lo)"}
              fillOpacity={mine ? 1 : 0.4}
            >
              <title>{`${c.players.map((p) => p.name).join(" + ")} — ${c.points} points for ${money(c.cost)} (${c.ppm.toFixed(1)}/m)`}</title>
            </circle>
          );
        })}
        {frontier.map((c) => (
          <circle key={`f${c.key}`} cx={x(c.cost)} cy={y(c.points)} r={4.4} fill="var(--surge)">
            <title>{`On the frontier — ${c.players.map((p) => p.name).join(" + ")}, ${c.points} points for ${money(c.cost)}`}</title>
          </circle>
        ))}

        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
          combined cost
        </text>
        <text
          x={12}
          y={H / 2}
          textAnchor="middle"
          fontSize="10"
          className="fill-(--ink-lo)"
          transform={`rotate(-90 12 ${H / 2})`}
        >
          combined points
        </text>
      </svg>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-lo">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-surge" />
          on the frontier
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-volt" />
          contains a player of yours
        </span>
      </p>
    </ChartFrame>
  );
}

/* ── 4. the leaders, three ways ─────────────────────────────────────────── */

const BOARDS = [
  { id: "best", label: "Most points", blurb: "The thirty highest-scoring pairs on the shortlist. Expensive, by definition." },
  { id: "value", label: "Best value", blurb: "The thirty highest returns per million. This is the board that finds the enablers everybody else is ignoring." },
  { id: "differential", label: "Least owned", blurb: "The thirty pairs the field is least likely to already have. A rank is won on what other people do not own." },
] as const;
type BoardId = (typeof BOARDS)[number]["id"];

function Boards({ data, owned }: { data: ComboBoardData; owned: Set<number> }) {
  const [board, setBoard] = React.useState<BoardId>("best");
  const rows = data[board];
  const meta = BOARDS.find((b) => b.id === board)!;

  return (
    <section aria-label="Top thirty combinations" className="space-y-3">
      <Heading eyebrow="Top thirty" title="The leading pairs" blurb={meta.blurb} />

      <div role="group" aria-label="Board" className="flex flex-wrap gap-1 rounded-md glass-edge p-1">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBoard(b.id)}
            aria-pressed={board === b.id}
            className={cn(
              "skewed rounded-sm px-3 py-1.5 text-xs uppercase-label transition-colors dur-instant",
              board === b.id ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
            )}
          >
            <span>{b.label}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg bg-surface-1 card-ring">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{meta.label}. {meta.blurb}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 border-b border-hairline bg-surface-1 px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-ink-3">
                Pair
              </th>
              {["Cost", "Pts", "Per £m", "xGI", "G", "A", "Bonus", "Owned", "Clubs"].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap border-b border-hairline px-2 py-2 text-right text-2xs font-semibold uppercase tracking-wide text-ink-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.key} className="border-b border-hairline last:border-0">
                <th scope="row" className="sticky left-0 z-10 bg-surface-1 px-3 py-2 text-left font-normal">
                  <ComboNames combo={c} owned={owned} />
                </th>
                <Num>{money(c.cost)}</Num>
                <td className="px-2 py-2 text-right text-xs num-tabular">
                  <span className="fig-num text-sm text-ink-hi">{c.points}</span>
                </td>
                <Num>{c.ppm.toFixed(1)}</Num>
                <Num>{c.xgi.toFixed(1)}</Num>
                <Num>{c.goals}</Num>
                <Num>{c.assists}</Num>
                <Num>{c.bonus}</Num>
                <Num>{c.owned.toFixed(1)}%</Num>
                <td className="px-2 py-2 text-right text-xs num-tabular">
                  <span className={c.clubs === 1 ? "text-amber" : "text-ink-mid"} title={c.clubs === 1 ? "Both from one club — they share every blank" : undefined}>
                    {c.clubs}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-2xs leading-relaxed text-ink-lo">
        Season totals, not projections. Ownership is the average of the two, because two players
        owned by forty per cent each are not owned by eighty per cent of the game. A pair on{" "}
        <span className="text-amber">one club</span> shares every blank, every bad afternoon and
        every rotation.
      </p>
    </section>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-2 text-right text-xs text-ink-mid num-tabular">{children}</td>;
}

function ComboNames({ combo, owned }: { combo: Combo; owned: Set<number> }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {combo.players.map((p, i) => (
        <React.Fragment key={p.id}>
          {i > 0 && <span aria-hidden className="text-2xs text-ink-lo">+</span>}
          <span className="inline-flex items-center gap-1">
            <CrestBadge teamId={p.teamId} size={14} />
            <Link
              href={`/players/${p.id}`}
              className={cn(
                "truncate text-sm transition-colors dur-instant hover:text-volt",
                owned.has(p.id) ? "font-semibold text-volt" : "text-ink-hi",
              )}
            >
              {p.name}
            </Link>
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

function Heading({ eyebrow, title, blurb }: { eyebrow: string; title: string; blurb: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div>
        <p className="upper-label text-2xs text-ink-lo">{eyebrow}</p>
        <h2 className="text-base font-medium tracking-tight text-ink-hi">{title}</h2>
      </div>
      <p className="max-w-[60ch] text-xs leading-relaxed text-ink-lo">{blurb}</p>
    </div>
  );
}
