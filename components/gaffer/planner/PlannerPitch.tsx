"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { PlayerAvatar, useAvatarMode } from "@/components/gaffer/PlayerAvatar";
import { ClubFlag } from "@/components/gaffer/ClubCrest";
import { POS_LABEL, POS_NAME, priceOutlook, windowPoints, type PlannerPlayer } from "@/lib/engines/planner";
import type { TickerCell } from "@/lib/engines/planner";

export type PitchMode = "gw" | "run" | "price";

export interface PitchSlot {
  player: PlannerPlayer;
  /** Original squad member this slot replaces, when a move is staged here. */
  replacing: PlannerPlayer | null;
  bench: boolean;
  isCaptain: boolean;
  isVice: boolean;
}

/**
 * The pitch. Eleven starters in their formation rows, four on the bench, each
 * tile carrying the one number the current mode is about — this week's
 * projection, the run over the window, or how close the price is to moving.
 *
 * Tapping a tile is the whole transfer interaction: it puts that player on the
 * block and the market panel answers with replacements.
 */
export function PlannerPitch({
  slots,
  mode,
  weeks,
  selected,
  onSelect,
  fixtureFor,
  currentGw,
}: {
  slots: PitchSlot[];
  mode: PitchMode;
  weeks: number;
  selected: number | null;
  onSelect: (id: number) => void;
  fixtureFor: (teamId: number, gw: number) => TickerCell[];
  currentGw: number;
}) {
  const starters = slots.filter((s) => !s.bench);
  const bench = slots.filter((s) => s.bench);

  const rows: PitchSlot[][] = [1, 2, 3, 4].map((pos) => starters.filter((s) => s.player.pos === pos));

  // The heat spread is taken from the eleven on the grass, so the ramp always
  // uses its full range instead of bunching around the squad's average.
  const values = starters.map((s) => windowPoints(s.player.horizon, weeks));
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values, 1);

  return (
    <div
      aria-label="Your squad on the pitch"
      role="group"
      className="relative overflow-hidden rounded-lg card-ring"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--bg-raised) 92%, var(--volt)) 0%, var(--bg-raised) 34%, var(--bg-sunk) 100%)",
      }}
    >
      {/* pitch markings — chrome, never a data encoding */}
      <PitchMarkings />

      <div className="relative space-y-3 px-2 py-4 sm:px-4">
        {rows.map((row, i) =>
          row.length === 0 ? null : (
            <ul
              key={i}
              aria-label={`${POS_LABEL[i + 1]} line`}
              className="flex flex-wrap items-stretch justify-center gap-1.5 sm:gap-2"
            >
              {row.map((slot) => (
                <li key={slot.player.id} className="min-w-0 flex-1 basis-0 max-w-[132px]">
                  <PitchTile
                    slot={slot}
                    mode={mode}
                    weeks={weeks}
                    lo={lo}
                    hi={hi}
                    selected={selected === slot.player.id}
                    onSelect={onSelect}
                    fixtureFor={fixtureFor}
                    currentGw={currentGw}
                  />
                </li>
              ))}
            </ul>
          ),
        )}
      </div>

      {bench.length > 0 && (
        <div className="relative border-t border-hairline bg-sunk/70 px-2 py-3 sm:px-4">
          <p className="mb-2 upper-label text-2xs text-ink-lo">Bench</p>
          <ul aria-label="Bench" className="flex items-stretch justify-center gap-1.5 sm:gap-2">
            {bench.map((slot) => (
              <li key={slot.player.id} className="min-w-0 flex-1 basis-0 max-w-[132px]">
                <PitchTile
                  slot={slot}
                  mode={mode}
                  weeks={weeks}
                  lo={lo}
                  hi={hi}
                  selected={selected === slot.player.id}
                  onSelect={onSelect}
                  fixtureFor={fixtureFor}
                  currentGw={currentGw}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PitchMarkings() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]"
      style={{ color: "var(--ice)" }}
    >
      <g fill="none" stroke="currentColor" strokeWidth="0.45">
        <rect x="2" y="2" width="96" height="136" rx="1" />
        <line x1="2" y1="70" x2="98" y2="70" />
        <circle cx="50" cy="70" r="13" />
        <rect x="27" y="2" width="46" height="20" />
        <rect x="27" y="118" width="46" height="20" />
        <rect x="39" y="2" width="22" height="8" />
        <rect x="39" y="130" width="22" height="8" />
      </g>
    </svg>
  );
}

function PitchTile({
  slot,
  mode,
  weeks,
  lo,
  hi,
  selected,
  onSelect,
  fixtureFor,
  currentGw,
}: {
  slot: PitchSlot;
  mode: PitchMode;
  weeks: number;
  lo: number;
  hi: number;
  selected: boolean;
  onSelect: (id: number) => void;
  fixtureFor: (teamId: number, gw: number) => TickerCell[];
  currentGw: number;
}) {
  const [avatar] = useAvatarMode();
  const p = slot.player;
  const staged = slot.replacing != null;
  const projected = windowPoints(p.horizon, weeks);
  const outlook = priceOutlook(p);
  const next = fixtureFor(p.team, currentGw);
  const doubt = p.status !== "a";

  const heat = hi > lo ? (projected - lo) / (hi - lo) : 0.5;

  const figure =
    mode === "price" ? `${outlook.progress >= 0 ? "+" : "−"}${Math.round(Math.abs(outlook.progress) * 100)}%` : projected.toFixed(1);

  const caption =
    mode === "price"
      ? outlook.label
      : next.length === 0
        ? "no fixture"
        : next.map((f) => `${f.home ? f.opp : f.opp.toLowerCase()} (${f.home ? "H" : "A"})`).join(" · ");

  const figureTone =
    mode === "price"
      ? outlook.direction === "up"
        ? "text-surge"
        : outlook.direction === "down"
          ? "text-flare"
          : "text-ink-mid"
      : "text-ink-hi";

  return (
    <button
      type="button"
      onClick={() => onSelect(p.id)}
      aria-pressed={selected}
      aria-label={`${p.name}, ${POS_NAME[p.pos]}, £${(p.cost / 10).toFixed(1)}m${staged ? ", transfer staged" : ""}`}
      className={cn(
        "group relative flex w-full flex-col items-center rounded-md bg-raised/85 p-1.5 text-center backdrop-blur-[2px] transition-colors dur-instant",
        selected ? "bg-surface-3" : "card-ring hover:bg-surface-3",
      )}
      style={
        selected
          ? {
              boxShadow:
                "inset 0 0 0 1.5px var(--volt), 0 0 16px 1px color-mix(in oklab, var(--volt) 42%, transparent)",
            }
          : staged
            ? { boxShadow: "inset 0 0 0 1.5px var(--surge)" }
            : undefined
      }
    >
      {staged && (
        <span className="absolute -top-1 left-1 z-10 skewed rounded-[3px] bg-surge px-1 text-[9px] font-bold uppercase tracking-wide text-on-accent">
          <span>In</span>
        </span>
      )}
      {slot.isCaptain && (
        <span
          title="Captain"
          className="absolute -top-1 right-1 z-10 grid h-4 w-4 place-items-center rounded-full bg-volt text-[9px] font-bold text-on-accent"
        >
          C
        </span>
      )}
      {slot.isVice && !slot.isCaptain && (
        <span
          title="Vice-captain"
          className="absolute -top-1 right-1 z-10 grid h-4 w-4 place-items-center rounded-full bg-surface-3 text-[9px] font-bold text-ink-mid card-ring"
        >
          V
        </span>
      )}

      <span className="relative block h-10 w-10 overflow-hidden rounded-sm bg-surface-2">
        <PlayerAvatar photo={p.photo} teamId={p.team} mode={avatar} className="h-10 w-10 object-cover object-top" />
        {doubt && (
          <span
            title={p.news || "Doubtful"}
            className="absolute inset-x-0 bottom-0 block h-1"
            style={{ background: p.status === "d" ? "var(--amber)" : "var(--flare)" }}
          />
        )}
      </span>

      <span className="mt-1 flex w-full items-center justify-center gap-1">
        <ClubFlag teamId={p.team} className="h-3" />
        <span className="min-w-0 truncate text-2xs font-semibold text-ink-hi">{p.name}</span>
      </span>

      <span
        className={cn("fig-num mt-0.5 block text-base leading-none", figureTone)}
        style={
          mode === "price"
            ? undefined
            : { color: `color-mix(in oklab, var(--ink-hi) ${30 + Math.round(heat * 70)}%, var(--ink-lo))` }
        }
      >
        {figure}
      </span>

      <span className="mt-0.5 block w-full truncate text-[9px] leading-tight text-ink-lo num-tabular">
        {caption}
      </span>
      <span className="block text-[9px] leading-tight text-ink-lo num-tabular">
        {POS_LABEL[p.pos]} · £{(p.cost / 10).toFixed(1)}
      </span>

      {staged && slot.replacing && (
        <span className="mt-0.5 block w-full truncate text-[9px] leading-tight text-surge">
          for {slot.replacing.name}
        </span>
      )}
    </button>
  );
}
