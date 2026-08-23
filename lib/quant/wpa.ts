/**
 * v3 Feature 19 — WIN PROBABILITY ADDED, from PAIRED simulations.
 *
 * Independent sims lie: your Haaland and the rival's Haaland live in the same
 * fixture, so their draws must come from the same scoreline. We simulate both
 * XIs as one web (shared fixtures draw once) and compute:
 *
 *   P(win) = E[ 1{Y > R} + ½·1{Y = R} ]
 *   WPA_p  = P(win) − P(win | player p's points removed)
 *
 * Leave-one-out on the SAME draw matrix keeps every comparison paired. Your
 * players get positive WPA when they move the win probability; their players
 * get negative WPA — those are the threats. Pure; deterministic per seed.
 */
import { simulateWeb, type WebPlayer } from "@/lib/quant/correlationWeb";
import type { DcFit } from "@/lib/quant/strength";

export interface WpaSide {
  players: WebPlayer[];
  fixtures: { elementId: number; homeTeam: number; awayTeam: number; isHome: boolean }[];
  /** Captain (×2) and chip multipliers per element; default 1. */
  multipliers?: Map<number, number>;
}

export interface WpaMoment {
  elementId: number;
  side: "you" | "them";
  /** P(win) − P(win without this player). Yours > 0 help; theirs < 0 hurt. */
  wpa: number;
}

export interface WpaResult {
  winProb: number;
  drawProb: number;
  lossProb: number;
  moments: WpaMoment[];
  expectedPoints: { you: number; them: number };
  draws: number;
}

export function wpaPaired(
  you: WpaSide,
  them: WpaSide,
  fit: DcFit,
  opts: { M?: number; seed?: number; topN?: number } = {},
): WpaResult | null {
  if (you.players.length === 0 || them.players.length === 0) return null;
  const players = [...you.players, ...them.players];
  const fixtures = [...you.fixtures, ...them.fixtures];
  const web = simulateWeb(players, fixtures, fit, undefined, {
    M: opts.M ?? 2000,
    seed: opts.seed ?? 2026,
    keepDraws: true,
  });
  const matrix = web.drawsMatrix;
  if (!matrix) return null;
  const M = web.draws;
  const nYou = you.players.length;

  const multOf = (p: WebPlayer, side: WpaSide) => side.multipliers?.get(p.elementId) ?? 1;
  const youMult = you.players.map((p) => multOf(p, you));
  const themMult = them.players.map((p) => multOf(p, them));

  // per-draw totals
  const youTot = new Float64Array(M);
  const themTot = new Float64Array(M);
  for (let m = 0; m < M; m++) {
    let y = 0;
    for (let i = 0; i < nYou; i++) y += matrix[i * M + m] * youMult[i];
    youTot[m] = y;
    let t = 0;
    for (let j = 0; j < them.players.length; j++) t += matrix[(nYou + j) * M + m] * themMult[j];
    themTot[m] = t;
  }

  const winIndicator = (y: number, t: number) => (y > t ? 1 : y === t ? 0.5 : 0);
  let wins = 0;
  let draws = 0;
  for (let m = 0; m < M; m++) {
    const w = winIndicator(youTot[m], themTot[m]);
    wins += w;
    if (w === 0.5) draws++;
  }
  const winProb = wins / M;
  const drawProb = draws / M;

  // leave-one-out WPA on the same paired draws
  const moments: WpaMoment[] = [];
  for (let i = 0; i < players.length; i++) {
    const side: "you" | "them" = i < nYou ? "you" : "them";
    const mult = side === "you" ? youMult[i] : themMult[i - nYou];
    let looWins = 0;
    for (let m = 0; m < M; m++) {
      const y = side === "you" ? youTot[m] - matrix[i * M + m] * mult : youTot[m];
      const t = side === "them" ? themTot[m] - matrix[i * M + m] * mult : themTot[m];
      looWins += winIndicator(y, t);
    }
    const wpa = winProb - looWins / M;
    if (wpa !== 0) moments.push({ elementId: players[i].elementId, side, wpa: Number(wpa.toFixed(4)) });
  }
  moments.sort((a, b) => Math.abs(b.wpa) - Math.abs(a.wpa));

  const expYou = youTot.reduce((s, v) => s + v, 0) / M;
  const expThem = themTot.reduce((s, v) => s + v, 0) / M;

  return {
    winProb: Number(winProb.toFixed(4)),
    drawProb: Number(drawProb.toFixed(4)),
    lossProb: Number((1 - winProb - drawProb).toFixed(4)),
    moments: moments.slice(0, opts.topN ?? 6),
    expectedPoints: {
      you: Number(expYou.toFixed(2)),
      them: Number(expThem.toFixed(2)),
    },
    draws: M,
  };
}
