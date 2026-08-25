import "server-only";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixturesAll, getPicks } from "@/lib/fpl/endpoints";
import { fitDixonColes, type DcMatch } from "@/lib/quant/strength";
import { marginalRisk, simulateWeb, type WebPlayer } from "@/lib/quant/correlationWeb";

/**
 * v4 Field modes 5+6 — the correlation web for one entry's XI, shared by the
 * /api/gaffer/web route and the genui effective-bets card. Deterministic per
 * the fixed seed; every figure here is an estimate and ships with <Est> in UI.
 */
export interface CorrelationWebPayload {
  players: { elementId: number; webName: string }[];
  /** Significant pairs only (|ρ| ≥ 0.15) to keep the pitch readable. */
  pairs: { a: number; b: number; rho: number }[];
  /** Simulated mean points per player. */
  meanPoints: Record<number, number>;
  /** Normalised marginal variance contribution per player (sums to 1). */
  riskShare: Record<number, number>;
  /** Per-player simulated points sd — the risk arm of the Nash captaincy read. */
  sdPoints: Record<number, number>;
  /** A sample of simulated XI totals (multiplier-weighted) for the rank band. */
  totals: number[];
  /** The XI's simulated points sd. */
  portfolioSd: number;
  effectiveBets: number;
  draws: number;
}

export interface WebContext {
  fit: ReturnType<typeof fitDixonColes>;
  players: WebPlayer[];
  fixtures: { elementId: number; homeTeam: number; awayTeam: number; isHome: boolean }[];
  /** FPL pick multipliers (captain 2×) for the XI. */
  multipliers: Map<number, number>;
  currentGw: number;
}

/**
 * The Dixon–Coles web context for one entry's XI — shared by the correlation
 * modes, the effective-bets card and the paired WPA engine.
 */
export async function buildWebContext(teamId: number, gw?: number): Promise<WebContext | null> {
  const boot = await getBootstrapLite();
  const currentGw = gw ?? boot.events.find((e) => e.is_current)?.id ?? boot.events.find((e) => e.is_next)?.id ?? 1;

  let picks: Awaited<ReturnType<typeof getPicks>>;
  try {
    picks = await getPicks(teamId, currentGw, true);
  } catch {
    return null;
  }
  const squadIds = picks.picks.map((p) => p.element);
  if (!squadIds.length) return null;
  const multipliers = new Map(picks.picks.filter((p) => p.position <= 11).map((p) => [p.element, p.multiplier]));

  const fixtures = await getFixturesAll().catch(() => [] as Awaited<ReturnType<typeof getFixturesAll>>);

  const now = Date.now();
  const dcMatches: DcMatch[] = fixtures
    .filter((f) => f.finished && f.team_h_score != null && f.team_a_score != null && f.kickoff_time)
    .map((f) => ({
      homeTeam: f.team_h,
      awayTeam: f.team_a,
      gh: f.team_h_score!,
      ga: f.team_a_score!,
      ageDays: Math.max(0, (now - new Date(f.kickoff_time!).getTime()) / 86_400_000),
    }));
  const fit = fitDixonColes(dcMatches, { xi: 0.0045 });
  if (!fit.matchesUsed) return null;

  const webPlayers: WebPlayer[] = [];
  const webFixtures: { elementId: number; homeTeam: number; awayTeam: number; isHome: boolean }[] = [];
  for (const id of squadIds.slice(0, 11)) {
    const el = boot.elements[id];
    if (!el) continue;
    const fx = fixtures.find((f) => f.event === currentGw && (f.team_h === el.team || f.team_a === el.team));
    if (!fx) continue;
    const shareBase = Math.max(1e-6, el.xg90 ?? 0.12);
    webPlayers.push({
      elementId: id,
      teamId: el.team,
      pos: el.element_type as WebPlayer["pos"],
      goalShare: shareBase,
      assistShare: Math.max(1e-6, el.xa90 ?? 0.08),
      minutesProb: el.chance_of_playing_this_round != null ? el.chance_of_playing_this_round / 100 : 0.9,
      defconRate: el.element_type === 2 ? 0.3 : 0.05,
    });
    webFixtures.push({ elementId: id, homeTeam: fx.team_h, awayTeam: fx.team_a, isHome: fx.team_h === el.team });
  }
  if (webPlayers.length < 1) return null;
  return { fit, players: webPlayers, fixtures: webFixtures, multipliers, currentGw };
}

export async function buildCorrelationWeb(teamId: number, gw?: number): Promise<CorrelationWebPayload | null> {
  const boot = await getBootstrapLite();
  const ctx = await buildWebContext(teamId, gw);
  if (!ctx || ctx.players.length < 3) return null;
  const { players: webPlayers, fixtures: webFixtures, fit } = ctx;

  const web = simulateWeb(webPlayers, webFixtures, fit, undefined, {
    M: 800,
    seed: 2026,
    // The per-draw matrix is what turns eleven independent-looking players
    // into one distribution of gameweek totals.
    keepDraws: true,
  });
  const risk = marginalRisk(webPlayers, web.correlation, web.variance);

  // Collapse the draw matrix into XI totals, applying the pick multipliers so
  // the captain counts twice exactly as he does on the scoreboard.
  const totals: number[] = [];
  if (web.drawsMatrix) {
    const M = web.draws;
    const mults = webPlayers.map((p) => ctx.multipliers.get(p.elementId) ?? 1);
    for (let m = 0; m < M; m++) {
      let sum = 0;
      for (let i = 0; i < webPlayers.length; i++) sum += web.drawsMatrix[i * M + m] * mults[i];
      totals.push(Number(sum.toFixed(2)));
    }
    totals.sort((a, b) => a - b);
  }

  const pairs: { a: number; b: number; rho: number }[] = [];
  for (const [key, rho] of web.correlation) {
    if (Math.abs(rho) < 0.15) continue;
    const [a, b] = key.split("|").map(Number);
    pairs.push({ a, b, rho: Number(rho.toFixed(3)) });
  }
  pairs.sort((x, y) => Math.abs(y.rho) - Math.abs(x.rho));

  const meanPoints: Record<number, number> = {};
  for (const p of webPlayers) meanPoints[p.elementId] = web.meanPoints.get(p.elementId) ?? 0;
  const riskShare: Record<number, number> = {};
  for (const p of webPlayers) riskShare[p.elementId] = Number((risk.share.get(p.elementId) ?? 0).toFixed(4));
  const sdPoints: Record<number, number> = {};
  for (const p of webPlayers) {
    sdPoints[p.elementId] = Number(Math.sqrt(Math.max(0, web.variance.get(p.elementId) ?? 0)).toFixed(3));
  }

  return {
    players: webPlayers.map((p) => ({ elementId: p.elementId, webName: boot.elements[p.elementId]?.web_name ?? `#${p.elementId}` })),
    pairs,
    meanPoints,
    riskShare,
    sdPoints,
    totals,
    portfolioSd: Number(risk.portfolioSd.toFixed(2)),
    effectiveBets: web.effectiveBets,
    draws: web.draws,
  };
}
