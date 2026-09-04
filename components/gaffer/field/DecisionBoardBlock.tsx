"use client";

import {
  Crossover,
  DecisionLedger,
  Delivery,
  ProcessVsOutcome,
  RankAtRisk,
  type WebFeed,
} from "@/components/gaffer/field/DecisionCharts";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

/** The simulation feed the RankAtRisk and Crossover charts read. */
export type DecisionWeb = WebFeed;

/**
 * The five decision charts as one dynamic block — same reasoning as
 * SquadSeasonBlock: one chunk, shared d3, no duplication.
 */
export function DecisionBoardBlock({
  model,
  web,
  expectedByElement,
  pointsBehind,
}: {
  model: MatchdayModel;
  web: DecisionWeb | null;
  expectedByElement: Record<number, number>;
  pointsBehind: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ProcessVsOutcome rows={model.squad} fieldAvg={model.rankContext.fieldAvg} gwPoints={model.hero.gwPoints} />
      <Delivery rows={model.squad} expectedByElement={expectedByElement} />
      {web ? (
        <>
          <RankAtRisk
            web={web}
            estimatedRank={model.hero.estimatedLiveRank ?? model.hero.officialLiveRank}
            ranksPerPoint={model.rankContext.ranksPerPoint}
          />
          <Crossover rows={model.squad} web={web} pointsBehind={pointsBehind} />
        </>
      ) : null}
      <DecisionLedger multiverse={model.multiverse} />
    </div>
  );
}