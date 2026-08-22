import { rankForTotal } from "@/lib/engines/rankModel";
import type { RankCurve } from "@/lib/engines/rankModel";
import type { Chip, Multiplier } from "@/lib/engines/types";

export type Branch =
  | { kind: "captain"; alt: number }
  | { kind: "bench"; out: number; in: number }
  | { kind: "transfer"; reverse: { in: number; out: number }[]; hitRefund: number }
  | { kind: "chip"; without: Exclude<Chip, null> }
  | { kind: "roll" };

export interface MultiverseCtx {
  curve: RankCurve;
  preTotal: number;
  fieldAvg: number;
  /** livePoints + pos for any player that could appear in a branch */
  altPoints: Map<number, { points: number; pos: number }>;
}

export interface BranchResult {
  branch: Branch;
  label: string;
  pointsDelta: number;
  /** POSITIVE = the alternative was better (regret); negative = relief */
  ranksDelta: number;
}

const MAX_BRANCHES = 40;

interface SquadState {
  xi: { element: number; pos: number; mult: Multiplier }[];
  transfersCost: number;
}

function squadPoints(s: SquadState, pointsOf: (el: number) => number): number {
  return s.xi.reduce((sum, p) => sum + pointsOf(p.element) * p.mult, 0) - s.transfersCost;
}

export function describeBranch(b: Branch, names: Map<number, string>): string {
  const name = (el: number) => names.get(el) ?? `#${el}`;
  switch (b.kind) {
    case "captain":
      return `Captaining ${name(b.alt)} instead`;
    case "bench":
      return `Benching ${name(b.out)} before ${name(b.in)}`;
    case "transfer": {
      if (b.reverse.length === 1) {
        const r = b.reverse[0];
        return `Keeping ${name(r.out)} over ${name(r.in)}`;
      }
      return `Reversing ${b.reverse.length} transfers`;
    }
    case "chip":
      switch (b.without) {
        case "3xc":
          return "Playing Triple Captain";
        case "bboost":
          return "Playing Bench Boost";
        case "freehit":
          return "Playing Free Hit";
        default:
          return "Playing Wildcard";
      }
    case "roll":
      return "Rolling the transfer instead";
  }
}

/**
 * Evaluates counterfactuals against a rank curve. Pure: state in, results out.
 * Inapplicable branches are skipped, never thrown. Sorted by |ranksDelta| desc.
 */
export function runMultiverse(
  base: {
    finalXI: { element: number; pos: number; multiplier: Multiplier }[];
    captainId: number;
    chip: Chip;
    benchElementIds?: number[];
    livePointsByElement: Map<number, number>;
    transfersCost: number;
  },
  ctx: MultiverseCtx,
  branches: Branch[],
): BranchResult[] {
  const pointsOf = (el: number): number =>
    base.livePointsByElement.get(el) ?? ctx.altPoints.get(el)?.points ?? 0;

  const baseState: SquadState = {
    xi: base.finalXI.map((p) => ({ element: p.element, pos: p.pos, mult: p.multiplier })),
    transfersCost: base.transfersCost,
  };
  const basePoints = squadPoints(baseState, pointsOf);
  const yourRank = rankForTotal(ctx.curve, ctx.preTotal + basePoints - ctx.fieldAvg);

  const tcActive = base.chip === "3xc";
  const bbActive = base.chip === "bboost";

  const evaluate = (b: Branch): BranchResult | null => {
    let xi = baseState.xi.map((p) => ({ ...p }));
    let cost = baseState.transfersCost;

    switch (b.kind) {
      case "captain": {
        if (!xi.some((p) => p.element === b.alt) || b.alt === base.captainId) return null;
        const capMult: Multiplier = tcActive ? 3 : 2;
        xi = xi.map((p) => ({
          ...p,
          mult: p.element === b.alt ? capMult : p.element === base.captainId ? 1 : p.mult,
        }));
        break;
      }
      case "bench": {
        if (bbActive) return null;
        const idx = xi.findIndex((p) => p.element === b.out);
        const altIn = ctx.altPoints.get(b.in);
        if (idx === -1 || !altIn) return null;
        xi[idx] = { element: b.in, pos: altIn.pos, mult: xi[idx].mult };
        break;
      }
      case "transfer": {
        let applied = false;
        for (const r of b.reverse) {
          const idx = xi.findIndex((p) => p.element === r.in);
          const altOut = ctx.altPoints.get(r.out);
          if (idx === -1 || !altOut) continue;
          xi[idx] = { element: r.out, pos: altOut.pos, mult: xi[idx].mult };
          applied = true;
        }
        if (!applied) return null;
        cost = Math.max(0, cost - b.hitRefund);
        break;
      }
      case "chip": {
        if (base.chip !== b.without) return null;
        if (b.without === "3xc") {
          xi = xi.map((p) => (p.mult === 3 ? { ...p, mult: 2 as Multiplier } : p));
        } else if (b.without === "bboost") {
          const benchSet = new Set(base.benchElementIds ?? []);
          if (benchSet.size === 0) return null;
          xi = xi.filter((p) => !benchSet.has(p.element));
        } else {
          return null; // freehit/wildcard restructure the entire squad — not counterfactable here
        }
        break;
      }
      case "roll": {
        if (baseState.transfersCost <= 0 && !bbActive) {
          // no hit was taken; rolling changes nothing
          if (!bbActive) return null;
        }
        cost = 0;
        break;
      }
    }

    const altPoints = squadPoints({ xi, transfersCost: cost }, pointsOf);
    const altRank = rankForTotal(ctx.curve, ctx.preTotal + altPoints - ctx.fieldAvg);
    return {
      branch: b,
      label: "",
      pointsDelta: altPoints - basePoints,
      ranksDelta: yourRank - altRank,
    };
  };

  return branches
    .slice(0, MAX_BRANCHES)
    .map(evaluate)
    .filter((r): r is BranchResult => r !== null)
    .map((r) => ({ ...r, label: describeBranch(r.branch, new Map()) }))
    .sort((a, b) => Math.abs(b.ranksDelta) - Math.abs(a.ranksDelta));
}

export interface RegretRelief {
  regretIndex: number;
  reliefIndex: number;
  topRegret: BranchResult | null;
  topRelief: BranchResult | null;
}

export function regretRelief(results: BranchResult[]): RegretRelief {
  const positive = [...results].filter((r) => r.ranksDelta > 0).sort((a, b) => b.ranksDelta - a.ranksDelta);
  const negative = [...results].filter((r) => r.ranksDelta < 0).sort((a, b) => a.ranksDelta - b.ranksDelta);
  const topRegret = positive[0] ?? null;
  const topRelief = negative[0] ?? null;
  return {
    regretIndex: topRegret?.ranksDelta ?? 0,
    reliefIndex: topRelief ? -topRelief.ranksDelta : 0,
    topRegret,
    topRelief,
  };
}
