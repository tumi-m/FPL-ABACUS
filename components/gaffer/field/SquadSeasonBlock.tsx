"use client";

import { ExpectedVsActual, MinutesSecurity, OverUnder, ValueForMoney } from "@/components/gaffer/field/SquadCharts";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

/**
 * The four season charts as one block, so the Field loads them with a single
 * dynamic() — V9-L measured per-chart splits duplicating shared chart code
 * across nine chunks, and reverted them. One chunk per block shares the d3
 * modules through the framework's own split-chunk pass.
 */
export function SquadSeasonBlock({ rows, currentGw }: { rows: MatchdayModel["squad"]; currentGw: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ExpectedVsActual rows={rows} />
      <OverUnder rows={rows} />
      <MinutesSecurity rows={rows} currentGw={currentGw} />
      <ValueForMoney rows={rows} />
    </div>
  );
}