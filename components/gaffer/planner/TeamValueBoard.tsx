"use client";

import * as React from "react";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { PlayerAvatar, useAvatarMode } from "@/components/gaffer/PlayerAvatar";
import { cn } from "@/lib/ui/cn";
import {
  fmtDeltaM,
  fmtM,
  priceLedger,
  readTeamValue,
  topMovers,
  type PriceMove,
  type ValuePoint,
} from "@/lib/engines/teamValue";

const OWNED_NOTE =
  "Each figure is what the player has done since the season opened, which is not the same as what he made you: you only ride the part of a rise that happened after you bought him, and FPL pays back half of it when you sell.";

/**
 * Team value, and the price moves underneath it.
 *
 * Value was a single number in the corner of the planner header, mislabelled
 * "squad value" and hidden below a large breakpoint — so on a phone the one
 * figure that says whether a season of transfers has actually paid was not on
 * the screen at all. It gets a board: what you are worth now, what that is
 * against the hundred everybody started with, the shape of how it got there,
 * and then the men who moved it.
 */
export function TeamValueBoard({
  teamValueTenths,
  bankTenths,
  valueSeries,
  ownedMoves,
  marketMoves,
}: {
  teamValueTenths: number;
  bankTenths: number;
  valueSeries: ValuePoint[];
  /** Your fifteen. */
  ownedMoves: PriceMove[];
  /** The whole market, for the season's biggest movers. */
  marketMoves: PriceMove[];
}) {
  const value = React.useMemo(
    () => readTeamValue(valueSeries, { totalTenths: teamValueTenths, bankTenths }),
    [valueSeries, teamValueTenths, bankTenths],
  );
  const mine = React.useMemo(() => priceLedger(ownedMoves), [ownedMoves]);

  return (
    <section aria-label="Team value" className="space-y-3">
      <ValueHeadline value={value} ledger={mine} />
      {/* The trail is a season-long shape and takes the full width; below it
          your fifteen sits beside the two market lists, which stack to roughly
          the same height so neither column trails a column of empty card. */}
      <ValueTrail value={value} />
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <OwnedLedger ledger={mine} />
        <MarketMovers moves={marketMoves} />
      </div>
    </section>
  );
}

/** The four figures, largest first. */
function ValueHeadline({
  value,
  ledger,
}: {
  value: ReturnType<typeof readTeamValue>;
  ledger: ReturnType<typeof priceLedger>;
}) {
  const up = value.changeTenths > 0;
  const flat = value.changeTenths === 0;
  return (
    <div className="rounded-lg has-gloss card-lift bg-raised p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="upper-label text-2xs text-ink-lo">Team value</div>
          <div className="fig-num mt-1 text-[34px] leading-none text-ink-hi">{fmtM(value.totalTenths)}</div>
          <div
            className={cn(
              "mt-1.5 text-xs num-tabular",
              flat ? "text-ink-lo" : up ? "text-surge" : "text-flare",
            )}
          >
            {fmtDeltaM(value.changeTenths)}
            <span className="text-ink-lo"> since the £100.0m everyone started on</span>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-x-5 gap-y-2">
          <Cell label="Squad" value={fmtM(value.squadTenths)} />
          <Cell
            label="In the bank"
            value={fmtM(value.bankTenths)}
            tone={value.bankTenths < 0 ? "flare" : undefined}
          />
          <Cell
            label="Up / down"
            value={`${ledger.risen} / ${ledger.fallen}`}
            hint={`${ledger.risen} of your fifteen are up on their opening price, ${ledger.fallen} are down.`}
          />
        </dl>
      </div>
      {/*
       * The caveat belongs next to the number, not in a tooltip nobody opens.
       * A squad whose players have collectively risen £4m has not gained £4m:
       * the rises that happened before you bought them were never yours, and
       * FPL keeps half of the rest when you sell.
       */}
      <p className="mt-3 border-t border-hairline pt-2.5 text-2xs leading-relaxed text-ink-lo">
        Team value is your fifteen at their selling prices plus whatever is in the bank — the same figure FPL
        shows. Selling banks only half a player&rsquo;s rise, rounded down, so it always trails the sum of the
        price changes below.
      </p>
    </div>
  );
}

function Cell({ label, value, tone, hint }: { label: string; value: string; tone?: "flare"; hint?: string }) {
  return (
    <div title={hint}>
      <dt className="upper-label text-2xs text-ink-lo">{label}</dt>
      <dd className={cn("fig-num mt-0.5 text-lg leading-none", tone === "flare" ? "text-flare" : "text-ink-hi")}>
        {value}
      </dd>
    </div>
  );
}

/**
 * The season's trail as an area, with the £100.0m line drawn across it.
 *
 * A value chart with a zero baseline is all chart and no information — every
 * squad in the game sits between 98 and 105, so on a 0–105 axis the whole
 * season is a flat line at the top. The band is drawn tight around the range
 * actually travelled, and the starting budget is a rule across it so a reader
 * can see at a glance which side of even they are on.
 */
function ValueTrail({ value }: { value: ReturnType<typeof readTeamValue> }) {
  const pts = value.series;
  if (pts.length < 2) {
    return (
      <ChartFrame
        eyebrow="Season"
        title="Where your value has been"
        ariaLabel="Team value by gameweek"
        caption="Two gameweeks of history are needed before there is a line to draw."
      >
        <div className="grid h-[150px] place-items-center text-2xs text-ink-lo">
          Not enough of the season has been played yet.
        </div>
      </ChartFrame>
    );
  }

  const W = 300;
  const H = 120;
  const vals = pts.map((p) => p.totalTenths);
  const lo = Math.min(...vals, value.startTenths);
  const hi = Math.max(...vals, value.startTenths);
  // A dead-flat season would divide by zero; give it a £0.5m window either way.
  const pad = Math.max(2, Math.round((hi - lo) * 0.15));
  const top = hi + pad;
  const bottom = lo - pad;
  const span = top - bottom;

  const x = (i: number) => (pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * W);
  const y = (v: number) => H - ((v - bottom) / span) * H;

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.totalTenths).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const startY = y(value.startTenths);
  const last = pts[pts.length - 1];
  const above = last.totalTenths >= value.startTenths;

  return (
    <ChartFrame
      eyebrow="Season"
      title="Where your value has been"
      ariaLabel={`Team value by gameweek, ${fmtM(pts[0].totalTenths)} in GW${pts[0].gw} to ${fmtM(last.totalTenths)} in GW${last.gw}`}
      table={{
        headers: ["GW", "Value", "Move"],
        rows: pts.map((p, i) => [
          `GW${p.gw}`,
          fmtM(p.totalTenths),
          i === 0 ? "—" : fmtDeltaM(p.totalTenths - pts[i - 1].totalTenths),
        ]),
      }}
      caption={
        value.best
          ? `Best week GW${value.best.gw} at ${fmtDeltaM(value.best.deltaTenths)}${
              value.worst ? `, worst GW${value.worst.gw} at ${fmtDeltaM(value.worst.deltaTenths)}` : ""
            }.`
          : "No gameweek has moved your value yet."
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="tv-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={above ? "var(--surge)" : "var(--flare)"} stopOpacity="0.32" />
            <stop offset="100%" stopColor={above ? "var(--surge)" : "var(--flare)"} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#tv-fill)" />
        <path d={line} fill="none" stroke={above ? "var(--surge)" : "var(--flare)"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {/* the hundred everybody started on */}
        <line
          x1="0"
          x2={W}
          y1={startY}
          y2={startY}
          stroke="var(--ink-lo)"
          strokeWidth="1"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex items-center justify-between text-2xs text-ink-lo num-tabular">
        <span>GW{pts[0].gw}</span>
        <span>£100.0m start</span>
        <span>GW{last.gw}</span>
      </div>
    </ChartFrame>
  );
}

/** Your fifteen, biggest season riser first. */
function OwnedLedger({ ledger }: { ledger: ReturnType<typeof priceLedger> }) {
  const [avatar] = useAvatarMode();
  if (ledger.moves.length === 0) {
    return (
      <div className="rounded-lg bg-surface-1 has-gloss card-lift p-4 text-2xs text-ink-lo md:p-5">
        Your squad is not visible, so there is nothing to price. Sign in on FPL and reload.
      </div>
    );
  }
  return (
    <figure className="rounded-lg bg-surface-1 has-gloss card-lift p-4 md:p-5">
      <figcaption className="mb-3">
        <div className="upper-label text-2xs text-ink-lo">Your fifteen</div>
        <div className="text-sm font-medium text-ink-1">What each has done since GW1</div>
      </figcaption>
      <ul className="space-y-1">
        {ledger.moves.map((m) => (
          <PriceRow key={m.id} move={m} avatar={avatar} />
        ))}
      </ul>
      <p className="mt-3 border-t border-hairline pt-2.5 text-2xs leading-relaxed text-ink-lo">{OWNED_NOTE}</p>
    </figure>
  );
}

/** The market's biggest movers, both ways, at a glance. */
function MarketMovers({ moves }: { moves: PriceMove[] }) {
  const [avatar] = useAvatarMode();
  const risers = React.useMemo(() => topMovers(moves, "up"), [moves]);
  const fallers = React.useMemo(() => topMovers(moves, "down"), [moves]);
  return (
    <div className="grid items-start gap-3">
      <MoverList
        eyebrow="The market"
        title="Season's biggest risers"
        moves={risers}
        avatar={avatar}
        empty="Nobody has risen yet."
      />
      <MoverList
        eyebrow="The market"
        title="Season's biggest fallers"
        moves={fallers}
        avatar={avatar}
        empty="Nobody has fallen yet."
      />
    </div>
  );
}

function MoverList({
  eyebrow,
  title,
  moves,
  avatar,
  empty,
}: {
  eyebrow: string;
  title: string;
  moves: PriceMove[];
  avatar: ReturnType<typeof useAvatarMode>[0];
  empty: string;
}) {
  return (
    <figure className="rounded-lg bg-surface-1 has-gloss card-lift p-4 md:p-5">
      <figcaption className="mb-3">
        <div className="upper-label text-2xs text-ink-lo">{eyebrow}</div>
        <div className="text-sm font-medium text-ink-1">{title}</div>
      </figcaption>
      {moves.length === 0 ? (
        <p className="text-2xs text-ink-lo">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {moves.map((m) => (
            <PriceRow key={m.id} move={m} avatar={avatar} />
          ))}
        </ul>
      )}
    </figure>
  );
}

/**
 * One player's money, on a line.
 *
 * The season move is the headline because it is the one that compounds; this
 * gameweek's move sits beside it only when there has been one, so a quiet week
 * reads as quiet rather than as a column of zeroes.
 */
function PriceRow({ move, avatar }: { move: PriceMove; avatar: ReturnType<typeof useAvatarMode>[0] }) {
  const up = move.startTenths > 0;
  const down = move.startTenths < 0;
  return (
    <li className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 odd:bg-surface-2/40">
      {/* the avatar needs a fixed box of its own — a kit fills its parent, so
          sizing the component itself leaves it no frame to fill */}
      <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-sm bg-surface-2">
        <PlayerAvatar
          photo={move.photo}
          teamId={move.teamId}
          mode={avatar}
          className="h-8 w-8 object-cover object-top"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-ink-hi">{move.name}</span>
        <span className="block truncate text-[10px] leading-tight text-ink-lo num-tabular">
          {move.code} · {fmtM(move.costTenths)}
        </span>
      </span>
      {move.eventTenths !== 0 && (
        <span
          title="Moved this gameweek"
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none num-tabular",
            move.eventTenths > 0 ? "bg-surge/15 text-surge" : "bg-flare/15 text-flare",
          )}
        >
          {move.eventTenths > 0 ? "▲" : "▼"}
        </span>
      )}
      <span
        className={cn(
          "w-14 shrink-0 text-right text-xs font-semibold num-tabular",
          up ? "text-surge" : down ? "text-flare" : "text-ink-lo",
        )}
      >
        {fmtDeltaM(move.startTenths)}
      </span>
    </li>
  );
}
