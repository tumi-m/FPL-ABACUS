export interface GwRecord {
  event: number;
  points: number;
  overallRank: number | null;
  benchCost: number;
  transfersCost: number;
  chip: string | null;
}

export interface TransferRow {
  event: number;
  elementIn: number;
  elementOut: number;
  hitShare: number;
  inPointsNext5: number | null;
  outPointsNext5: number | null;
  outPointsAfterSale: number | null;
  roseBeforeBuy: boolean | null;
}

export interface DnaInput {
  gwRecords: GwRecord[];
  transfers: TransferRow[];
  /** mean top-10k EO of the starting XI, per gameweek (null when unknown) */
  avgXioEByGw: (number | null)[];
  captainAlphaByGw: { event: number; alpha: number }[];
  chipAverages: Map<string, number>;
}

export interface ManagerDna {
  riskAppetite: { score: number; label: "Template" | "Balanced" | "Maverick" };
  captaincyAlpha: { points: number; bestGw: number; worstGw: number };
  transferPnl: { net: number; hitsPaid: number; recoveredFromHits: number; best: TransferRow[]; worst: TransferRow[] };
  sellRegret: { points: number; worst: TransferRow[] };
  timing: { beforeRise: number; afterRise: number; score: number };
  benchCost: { points: number; worstGw: number };
  chipEfficiency: { vsAverage: number };
  consistency: { sd: number; floor: number; ceiling: number };
}

const TRANSFER_ATTRIBUTION_WINDOW_GWS = 5;

export function computeTransferPnl(transfers: TransferRow[]): {
  net: number;
  hitsPaid: number;
  recoveredFromHits: number;
  best: TransferRow[];
  worst: TransferRow[];
} {
  let net = 0;
  let hitsPaid = 0;
  const scored = transfers
    .filter((t) => t.inPointsNext5 !== null && t.outPointsNext5 !== null)
    .map((t) => ({ row: t, pnl: (t.inPointsNext5 ?? 0) - (t.outPointsNext5 ?? 0) - t.hitShare }));
  for (const t of transfers) hitsPaid += t.hitShare;
  for (const s of scored) net += s.pnl;
  const sorted = [...scored].sort((a, b) => b.pnl - a.pnl);
  return {
    net,
    hitsPaid,
    recoveredFromHits: Math.max(0, net),
    best: sorted.slice(0, 3).map((s) => s.row),
    worst: sorted.slice(-3).reverse().map((s) => s.row),
  };
}

export function computeSellRegret(transfers: TransferRow[]): { points: number; worst: TransferRow[] } {
  const rows = transfers.filter((t) => t.outPointsAfterSale !== null);
  const sorted = [...rows].sort((a, b) => (b.outPointsAfterSale ?? 0) - (a.outPointsAfterSale ?? 0));
  return {
    points: rows.reduce((s, t) => s + (t.outPointsAfterSale ?? 0), 0),
    worst: sorted.slice(0, 3),
  };
}

export function computeDna(input: DnaInput): ManagerDna {
  const eoScores = input.avgXioEByGw.filter((v): v is number => v !== null);
  const avgEo = eoScores.length ? eoScores.reduce((a, b) => a + b, 0) / eoScores.length : 50;

  const alphas = input.captainAlphaByGw.map((c) => c.alpha);
  const alphaTotal = alphas.reduce((a, b) => a + b, 0);
  const bestGw = input.captainAlphaByGw.reduce((best, c) => (c.alpha > best.alpha ? c : best), { event: 0, alpha: 0 });
  const worstGw = input.captainAlphaByGw.reduce((worst, c) => (c.alpha < worst.alpha ? c : worst), { event: 0, alpha: 0 });

  const pnl = computeTransferPnl(input.transfers);
  const regret = computeSellRegret(input.transfers);

  const timedIn = input.transfers.filter((t) => t.roseBeforeBuy !== null);
  const beforeRise = timedIn.length ? timedIn.filter((t) => t.roseBeforeBuy === true).length / timedIn.length : 0;

  const benchCosts = input.gwRecords.filter((g) => g.chip !== "bboost");
  const totalBench = benchCosts.reduce((s, g) => s + g.benchCost, 0);
  const worstBench = benchCosts.reduce((worst, g) => (g.benchCost > worst.benchCost ? g : worst), benchCosts[0] ?? { event: 0, benchCost: 0, points: 0, overallRank: null, transfersCost: 0, chip: null });

  const pts = input.gwRecords.map((g) => g.points);
  const meanPts = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : 0;
  const sd = Math.sqrt(pts.reduce((s, p) => s + (p - meanPts) ** 2, 0) / Math.max(1, pts.length));
  const sortedPts = [...pts].sort((a, b) => a - b);
  const pct = (p: number) => sortedPts[Math.min(sortedPts.length - 1, Math.floor(p * sortedPts.length))] ?? 0;

  const chipEff = [...input.chipAverages.values()];

  return {
    riskAppetite: {
      score: Math.round(avgEo * 10) / 10,
      label: avgEo > 55 ? "Template" : avgEo < 40 ? "Maverick" : "Balanced",
    },
    captaincyAlpha: { points: Math.round(alphaTotal), bestGw: bestGw.event, worstGw: worstGw.event },
    transferPnl: { ...pnl, net: Math.round(pnl.net) },
    sellRegret: { points: Math.round(regret.points), worst: regret.worst },
    timing: { beforeRise, afterRise: 0, score: Math.round(beforeRise * 100) },
    benchCost: { points: totalBench, worstGw: worstBench.event },
    chipEfficiency: { vsAverage: chipEff.length ? chipEff.reduce((a, b) => a + b, 0) / chipEff.length : 0 },
    consistency: { sd: round(sd, 1), floor: pct(0.1), ceiling: pct(0.9) },
  };
}

export { TRANSFER_ATTRIBUTION_WINDOW_GWS };

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;
