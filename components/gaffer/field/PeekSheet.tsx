"use client";

import Link from "next/link";
import { Sheet, SheetContent, SheetTitle } from "@/components/primitives/Sheet";
import { CrestTile } from "@/components/gaffer/ClubCrest";
import { AnimatedNumber } from "@/components/gaffer/useAnimatedNumber";
import { Meter } from "@/components/charts/Meter";
import { Est } from "@/components/gaffer/Est";
import { X } from "@/components/primitives/icons";
import { clubOf } from "@/config/clubs";
import { POSITION_SHORT, formatSignedRank } from "@/lib/ui/format";
import { PlayerPhoto } from "@/components/gaffer/PlayerPhoto";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

type SwingRow = MatchdayModel["swings"][number];
type LevRow = MatchdayModel["leverage"]["yours"][number];

/**
 * Peek (v4 spec) — ONE shared sheet for token taps: the player mini-card.
 * Chrome gets the skew; every figure stays flat and engine-sourced.
 */
export function PeekSheet({
  element,
  model,
  swingByElement,
  leverageByElement,
  onOpenChange,
}: {
  element: number | null;
  model: MatchdayModel;
  swingByElement: Map<number, SwingRow>;
  leverageByElement: Map<number, LevRow>;
  onOpenChange: (open: boolean) => void;
}) {
  const row = element != null ? model.squad.find((s) => s.element === element) ?? null : null;
  const eoEstimated = model.leverage.eoSource === "estimated";
  const swing = row ? swingByElement.get(row.element) : undefined;
  const lev = row ? leverageByElement.get(row.element) : undefined;

  return (
    <Sheet open={row != null} onOpenChange={onOpenChange}>
      {row && (
        <SheetContent side="bottom" aria-label={`${row.webName} details`}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* player face with club crest badge — profile-style identity block */}
              <span className="relative inline-block shrink-0">
                <span className="block h-14 w-14 overflow-hidden rounded-md bg-surface-2 card-ring">
                  {row.photo ? (
                    <PlayerPhoto
                      photo={row.photo}
                      teamId={row.teamId}
                      className="h-14 w-14 object-cover object-top"
                    />
                  ) : (
                    <span className="grid h-14 w-14 place-items-center">
                      <CrestTile teamId={row.teamId} />
                    </span>
                  )}
                </span>
                <span className="absolute -bottom-1.5 -right-1.5 rounded-sm bg-raised p-[3px] shadow-[0_1px_4px_rgba(0,0,0,.5)]">
                  <CrestTile teamId={row.teamId} />
                </span>
              </span>
              <div>
                <SheetTitle className="leading-tight">{row.webName}</SheetTitle>
                <p className="mt-0.5 text-2xs uppercase-label text-ink-lo">
                  {POSITION_SHORT[row.pos]} · {clubOf(row.teamId).name}
                  {row.isCaptain && row.multiplier >= 2 ? " · captain" : ""}
                  {row.onBench ? " · bench" : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="relative grid h-11 w-11 place-items-center rounded-md text-ink-mid transition-colors dur-instant after:absolute after:inset-0 after:rounded-md after:content-[''] hover:bg-surface-3 hover:text-ink-hi"
            >
              <X width={16} height={16} />
            </button>
          </div>

          {/* the live figure — count-up + wash on change, reduced-motion safe */}
          <div className="mb-4 flex items-end justify-between rounded-md bg-sunk card-ring px-4 py-3">
            <div>
              <p className="upper-label text-2xs text-ink-lo">Live points</p>
              <p className="fig-num mt-0.5 text-3xl leading-none text-ink-hi">
                <AnimatedNumber value={row.livePoints} />
              </p>
            </div>
            <div className="text-right text-xs text-ink-mid num-tabular">
              <p>
                {row.opponentShort}
                {row.fixtureState !== "pre" ? ` · ${Math.min(row.fixtureMinute, 90)}′` : " · not started"}
              </p>
              <p className="mt-1">
                {row.fixtureState === "live" ? "In play" : row.fixtureState === "done" ? "Finished" : "Yet to play"}
                {row.subbedInFor !== null ? " · projected auto-sub" : ""}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Ownership</dt>
              <dd className="mt-0.5 num-tabular text-ink-hi">
                {eoEstimated ? (
                  <Est method="Estimated from sampled cohort">{`${Math.round(row.eo)}%`}</Est>
                ) : (
                  `${Math.round(row.eo)}%`
                )}
              </dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Minutes</dt>
              <dd className="mt-0.5 num-tabular text-ink-hi">{row.minutes}</dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">BPS</dt>
              <dd className="mt-0.5 num-tabular text-ink-hi">{row.bps}</dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Rank swing</dt>
              <dd className="mt-0.5 num-tabular text-ink-hi">
                {swing && swing.ranksGained !== 0 ? formatSignedRank(swing.ranksGained) : "—"}
              </dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Leverage</dt>
              <dd className="mt-0.5 num-tabular text-ink-hi">
                {lev ? `~${(lev.expected / 1000).toFixed(1)}k` : "—"}
              </dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Bonus</dt>
              <dd className="mt-0.5 num-tabular text-ink-hi">
                {row.provisionalBonus > 0 ? `${row.provisionalBonus} projected` : "—"}
              </dd>
            </div>
            {/* the live stat line — straight from the event feed */}
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Goals</dt>
              <dd className="mt-0.5 num-tabular text-ink-hi">{row.liveStats?.goalsScored ?? "—"}</dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Assists</dt>
              <dd className="mt-0.5 num-tabular text-ink-hi">{row.liveStats?.assists ?? "—"}</dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Yellows</dt>
              <dd className="mt-0.5 num-tabular text-ink-hi">
                {row.liveStats
                  ? row.liveStats.yellowCards + (row.liveStats.redCards > 0 ? ` · ${row.liveStats.redCards} red` : "")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Saves</dt>
              <dd className="mt-0.5 num-tabular text-ink-hi">{row.liveStats?.saves ?? "—"}</dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">xG · xA</dt>
              <dd className="mt-0.5 num-tabular text-ink-hi">
                {row.liveStats ? `${row.liveStats.xg.toFixed(2)} · ${row.liveStats.xa.toFixed(2)}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Clean sheet</dt>
              <dd className="mt-0.5 num-tabular text-ink-hi">
                {row.liveStats == null ? "—" : row.liveStats.cleanSheets > 0 ? "Yes" : "No"}
              </dd>
            </div>
          </dl>

          {row.defconThreshold < 99 && (
            <div className="mt-4">
              <p className="upper-label mb-1 text-2xs text-ink-lo">
                DEFCON {row.defconCount}/{row.defconThreshold}
              </p>
              <Meter value={row.defconCount / row.defconThreshold} hint={`${row.defconCount}/${row.defconThreshold}`} />
            </div>
          )}

          <div className="mt-5 flex justify-center">
            <Link
              href={`/players/${row.element}`}
              className="skewed inline-flex h-11 items-center rounded-md bg-volt px-5 text-xs uppercase-label text-on-accent btn-glow transition-transform dur-instant active:scale-[0.97]"
            >
              <span>Player page</span>
            </Link>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
