"use client";

import { Badge } from "@/components/primitives/Badge";
import { Est } from "@/components/gaffer/Est";
import { AnimatedNumber } from "@/components/gaffer/useAnimatedNumber";
import { COPY } from "@/lib/copy/deck";
import type { MomentSpec } from "@/lib/engines/weekPhase";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";
import { formatCompactRank, formatSignedRank } from "@/lib/ui/format";
import { ArrowDown, ArrowUp } from "@/components/primitives/icons";

const CHIP_LABEL: Record<string, string> = {
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
  freehit: "Free Hit",
  wildcard: "Wildcard",
};

export function HeroScore({ model, moment }: { model: MatchdayModel; moment?: MomentSpec | null }) {
  const hero = model.hero;
  const officialRank = hero.officialLiveRank;
  const deltaText = formatSignedRank(hero.rankDeltaSinceLastPoll);
  const rankIsExact = officialRank !== null;

  return (
    <section aria-label="Live score" className="rounded-lg bg-surface-1 card-ring p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="upper-label text-2xs text-ink-lo">
            GW{model.event.id} · live points
          </div>
          <AnimatedNumber
            value={hero.gwPoints}
            className="fig-num block text-[clamp(40px,5.5vw,58px)] leading-none tracking-hero text-ink-hi"
          />
        </div>
        <div className="text-right">
          <div className="upper-label text-2xs text-ink-lo">Overall rank</div>
          <div className="fig-num text-3xl leading-tight tracking-hero text-ink-hi num-tabular">
            {rankIsExact ? (
              formatCompactRank(officialRank)
            ) : hero.estimatedLiveRank !== null ? (
              <Est method={`Estimated from ${model.rankContext.sampleSize.toLocaleString()} sampled managers`}>
                {formatCompactRank(hero.estimatedLiveRank)}
              </Est>
            ) : (
              "—"
            )}
          </div>
          {deltaText && (
            <div
              className={`mt-1 inline-flex items-center gap-1 text-sm font-medium num-tabular ${
                (hero.rankDeltaSinceLastPoll ?? 0) > 0 ? "text-good" : "text-critical"
              }`}
            >
              {(hero.rankDeltaSinceLastPoll ?? 0) > 0 ? <ArrowUp width={13} height={13} /> : <ArrowDown width={13} height={13} />}
              {deltaText}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-2 num-tabular">
        <span>
          Played <strong className="font-medium text-ink-1">{hero.playersPlayed}</strong>/11
        </span>
        <span aria-hidden className="h-3.5 w-px bg-hairline" />
        <span>
          To play <strong className="font-medium text-ink-1">{hero.playersToPlay}</strong>
        </span>
        <span aria-hidden className="h-3.5 w-px bg-hairline" />
        <span>
          Captain <strong className="font-medium text-ink-1">{hero.captainPoints}</strong>
        </span>
        <span aria-hidden className="h-3.5 w-px bg-hairline" />
        <span>
          Bench <strong className="font-medium text-ink-1">{hero.benchPoints}</strong>
        </span>
      </div>

      {(hero.chip || hero.transfersCost > 0) && (
        <div className="mt-3 flex items-center gap-2">
          {hero.chip && <Badge variant="brand">{CHIP_LABEL[hero.chip] ?? hero.chip}</Badge>}
          {hero.transfersCost > 0 && <Badge variant="warning">−{Math.round(hero.transfersCost / 4)} hit{hero.transfersCost > 4 ? "s" : ""}</Badge>}
        </div>
      )}

      {moment && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
          <span className="upper-label text-2xs font-semibold text-ink-lo">{moment.label}</span>
          <span aria-hidden>·</span>
          <span>{moment.headline}</span>
          {moment.focus !== "/live" && (
            <a href={moment.focus} className="text-volt transition-colors dur-instant hover:underline">
              {moment.focus === "/board" ? "Open the Board →" : "Where the points went →"}
            </a>
          )}
        </p>
      )}

      {model.upstreamDegraded && (
        <p role="status" className="mt-4 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
          {COPY.upstreamDown.title}. {COPY.upstreamDown.inline}
        </p>
      )}
    </section>
  );
}
