import { per90, type PerfPlayer } from "./performance";

export type InsightKey = "value" | "bonus" | "workload" | "keepers" | "ownership";

export const FIELD_INSIGHTS = [
  {
    key: "value", label: "Attacking value", title: "How much attacking involvement does your money buy?",
    xLabel: "Current price (£m)", yLabel: "Expected goal involvement / 90",
    xShort: "Price", yShort: "xGI / 90", xEstimated: false, yEstimated: true,
    read: "Higher and further left means more expected attacking involvement at a lower price. Compare within a position: FPL rewards their goals differently.",
    method: "FPL expected goals plus expected assists, divided by season minutes and multiplied by 90. Current price in millions. This is an observed underlying rate, not a future points forecast.",
  },
  {
    key: "bonus", label: "Bonus conversion", title: "Who turns BPS into actual bonus points?",
    xLabel: "Bonus Point System score / 90", yLabel: "Awarded bonus points / 90",
    xShort: "BPS / 90", yShort: "Bonus / 90", xEstimated: false, yEstimated: false,
    read: "Look for players high on the chart at similar BPS rates. Bonus is awarded match by match against other players; a season rate cannot promise the next award.",
    method: "Published season BPS and awarded bonus totals, each divided by season minutes and multiplied by 90. BPS and FPL bonus points are different quantities.",
  },
  {
    key: "workload", label: "Defensive work", title: "Who does the work when their team loses the ball?",
    xLabel: "Clearances + blocks + interceptions / 90", yLabel: "Ball recoveries / 90",
    xShort: "CBI / 90", yShort: "Recoveries / 90", xEstimated: false, yEstimated: false,
    read: "Right means more clearances, blocks and interceptions; up means more recoveries. These describe different defensive roles, not a complete DEFCON score or a guarantee of points.",
    method: "Published season clearances, blocks and interceptions (CBI) and ball recoveries, each divided by minutes and multiplied by 90. Outfield players only. Tackles and match-level scoring thresholds are not represented.",
  },
  {
    key: "keepers", label: "Keeper trade-offs", title: "Busy gloves, or a quieter route to a clean sheet?",
    xLabel: "Expected goals conceded / 90", yLabel: "Saves / 90",
    xShort: "xGC / 90", yShort: "Saves / 90", xEstimated: true, yEstimated: false,
    read: "Higher means more save activity; further right means higher-quality chances conceded. A busy keeper and a well-protected keeper earn points in different ways.",
    method: "FPL expected goals conceded and recorded saves during each goalkeeper’s season minutes, scaled to 90 minutes. Expected goals conceded is not post-shot xG; this chart cannot measure shot-stopping skill or clean-sheet probability.",
  },
  {
    key: "ownership", label: "Unshared returns", title: "Who has delivered without being widely owned?",
    xLabel: "Selected by FPL managers (%)", yLabel: "Season FPL points / 90",
    xShort: "Selected", yShort: "Points / 90", xEstimated: false, yEstimated: false,
    read: "Upper-left players have delivered more points per 90 at lower current ownership. Check their minutes and role before calling them a differential worth buying.",
    method: "Current global selected-by percentage against published season FPL points divided by minutes and multiplied by 90. Ownership is not effective ownership and does not include captaincy. Historical returns do not predict the next gameweek.",
  },
] as const;

export interface InsightPoint {
  player: PerfPlayer;
  x: number;
  y: number;
  smallSample: boolean;
}

/** Axis coordinates use unrounded source totals, the shared per-90 formula,
 * and the same sample on both axes. Never coerce a missing value to zero.
 */
export function fieldInsightPoints(players: PerfPlayer[], key: InsightKey, minMinutes = 90, pos = 0): InsightPoint[] {
  const minimum = Number.isFinite(minMinutes) ? Math.max(1, minMinutes) : 90;
  return players.flatMap((player) => {
    if (!Number.isFinite(player.minutes) || player.minutes < minimum || (pos && player.pos !== pos)) return [];
    if (key === "keepers" && player.pos !== 1) return [];
    if ((key === "value" || key === "workload") && player.pos === 1) return [];
    let rawX: number;
    let rawY: number;
    switch (key) {
      case "value":
        if (!Number.isFinite(player.xg) || !Number.isFinite(player.xa)) return [];
        rawX = player.cost; rawY = player.xg + player.xa; break;
      case "bonus": rawX = player.bps; rawY = player.bonus; break;
      case "workload": rawX = player.cbi; rawY = player.recoveries; break;
      case "keepers": rawX = player.xgc; rawY = player.saves; break;
      case "ownership": rawX = player.owned; rawY = player.points; break;
    }
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return [];
    if (key === "value" && (rawX <= 0 || rawY < 0)) return [];
    if (key === "ownership" && (rawX < 0 || rawX > 100)) return [];
    if ((key === "workload" || key === "keepers") && (rawX < 0 || rawY < 0)) return [];
    const x = key === "value" ? rawX / 10 : key === "ownership" ? rawX : per90(rawX, player.minutes);
    const y = per90(rawY, player.minutes);
    return [{ player, x, y, smallSample: player.minutes < 450 }];
  });
}
