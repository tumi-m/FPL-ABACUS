"use client";

import { Availability, BonusLeaders, CaptainShare, PositionContribution, type RivalSeries } from "@/components/gaffer/field/FieldCharts";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

/**
 * The four squad-shape charts as one dynamic block, sharing one chunk of d3 —
 * same contract as SquadSeasonBlock and DecisionBoardBlock.
 */
export function SquadWeekBlock({
  rows,
  rival,
}: {
  rows: MatchdayModel["squad"];
  rival?: RivalSeries;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <PositionContribution rows={rows} rival={rival} />
      <Availability rows={rows} rival={rival} />
      <BonusLeaders rows={rows} rival={rival} />
      <CaptainShare rows={rows} rival={rival} />
    </div>
  );
}