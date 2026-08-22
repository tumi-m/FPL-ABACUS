import type { Chip, LivePlayer, Multiplier, Pick, Pos } from "@/lib/engines/types";

export interface SubResult {
  subs: { out: number; in: number }[];
  finalXI: Pick[];
  captainId: number;
}

function posOf(players: Map<number, LivePlayer>, element: number): Pos {
  const p = players.get(element);
  if (!p) throw new Error(`no live data for element ${element}`);
  return p.pos;
}

function isValidFormation(xi: Pick[], players: Map<number, LivePlayer>, min: Record<Pos, number>): boolean {
  if (xi.length !== 11) return false;
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<Pos, number>;
  for (const p of xi) counts[posOf(players, p.element)]++;
  return (
    counts[1] === 1 &&
    counts[2] >= min[2] &&
    counts[3] >= min[3] &&
    counts[4] >= min[4]
  );
}

export function projectAutoSubs(
  picks: Pick[],
  players: Map<number, LivePlayer>,
  minPlay: Record<Pos, number>,
  chip: Chip,
): SubResult {
  const captain = picks.find((p) => p.isCaptain) ?? picks[0];
  let captainId = captain.element;

  if (chip === "bboost") {
    return { subs: [], finalXI: [...picks].sort((a, b) => a.position - b.position).slice(0, 15), captainId };
  }
  if (chip === "freehit" || chip === "wildcard") {
    return { subs: [], finalXI: picks.filter((p) => p.position <= 11), captainId };
  }

  const blank = (p: Pick): boolean => {
    const lp = players.get(p.element);
    if (!lp) return false;
    return lp.minutes === 0 && lp.fixturesFinished && lp.fixtureIds.length > 0;
  };

  const starters = picks.filter((p) => p.position <= 11);
  const bench = picks
    .filter((p) => p.position >= 12)
    .sort((a, b) => a.position - b.position);

  const xi = [...starters];
  const subs: { out: number; in: number }[] = [];
  const used = new Set<number>();

  for (const out of starters.filter(blank)) {
    const outPos = posOf(players, out.element);
    const candidates = bench.filter((b) => {
      if (used.has(b.element)) return false;
      const bp = players.get(b.element);
      if (!bp || bp.minutes === 0) return false;
      return true;
    });

    let chosen: Pick | undefined;
    for (const cand of candidates) {
      const inPos = posOf(players, cand.element);
      const gkCase = outPos === 1 || inPos === 1;
      if (gkCase) {
        if (outPos === 1 && inPos === 1) {
          chosen = cand;
          break;
        }
        continue;
      }
      const next = xi.map((p) => (p.element === out.element ? cand : p));
      if (isValidFormation(next, players, minPlay)) {
        chosen = cand;
        break;
      }
    }

    if (!chosen) continue;
    used.add(chosen.element);
    subs.push({ out: out.element, in: chosen.element });
    const idx = xi.findIndex((p) => p.element === out.element);
    xi[idx] = { ...chosen, position: xi[idx].position };
  }

  const capLive = players.get(captainId);
  if (capLive && capLive.minutes === 0 && capLive.fixturesFinished) {
    const vice = picks.find((p) => p.isViceCaptain);
    if (vice) captainId = vice.element;
  }

  return { subs, finalXI: xi, captainId };
}

/** Effective multiplier per element after subs + armband resolution. */
export function effectiveMultipliers(picks: Pick[], subsResult: SubResult, chip: Chip): Map<number, Multiplier> {
  const mults = new Map<number, Multiplier>();
  const bb = chip === "bboost";
  for (const p of picks) {
    let m: Multiplier = p.multiplier;
    if (!bb && p.position >= 12) m = 0;
    mults.set(p.element, m);
  }
  if (!bb) {
    for (const sub of subsResult.subs) {
      const outMult = picks.find((p) => p.element === sub.out)?.multiplier ?? 1;
      mults.set(sub.out, 0);
      mults.set(sub.in, outMult);
    }
  }

  const tcActive = chip === "3xc";
  const originalCaptain = picks.find((p) => p.isCaptain);
  const armbandMoved = !originalCaptain || originalCaptain.element !== subsResult.captainId;
  // A promoted vice never inherits Triple Captain — the chip dies with the blanked captain.
  const captainMultiplier: Multiplier = tcActive && !armbandMoved ? 3 : 2;
  mults.set(subsResult.captainId, captainMultiplier);
  return mults;
}
