"use client";

import * as React from "react";
import Link from "next/link";
import { CrestBadge } from "@/components/gaffer/CrestBadge";
import { PlayerAvatar, useAvatarMode } from "@/components/gaffer/PlayerAvatar";
import { Est } from "@/components/gaffer/Est";
import { cn } from "@/lib/ui/cn";
import { formatPrice, POSITION_SHORT } from "@/lib/ui/format";
import { spendLabel, type Suggestion } from "@/lib/engines/suggest";

/**
 * What to actually do, at the bottom of the Board.
 *
 * The ticker tells you whose fixtures turn; this closes the loop with the
 * moves that follow from it. Every row is a legal one-for-one swap — position,
 * budget and the three-per-club cap already checked — priced over the same
 * horizon the grid above is coloured by, so the two cannot disagree.
 *
 * Nothing here stages anything. The Planner is the only desk that moves a
 * player, so each row hands off to it with the swap pre-loaded.
 */

export interface SuggestionRow extends Suggestion {
  out: { name: string; pos: number; teamId: number; photo: string; cost: number };
  in: { name: string; pos: number; teamId: number; photo: string; cost: number };
}

export function RecommendedTransfers({
  rows,
  weeks,
  freeTransfers,
  bankTenths,
  squadUnavailable,
}: {
  rows: SuggestionRow[];
  weeks: number;
  freeTransfers: number;
  bankTenths: number;
  squadUnavailable: boolean;
}) {
  const [avatar] = useAvatarMode();

  return (
    <section aria-label="Recommended transfers" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="upper-label text-2xs text-ink-lo">Worth doing next</h2>
        <p className="text-2xs text-ink-lo num-tabular">
          {freeTransfers} free · {formatPrice(bankTenths)} banked
        </p>
      </div>

      {squadUnavailable ? (
        <p className="rounded-lg bg-surface-1 card-ring p-6 text-center text-sm text-ink-lo">
          Your picks are not visible yet, so there is nothing to swap out of.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg bg-surface-1 card-ring p-6 text-center text-sm text-ink-lo">
          Nothing in the market beats what you already own over the next {weeks} gameweeks. Hold
          the transfer.
        </p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={`${r.outId}-${r.inId}`}>
              <Link
                href={`/planner?out=${r.outId}&in=${r.inId}`}
                className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-1 card-ring p-3 transition-colors dur-instant hover:bg-surface-3"
              >
                <Side player={r.out} avatar={avatar} points={r.outPoints} tone="out" />
                <span aria-hidden className="fig-num text-lg text-ink-lo">→</span>
                <Side player={r.in} avatar={avatar} points={r.inPoints} tone="in" />

                <span className="ml-auto flex items-center gap-3 text-right">
                  <span>
                    <span className="block fig-num text-lg leading-none text-surge">
                      <Est method={`Projected points over the next ${weeks} gameweeks, from form, minutes and the fixture model`}>
                        {`+${r.gain.toFixed(1)}`}
                      </Est>
                    </span>
                    <span className="block text-2xs uppercase-label text-ink-lo">
                      over {weeks} GW
                    </span>
                  </span>
                  <span className="hidden text-2xs text-ink-lo sm:block">
                    {spendLabel(r.spend)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-2xs leading-relaxed text-ink-lo">
        One-for-one swaps you can legally make right now, ranked by projected points over the next
        {" "}{weeks} gameweeks. Tap one to stage it on the Planner — nothing here changes your real
        team.
      </p>
    </section>
  );
}

function Side({
  player,
  avatar,
  points,
  tone,
}: {
  player: SuggestionRow["out"];
  avatar: ReturnType<typeof useAvatarMode>[0];
  points: number;
  tone: "out" | "in";
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="relative inline-block h-9 w-9 shrink-0">
        <span
          className={cn(
            "block h-9 w-9 overflow-hidden rounded-md bg-surface-3",
            tone === "out" && "opacity-70 saturate-[0.4]",
          )}
        >
          <PlayerAvatar
            photo={player.photo}
            teamId={player.teamId}
            mode={avatar}
            className="h-9 w-9 object-cover object-top"
          />
        </span>
        <CrestBadge
          teamId={player.teamId}
          size={13}
          className="absolute -bottom-0.5 -right-0.5 rounded-[2px] bg-surface-1"
        />
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate text-sm font-medium", tone === "out" ? "text-ink-mid" : "text-ink-hi")}>
          {player.name}
        </span>
        <span className="block text-2xs text-ink-lo num-tabular">
          {POSITION_SHORT[player.pos]} · {formatPrice(player.cost)} · {points.toFixed(1)} pts
        </span>
      </span>
    </span>
  );
}
