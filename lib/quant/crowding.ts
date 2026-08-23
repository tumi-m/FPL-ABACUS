/**
 * v3 Feature 18 — CROWDING: where alpha lives.
 *
 * Per position, the field's effective-ownership shares s_p = EO/ΣEO give:
 *   HHI = Σ s_p²               (Herfindahl–Hirschman concentration)
 *   effective picks = 1/HHI    (how many "real" choices the field is making)
 *   entropy = −Σ s_p ln s_p    (bits of genuine disagreement)
 * Collapse ⇒ convergence ⇒ differential value is maximal; expansion ⇒ the
 * template is cheap. Pure function; deterministic.
 */
export type CrowdingPos = 1 | 2 | 3 | 4;

export interface CrowdingPlayer {
  elementId: number;
  pos: CrowdingPos;
  /** Effective ownership in percent (0..100). */
  eo: number;
}

export interface CrowdingPosition {
  pos: CrowdingPos;
  players: number;
  /** HHI ∈ (0, 1] — 1 is a monopoly pick. */
  hhi: number;
  /** 1/HHI ∈ [1, players]. */
  effectivePicks: number;
  /** −Σ s ln s ∈ [0, ln n]. */
  entropy: number;
  maxEntropy: number;
  /** entropy / ln n ∈ [0, 1] — 1 is a perfectly split market. */
  evenness: number;
  /** The most-owned player and its share, for the endpoint callout. */
  top: { elementId: number; share: number } | null;
}

export interface CrowdingResult {
  positions: CrowdingPosition[];
  overall: Omit<CrowdingPosition, "pos" | "top"> & { top: { elementId: number; share: number } | null };
}

function summarise(entries: { elementId: number; eo: number }[]): Omit<CrowdingPosition, "pos" | "top"> & { top: { elementId: number; share: number } | null } {
  const n = entries.length;
  const total = entries.reduce((s, e) => s + e.eo, 0);
  if (n === 0 || total <= 0) {
    return {
      players: n, hhi: 0, effectivePicks: 0, entropy: 0,
      maxEntropy: n > 1 ? Math.log(n) : 0, evenness: 0, top: null,
    };
  }
  const shares = entries.map((e) => e.eo / total);
  const hhi = shares.reduce((s, x) => s + x * x, 0);
  const entropy = -shares.reduce((s, x) => s + (x > 0 ? x * Math.log(x) : 0), 0);
  const maxEntropy = n > 1 ? Math.log(n) : 0;
  let topIdx = 0;
  shares.forEach((x, i) => {
    if (x > shares[topIdx]) topIdx = i;
  });
  return {
    players: n,
    hhi: Number(hhi.toFixed(4)),
    effectivePicks: hhi > 0 ? Number((1 / hhi).toFixed(2)) : 0,
    entropy: Number(entropy.toFixed(4)),
    maxEntropy: Number(maxEntropy.toFixed(4)),
    evenness: maxEntropy > 0 ? Number((entropy / maxEntropy).toFixed(4)) : 0,
    top: { elementId: entries[topIdx].elementId, share: Number(shares[topIdx].toFixed(4)) },
  };
}

export function crowding(players: CrowdingPlayer[]): CrowdingResult {
  const byPos = new Map<CrowdingPos, { elementId: number; eo: number }[]>();
  for (const p of players) {
    if (p.eo <= 0) continue; // unowned players contribute nothing to crowding
    const list = byPos.get(p.pos) ?? [];
    list.push({ elementId: p.elementId, eo: p.eo });
    byPos.set(p.pos, list);
  }
  const positions: CrowdingPosition[] = ([1, 2, 3, 4] as CrowdingPos[])
    .filter((pos) => (byPos.get(pos)?.length ?? 0) > 0)
    .map((pos) => ({ pos, ...summarise(byPos.get(pos)!) }));
  return { positions, overall: summarise(players.filter((p) => p.eo > 0)) };
}
