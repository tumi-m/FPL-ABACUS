/**
 * v3 Feature 10 — THE TWIN STUDY. The experiment 13M managers already ran:
 * at deadline we find near-twins (≥13/15 squad overlap, ±£0.5m bank, within
 * one FT of freedom) and partition by the decision each made. Outcomes are
 * observational — we label them as such and show the arms' pre-GW standing.
 * The engine is pure: all inputs from the cohort-entry snapshot + entry history.
 */
export interface TwinEntry {
  entry: number;
  elements: number[];
  /** [owned(15), started, captains] */
  counts: [number, number, number];
  squadCostTenths: number;
  bankTenths: number;
  /** Free transfers available that GW — pairing band ±1. */
  ft: number | null;
  rankAt: number | null; // overall rank at snapshot time
}

export interface TwinOutcome {
  entry: number;
  gwPoints: number;
  captainPoints: number;
  /** Arm the entry actually played (null → hold). */
  arm: "transfer" | "hit" | "chip" | "captain" | "hold";
}

export type TwinArmId = TwinOutcome["arm"];

export interface TwinArm {
  arm: TwinArmId;
  n: number;
  preRankAvg: number | null;
  mean: number;
  median: number;
  sd: number;
  rankDeltaAvg: number | null;
}

export interface TwinResult {
  n: number;
  /** You sit inside this cohort if n ≥ 100. */
  reliable: boolean;
  cohortSize: number;
  arms: TwinArm[];
  /** Observational label required by v3 honesty rules. */
  note: "observational";
}

const MIN_OVERLAP = 13;
const BANK_BAND_TENTHS = 50; // ±£0.5m
const FT_BAND = 1;

/** One side of the pairing question: near-identical to you at deadline. */
export function matchesTwin(
  myElements: Set<number>,
  myBankTenths: number,
  myFt: number,
  twin: TwinEntry,
): boolean {
  let overlap = 0;
  for (const e of twin.elements) if (myElements.has(e)) overlap++;
  if (overlap < MIN_OVERLAP) return false;
  if (Math.abs(twin.bankTenths - myBankTenths) > BANK_BAND_TENTHS) return false;
  if (twin.ft != null && Math.abs(twin.ft - myFt) > FT_BAND) return false;
  return true;
}

/** Deterministic summary for one arm — mean/median/sd over outcomes. */
export function summariseArm(outcomes: TwinOutcome[], arms: Map<number, number | null>): TwinArm | null {
  if (outcomes.length === 0) return null;
  const pts = outcomes.map((o) => o.gwPoints);
  const sorted = [...pts].sort((a, b) => a - b);
  const mean = pts.reduce((s, v) => s + v, 0) / pts.length;
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  let variance = 0;
  for (const v of pts) variance += (v - mean) * (v - mean);
  const sd = Math.sqrt(variance / pts.length);
  const rks = outcomes.map((o) => arms.get(o.entry)).filter((r): r is number => r != null);
  const rankDeltaAvg = rks.length ? rks.reduce((s, v) => s + v, 0) / rks.length : null;
  return {
    arm: outcomes[0].arm,
    n: outcomes.length,
    preRankAvg: rks.length ? Math.round(rks.reduce((s, v) => s + v, 0) / rks.length) : null,
    mean: Number(mean.toFixed(2)),
    median: median,
    sd: Number(sd.toFixed(2)),
    rankDeltaAvg: rankDeltaAvg == null ? null : Number(rankDeltaAvg.toFixed(0)),
  };
}

export function twinStudy(
  myElements: number[],
  myBankTenths: number,
  myFt: number,
  all: TwinEntry[],
  outcomesByEntry: Map<number, TwinOutcome>,
  rankAtByEntry: Map<number, number | null>,
): TwinResult {
  const cohort = all.filter((t) => matchesTwin(new Set(myElements), myBankTenths, myFt, t));
  const byArm = new Map<TwinArmId, TwinOutcome[]>();
  for (const t of cohort) {
    const out = outcomesByEntry.get(t.entry);
    if (!out) continue;
    const list = byArm.get(out.arm) ?? [];
    list.push(out);
    byArm.set(out.arm, list);
  }
  const arms = ([...byArm.values()].map((arm) => summariseArm(arm, rankAtByEntry)) as TwinArm[])
    .filter(Boolean)
    .sort((a, b) => b.n - a.n)
    .map((a) => ({ ...a, preRankAvg: a.preRankAvg, rankDeltaAvg: a.rankDeltaAvg }));

  return {
    n: cohort.length,
    reliable: cohort.length >= 100,
    cohortSize: cohort.length,
    arms,
    note: "observational",
  };
}
