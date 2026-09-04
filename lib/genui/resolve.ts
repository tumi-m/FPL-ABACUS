import "server-only";

/**
 * Resolver — the ONLY place where genUI cards get numbers. Given a routed
 * component + params + entry context it produces props for the client
 * renderer from cached upstream data and our engines. The model never
 * supplies values; unknown names degrade gracefully (nulls, not guesses).
 */
import { getBootstrapLite, type ElementLite } from "@/lib/fpl/bootstrapLite";
import { getElementSummary, getEntry, getFixturesAll, getHistory, getPicks, getStandings } from "@/lib/fpl/endpoints";
import { buildFixtureModel, easiness, projectFixture } from "@/lib/engines/fixtureModel";
import { pressure, rankTonight, velocitySeries } from "@/lib/engines/price";
import { loadChangeLedger, loadSnapshots } from "@/lib/server/priceStore";
import { buildCorrelationWeb, buildWebContext } from "@/lib/server/buildCorrelationWeb";
import { crowding } from "@/lib/quant/crowding";
import { wpaPaired } from "@/lib/quant/wpa";
import { twinStudy } from "@/lib/engines/twinStudy";
import { db } from "@/lib/db";
import { dbRead } from "@/lib/db/read";
import { cohortEntry, cohortSnapshot } from "@/lib/db/schema";
import { and, eq, or } from "drizzle-orm";
import { hasDb } from "@/lib/env";
import { trueForm } from "@/lib/quant/estimators";
import { chipOptionValue } from "@/lib/quant/decision";
import { generateSquad } from "@/lib/genui/squadGen";
import { recentItems } from "@/lib/news/store";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

export interface ResolveContext {
  teamId: number | null;
  currentGw: number;
  matchday?: MatchdayModel | null;
}

export interface ResolvedCard {
  component: string;
  title: string;
  /** Template prose generated from resolved data only — never model text. */
  prose: string;
  props: Record<string, unknown> | null;
  note?: string;
  /** Newsdesk links grounding the card — shown under the answer. */
  sources?: { title: string; url: string; source: string; publishedAt: string }[];
}

function findElement(
  boot: Awaited<ReturnType<typeof getBootstrapLite>>,
  name?: unknown,
): ElementLite | null {
  if (typeof name !== "string" || name.length < 3) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-zà-ÿ'-]/g, "");
  const needle = norm(name);
  const all = Object.values(boot.elements);
  return (
    all.find((e) => norm(e.web_name) === needle) ??
    all.find((e) => norm(e.web_name).startsWith(needle)) ??
    null
  );
}

async function squadIdsFor(ctx: ResolveContext): Promise<number[]> {
  if (!ctx.teamId) return [];
  try {
    const picks = await getPicks(ctx.teamId, ctx.currentGw, true);
    return picks.picks.map((p) => p.element);
  } catch {
    return [];
  }
}

export async function resolveCard(
  component: string,
  params: Record<string, unknown>,
  ctx: ResolveContext,
): Promise<ResolvedCard | null> {
  switch (component) {
    case "captain-compare":
      return captainCompare(params, ctx);
    case "exposure-scatter":
      return exposureScatter(ctx);
    case "price-gauge":
      return priceGauge(params, ctx);
    case "fixture-run":
      return fixtureRun(params, ctx);
    case "defcon-check":
      return defconCheck(params, ctx);
    case "xg-vs-actual":
      return xgVsActual(params);
    case "rank-projection":
      return rankProjection(ctx);
    case "swing-impact":
      return swingImpact(ctx);
    case "chip-timeline":
      return chipTimeline(ctx);
    case "injury-list":
      return injuryList(ctx);
    case "news-search":
      return newsSearch(params, ctx);
    case "transfer-sim":
      return transferSim(params, ctx);
    case "effective-bets":
      return effectiveBets(ctx);
    case "true-form":
      return trueFormCard(params);
    case "squad-generator":
      return squadGenerator(params);
    case "transfer-watch":
      return transferWatch(params, ctx);
    case "chip-timing":
      return chipTiming(ctx);
    case "review":
      return reviewCard(ctx);
    case "crowding":
      return crowdingCard(ctx);
    case "wpa":
      return wpaCard(params, ctx);
    case "twin-study":
      return twinStudyCard(params, ctx);
    default:
      return null;
  }
}

// ── individual resolvers ─────────────────────────────────────────────────────

async function captainCompare(
  params: Record<string, unknown>,
  ctx: ResolveContext,
): Promise<ResolvedCard | null> {
  const boot = await getBootstrapLite();
  const squad = await squadIdsFor(ctx);
  const pool = (squad.length
    ? squad.map((id) => boot.elements[id]).filter((e): e is ElementLite => e != null)
    : Object.values(boot.elements)
  )
    .filter((e) => e.element_type !== 1)
    .sort((a, b) => (b.ep_next ?? 0) - (a.ep_next ?? 0))
    .slice(0, 6);
  const rows = pool.map((e) => ({
    name: e.web_name,
    epNext: e.ep_next ?? 0,
    eo: Number(e.selected_by_percent ?? 0),
  }));
  if (!rows.length) return null;
  const focus = findElement(boot, params.playerName);
  return {
    component: "captain-compare",
    title: "Captaincy board",
    prose: focus
      ? `${focus.web_name} projects ${focus.ep_next ?? "?"} next gameweek — against ${rows[0].name} at ${rows[0].epNext}.`
      : `Top projected returns: ${rows.slice(0, 3).map((r) => `${r.name} (${r.epNext})`).join(", ")}.`,
    props: { rows },
  };
}

async function exposureScatter(ctx: ResolveContext): Promise<ResolvedCard | null> {
  if (!ctx.matchday) return null;
  return {
    component: "exposure-scatter",
    title: "Where am I exposed?",
    prose: `${ctx.matchday.squad.filter((s) => !s.onBench).length} on the pitch, plotted by cohort ownership.`,
    props: { rows: ctx.matchday.squad },
  };
}

/** Fallback when no stored snapshot history covers the player yet — event net
 *  transfers only, labelled as an estimate. */
function estimatedPriceGauge(el: ElementLite): ResolvedCard {
  const net = el.transfersInEvent - el.transfersOutEvent;
  return {
    component: "price-gauge",
    title: "Price watch",
    prose: `${el.web_name}: ${net >= 0 ? "+" : ""}${net.toLocaleString("en-GB")} net transfers this gameweek.`,
    props: {
      playerName: el.web_name,
      netTransfers: net,
      riseProbability: Math.min(0.95, Math.abs(net) / 220_000),
      velocity24h: [net],
    },
    note: "Stored hourly snapshots have not covered this player yet — gameweek net transfers only.",
  };
}

async function priceGauge(
  params: Record<string, unknown>,
  ctx: ResolveContext,
): Promise<ResolvedCard | null> {
  const boot = await getBootstrapLite();
  const focus = findElement(boot, params.playerName);

  // Named player → the gauge, grounded in stored snapshot history.
  if (focus) {
    const [snaps, ledger] = await Promise.all([loadSnapshots([focus.id]), loadChangeLedger()]);
    const series = snaps.get(focus.id) ?? [];
    if (series.length < 2) return estimatedPriceGauge(focus);
    const p = pressure(series, ledger.lastByElement.get(focus.id)?.at ?? null);
    const eta =
      p.etaDays != null
        ? ` — about ${p.etaDays} day${p.etaDays === 1 ? "" : "s"} to the threshold at today's pace`
        : "";
    return {
      component: "price-gauge",
      title: "Price watch",
      prose: `${focus.web_name}: ${p.net >= 0 ? "+" : ""}${Math.round(p.net).toLocaleString("en-GB")} net transfers of stored pressure${eta}.`,
      props: {
        playerName: focus.web_name,
        netTransfers: Math.round(p.net),
        riseProbability: p.pRise,
        velocity24h: velocitySeries(series),
      },
      note: `From ${series.length} stored hourly snapshots through the rise model.`,
    };
  }

  // Unnamed → the Tonight list: squad ranked by |p(move)| (falls back to the
  // field's most-transferred players when you have no squad in context).
  let ids = await squadIdsFor(ctx);
  let scope = "your squad";
  if (!ids.length) {
    scope = "the field's most-transferred players";
    ids = Object.values(boot.elements)
      .sort(
        (a, b) =>
          b.transfersInEvent - b.transfersOutEvent - (a.transfersInEvent - a.transfersOutEvent),
      )
      .slice(0, 8)
      .map((e) => e.id);
  }
  const [snapMap, ledger] = await Promise.all([loadSnapshots(ids), loadChangeLedger()]);
  const rows = rankTonight(
    ids.flatMap((id) => {
      const el = boot.elements[id];
      if (!el) return [];
      return [
        {
          element: id,
          snapshots: snapMap.get(id) ?? [],
          lastChangeAt: ledger.lastByElement.get(id)?.at ?? null,
        },
      ];
    }),
  );
  if (!rows.some((r) => r.covered)) {
    const top = boot.elements[ids[0]];
    return top
      ? { ...estimatedPriceGauge(top), note: `No stored snapshot history yet. ${estimatedPriceGauge(top).note}` }
      : null;
  }
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = ledger.byDay.get(todayKey) ?? { rises: [], falls: [] };
  const topRow = rows[0];
  return {
    component: "price-gauge",
    title: "Tonight",
    prose: `Closest to a move across ${scope}: ${boot.elements[topRow.element]?.web_name ?? "?"} at ${Math.round(topRow.pRise * 100)}%. Today so far: ${today.rises.length} rise${today.rises.length === 1 ? "" : "s"}, ${today.falls.length} fall${today.falls.length === 1 ? "" : "s"}.`,
    props: {
      tonight: rows.slice(0, 6).map((r) => ({ ...r, name: boot.elements[r.element]?.web_name ?? `#${r.element}` })),
      scope,
      todayRises: today.rises.length,
      todayFalls: today.falls.length,
    },
    note: "Rise model on stored hourly snapshots; probabilities are estimates.",
  };
}

async function fixtureRun(
  params: Record<string, unknown>,
  ctx: ResolveContext,
): Promise<ResolvedCard | null> {
  const boot = await getBootstrapLite();
  let target = findElement(boot, params.playerName);
  if (!target) {
    const squad = await squadIdsFor(ctx);
    target = squad.length ? boot.elements[squad[0]] ?? null : null;
  }
  if (!target) return null;

  const fixtures = await getFixturesAll().catch(() => [] as Awaited<ReturnType<typeof getFixturesAll>>);
  const model = buildFixtureModel(fixtures, { upToGw: ctx.currentGw });
  const teamShort = boot.teams.find((t) => t.id === target!.team)?.short_name ?? "?";
  const points: { gw: number; xgc: number }[] = [];
  const opponents: string[] = [];
  for (let gw = ctx.currentGw; gw <= Math.min(38, ctx.currentGw + 5); gw++) {
    const fx = fixtures.filter(
      (f) => f.event === gw && (f.team_h === target!.team || f.team_a === target!.team),
    );
    if (!fx.length) continue;
    const home = fx[0].team_h === target.team;
    const oppId = home ? fx[0].team_a : fx[0].team_h;
    void easiness(projectFixture(model, target.team, oppId, home), 4);
    points.push({ gw, xgc: Number(model.teams.get(oppId)?.defence90.toFixed(2) ?? "1.35") });
    opponents.push(boot.teams.find((t) => t.id === oppId)?.short_name ?? String(oppId));
  }
  if (points.length < 2) return null;
  const meanDefence = Number(model.league.meanDefence90.toFixed(2));
  return {
    component: "fixture-run",
    title: "Fixture swing",
    prose: `${target.web_name} (${teamShort}) face ${opponents.join(", ")} — league mean defence ${meanDefence}.`,
    props: { playerName: target.web_name, leagueMean: meanDefence, points },
  };
}

async function defconCheck(
  params: Record<string, unknown>,
  ctx: ResolveContext,
): Promise<ResolvedCard | null> {
  if (!ctx.matchday) return null;
  const wanted = typeof params.playerName === "string" ? params.playerName.toLowerCase() : null;
  const named = wanted
    ? ctx.matchday.squad.find((s) => s.webName.toLowerCase().startsWith(wanted)) ?? null
    : null;
  if (wanted && !named) return null;
  const matches = named
    ? [{ label: named.opponentShort || "GW", defcon: named.defconCount }]
    : ctx.matchday.squad
        .filter((s) => !s.onBench && s.defconCount > 0)
        .slice(0, 8)
        .map((s) => ({ label: s.opponentShort || "GW", defcon: s.defconCount }));
  if (!matches.length) return null;
  return {
    component: "defcon-check",
    title: "DEFCON tracker",
    prose: named
      ? `${named.webName} has ${named.defconCount} DEFCON events (threshold ${named.defconThreshold}).`
      : `${matches.length} of your players are banking DEFCON events.`,
    props: { matches, threshold: named?.defconThreshold ?? 10, playerName: named?.webName },
  };
}

async function xgVsActual(params: Record<string, unknown>): Promise<ResolvedCard | null> {
  const boot = await getBootstrapLite();
  const el = findElement(boot, params.playerName);
  if (!el) return null;
  try {
    const summary = await getElementSummary(el.id);
    const history = [...summary.history].sort((a, b) => a.round - b.round).slice(-10);
    if (history.length < 2) return null;
    let cxg = 0;
    let cact = 0;
    const points = history.map((h) => {
      cxg += h.expected_goal_involvements ?? 0;
      cact += (h.goals_scored ?? 0) + (h.assists ?? 0);
      return { gw: h.round, xgi: Number(cxg.toFixed(2)), actual: Number(cact.toFixed(2)) };
    });
    const gap = points[points.length - 1].actual - points[points.length - 1].xgi;
    return {
      component: "xg-vs-actual",
      title: "Due or finished?",
      prose: `${el.web_name}: ${gap >= 0 ? "outperforming" : "underperforming"} cumulative xGI by ${Math.abs(gap).toFixed(1)} over the last ${history.length} games.`,
      props: { playerName: el.web_name, points },
    };
  } catch {
    return null;
  }
}

function distributionBinsFromModel(model: MatchdayModel): { x: number; y: number }[] {
  const rc = model.rankContext;
  if (!rc || rc.fieldAvg <= 0) return [];
  const sd = Math.max(6, rc.fieldAvg * 0.33);
  const lo = Math.max(0, rc.fieldAvg - 3 * sd);
  const step = (6 * sd) / 39;
  return Array.from({ length: 40 }, (_, i) => {
    const x = Math.round(lo + i * step);
    return { x, y: Math.round(1000 * Math.exp(-0.5 * ((x - rc.fieldAvg) / sd) ** 2)) };
  });
}

async function rankProjection(ctx: ResolveContext): Promise<ResolvedCard | null> {
  if (!ctx.matchday) return null;
  const bins = distributionBinsFromModel(ctx.matchday);
  if (!bins.length) return null;
  const hero = ctx.matchday.hero;
  return {
    component: "rank-projection",
    title: "Rank outlook",
    prose:
      hero.estimatedLiveRank != null
        ? `You sit around ${hero.estimatedLiveRank.toLocaleString("en-GB")} live — field average is ${hero.gwPoints} vs your ${Math.round(bins.reduce((s, b) => Math.max(s, b.y), 0))} peak bin.`
        : `Field averages around ${ctx.matchday.rankContext?.fieldAvg.toFixed(1)} points this week.`,
    props: { bins, yourScore: hero.gwPoints },
  };
}

async function swingImpact(ctx: ResolveContext): Promise<ResolvedCard | null> {
  if (!ctx.matchday) return null;
  const rows = ctx.matchday.swings.slice(0, 8).map((s) => ({
    label: `${s.minute}' ${s.webName}`,
    detail: s.yourMultiplier > 0 ? "you own" : "field owns",
    value: s.ranksGained,
  }));
  if (!rows.length) return null;
  return {
    component: "swing-impact",
    title: "Rank impact by event",
    prose: `${rows.length} scoring events tracked this gameweek.`,
    props: { rows },
  };
}

async function chipTimeline(ctx: ResolveContext): Promise<ResolvedCard | null> {
  if (!ctx.teamId) return null;
  try {
    const hist = await getHistory(ctx.teamId);
    const plays = hist.chips.map((c) => ({
      manager: "You",
      gw: c.event,
      kind:
        c.name === "wildcard"
          ? ("wc1" as const)
          : c.name === "freehit"
            ? ("fh" as const)
            : c.name === "bboost"
              ? ("bb" as const)
              : ("wc2" as const),
    }));
    if (!plays.length) {
      return {
        component: "chip-timeline",
        title: "Chip timeline",
        prose: "No chips played yet — all options remain.",
        props: null,
      };
    }
    return {
      component: "chip-timeline",
      title: "Chip timeline",
      prose: `${plays.length} chip${plays.length === 1 ? "" : "s"} played so far.`,
      props: {
        plays,
        gwRange: [
          Math.min(...plays.map((p) => p.gw), ctx.currentGw),
          Math.max(...plays.map((p) => p.gw), 38),
        ],
      },
    };
  } catch {
    return null;
  }
}

async function injuryList(ctx: ResolveContext): Promise<ResolvedCard | null> {
  const boot = await getBootstrapLite();
  const squad = await squadIdsFor(ctx);
  const source = squad.length
    ? squad.map((id) => boot.elements[id]).filter((e): e is ElementLite => e != null)
    : [...Object.values(boot.elements)].filter((e) => e.news.trim().length > 0).slice(0, 12);
  const flagged = source.filter((e) => e.news.trim().length > 0 || e.status !== "a");
  if (!flagged.length) {
    return {
      component: "injury-list",
      title: "Availability desk",
      prose: "Clean bill of health across your squad.",
      props: null,
    };
  }
  const flaggedIds = new Set(flagged.map((e) => e.id));
  let sources: ResolvedCard["sources"];
  try {
    sources = (await recentItems(60))
      .filter((i) => i.elementIds.some((el) => flaggedIds.has(el)))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3)
      .map((i) => ({ title: i.title, url: i.url, source: i.source, publishedAt: i.publishedAt.toISOString() }));
  } catch {
    sources = undefined;
  }
  return {
    component: "injury-list",
    title: "Availability desk",
    prose: `${flagged.length} flagged player${flagged.length === 1 ? "" : "s"}.`,
    props: {
      players: flagged.slice(0, 10).map((e) => ({
        name: e.web_name,
        news: e.news,
        status: e.status,
        chance: e.chance_of_playing_this_round,
      })),
    },
    sources,
  };
}

async function newsSearch(params: Record<string, unknown>, ctx: ResolveContext): Promise<ResolvedCard | null> {
  if (!hasDb) return null;
  try {
    const squadIds = await squadIdsFor(ctx);
    const items = await recentItems(60);
    const query = typeof params.query === "string" ? params.query.toLowerCase() : "";
    const words = query.split(/\s+/).filter((w) => w.length > 3);
    const scored = items
      .map((i) => {
        let score = i.relevance + (i.elementIds.some((el) => squadIds.includes(el)) ? 3 : 0);
        const hay = `${i.title} ${i.summary ?? ""}`.toLowerCase();
        for (const w of words) {
          if (hay.includes(w)) score += 0.5;
        }
        return { ...i, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    if (!scored.length) return null;
    return {
      component: "news-search",
      title: "Newsdesk search",
      prose: `${scored.length} stories matched.`,
      props: {
        items: scored.map((i) => ({ title: i.title, url: i.url, source: i.source, publishedAt: i.publishedAt })),
      },
      sources: scored.slice(0, 3).map((i) => ({
        title: i.title,
        url: i.url,
        source: i.source,
        publishedAt: i.publishedAt.toISOString(),
      })),
    };
  } catch {
    return null;
  }
}

async function transferSim(
  params: Record<string, unknown>,
  ctx: ResolveContext,
): Promise<ResolvedCard | null> {
  const boot = await getBootstrapLite();
  const outEl = findElement(boot, params.out) ?? findElement(boot, params.in);
  const inEl = findElement(boot, params.in);
  if (!outEl || !inEl || outEl.id === inEl.id) {
    return {
      component: "transfer-sim",
      title: "Transfer simulation",
      prose: ctx.matchday
        ? "Name two players and I will price the move against your free transfers."
        : "Set your team id first, then name the move — e.g. sell Trent, buy Walker.",
      props: null,
    };
  }
  const gain = (inEl.ep_next ?? 0) - (outEl.ep_next ?? 0);
  const beyondFt = false; // single-move preview; ledger maths lives on the Board
  return {
    component: "transfer-sim",
    title: "Transfer simulation",
    prose: `${inEl.web_name} over ${outEl.web_name}: ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} projected next GW — ${gain >= 4 ? "covers a hit outright" : gain > 0 ? `pays a −4 back in ~${Math.ceil(4 / gain)} GW` : "does not pay for a hit"}.`,
    props: {
      moves: [{ out: { webName: outEl.web_name, epNext: outEl.ep_next }, in: { webName: inEl.web_name, epNext: inEl.ep_next } }],
      hitTotal: beyondFt ? 4 : 0,
    },
  };
}

// ── v3 Q0: the Correlation Web ───────────────────────────────────────────────

async function effectiveBets(ctx: ResolveContext): Promise<ResolvedCard | null> {
  if (!ctx.teamId) return null;
  const web = await buildCorrelationWeb(ctx.teamId, ctx.currentGw);
  if (!web) return null;
  const n = web.players.length;
  const bets = web.effectiveBets;
  return {
    component: "effective-bets",
    title: "Effective bets",
    prose: `Your XI behaves like ${bets.toFixed(1)} independent bets across ${n} players — stacking correlates outcomes and swings variance.`,
    props: {
      value: bets / n,
      label: "Effective bets",
      hint: `${bets.toFixed(1)} / ${n}`,
    },
  };
}

// ── v3 Q3: true form ─────────────────────────────────────────────────────────

async function trueFormCard(params: Record<string, unknown>): Promise<ResolvedCard | null> {
  const boot = await getBootstrapLite();
  const el = findElement(boot, params.playerName);
  if (!el) return null;
  try {
    const summary = await getElementSummary(el.id);
    const history = [...summary.history].sort((a, b) => a.round - b.round).slice(-12);
    const observations = history.map((h) => ({
      y90: h.minutes > 0 ? ((h.expected_goals ?? 0) + (h.expected_assists ?? 0)) / Math.max(1, h.minutes / 90) : null,
      minutes: h.minutes,
    }));
    if (observations.length < 4) return null;

    const state = trueForm(observations);
    const points = state.filtered.map((f, i) => {
      const spread = 1.96 * f.sd;
      return { x: history[i].round, p50: Number(f.ability.toFixed(3)), p5: Number((f.ability - spread).toFixed(3)), p95: Number((f.ability + spread).toFixed(3)) };
    });
    return {
      component: "true-form",
      title: "True form",
      prose: `${el.web_name}'s filtered per-90 contribution sits at ${state.ability.toFixed(2)} ±${(1.96 * Math.sqrt(state.variance)).toFixed(2)} — the band widens whenever minutes vanish.`,
      props: { playerName: el.web_name, points },
    };
  } catch {
    return null;
  }
}

// ── v5-D: assistant use cases ────────────────────────────────────────────────

async function squadGenerator(params: Record<string, unknown>): Promise<ResolvedCard | null> {
  const boot = await getBootstrapLite();
  const risk = params.risk === "safe" || params.risk === "differential" ? params.risk : "balanced";
  const budgetTenths =
    typeof params.budgetTenths === "number" ? Math.round(params.budgetTenths) : 1000;
  const squad = generateSquad(Object.values(boot.elements), { budgetTenths, risk });
  if (!squad) return null;
  const POS = ["GK", "DEF", "MID", "FWD"];
  return {
    component: "squad-generator",
    title: `Squad builder · ${risk}`,
    prose: `A legal 15 for £${(squad.totalCost / 10).toFixed(1)}m projecting ${squad.totalEpNext} next gameweek. Prices move — treat it as a shortlist, not a shopping cart.`,
    props: { risk, totalCost: squad.totalCost, players: squad.picks.map((p) => ({ ...p, posLabel: POS[p.pos - 1] ?? "?" })) },
    note: "Generated from current prices and FPL projections.",
  };
}

async function transferWatch(_params: Record<string, unknown>, ctx: ResolveContext): Promise<ResolvedCard | null> {
  const boot = await getBootstrapLite();
  const squadIds = await squadIdsFor(ctx);
  if (!squadIds.length) return null;
  const rows = squadIds
    .map((id) => boot.elements[id])
    .filter((e): e is ElementLite => e != null)
    .sort((a, b) => (a.ep_next ?? 0) - (b.ep_next ?? 0))
    .slice(0, 5)
    .map((e) => ({
      name: e.web_name,
      epNext: e.ep_next,
      cost: e.now_cost,
      flagged: e.status !== "a",
      news: e.news,
    }));
  if (!rows.length) return null;
  return {
    component: "transfer-watch",
    title: "Transfer watch",
    prose: `Weakest projected links: ${rows.slice(0, 3).map((r) => r.name).join(", ")}. Price any of them out and the swap pays for itself.`,
    props: { players: rows },
  };
}

async function chipTiming(ctx: ResolveContext): Promise<ResolvedCard | null> {
  const squadIds = await squadIdsFor(ctx);
  if (squadIds.length < 11) return null;
  const boot = await getBootstrapLite();
  const fixtures = await getFixturesAll().catch(() => [] as Awaited<ReturnType<typeof getFixturesAll>>);
  const model = buildFixtureModel(fixtures, { upToGw: ctx.currentGw });

  // Payoff per remaining gameweek: your XI's projected output scaled by the
  // fixture ease each week offers. An estimate by construction.
  const gws = boot.events.filter((e) => e.id >= ctx.currentGw).slice(0, 6);
  const payoffs = gws.map((gw) => {
    let sum = 0;
    for (const id of squadIds.slice(0, 11)) {
      const el = boot.elements[id];
      if (!el) continue;
      const fx = fixtures.find(
        (f) => f.event === gw.id && (f.team_h === el.team || f.team_a === el.team),
      );
      if (!fx) continue;
      const home = fx.team_h === el.team;
      const oppId = home ? fx.team_a : fx.team_h;
      const p = projectFixture(model, el.team, oppId, home);
      const ease = Math.max(0.5, Math.min(1.5, p.xgFor / model.league.meanAttack90));
      sum += (el.ep_next ?? 0) * ease;
    }
    return Number(sum.toFixed(1));
  });
  if (payoffs.length < 2) return null;

  const opt = chipOptionValue({ payoffs, vol: 0.15, seed: ctx.currentGw, paths: 2000 });
  const bestWeek = gws[opt.exerciseIndex]?.id ?? ctx.currentGw;
  return {
    component: "chip-timing",
    title: "Chip timing",
    prose: `On this fixture run the payoff peaks in GW${bestWeek}. Playing earlier leaves value on the table; later risks a worse draw.`,
    props: { gws: gws.map((g) => g.id), payoffs, exerciseIndex: opt.exerciseIndex },
    note: "Fixture-ease weighted projection, not a full simulation.",
  };
}

async function reviewCard(ctx: ResolveContext): Promise<ResolvedCard | null> {
  if (!ctx.matchday) return null;
  const hero = ctx.matchday.hero;
  const parts: string[] = [];
  if (hero.officialEventPoints != null) {
    parts.push(`You scored ${hero.officialEventPoints}, sitting around ${
      hero.officialLiveRank != null ? hero.officialLiveRank.toLocaleString("en-GB") : "—"
    }.`);
  } else {
    parts.push(`You are on ${hero.gwPoints} live.`);
  }
  const topSwing = [...ctx.matchday.swings].sort((a, b) => Math.abs(b.ranksGained) - Math.abs(a.ranksGained))[0];
  if (topSwing) {
    parts.push(
      `The decisive moment was ${topSwing.minute}' ${topSwing.webName} — ${Math.abs(topSwing.ranksGained).toLocaleString("en-GB")} ranks ${topSwing.ranksGained >= 0 ? "gained" : "lost"}.`,
    );
  }
  if (hero.benchPoints > 0) parts.push(`Your bench contributed ${hero.benchPoints}.`);
  if (hero.transfersCost > 0) parts.push(`Hits cost you −${hero.transfersCost}.`);
  return {
    component: "review",
    title: "Gameweek review",
    prose: parts.join(" "),
    props: null,
  };
}

// ── v3 Q5 extras: crowding + paired WPA ─────────────────────────────────────

async function crowdingCard(ctx: ResolveContext): Promise<ResolvedCard | null> {
  if (!ctx.teamId) return null;
  const boot = await getBootstrapLite();
  const squad = await squadIdsFor(ctx);
  if (!squad.length) return null;
  const result = crowding(
    squad.map((id) => ({
      elementId: id,
      pos: (boot.elements[id]?.element_type ?? 4) as 1 | 2 | 3 | 4,
      eo: boot.elements[id]?.selected_by_percent ?? 0,
    })),
  );
  if (!result.positions.length) return null;
  const POS_LABEL: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
  const rows = result.positions.map((p) => ({
    posLabel: POS_LABEL[p.pos],
    effectivePicks: p.effectivePicks,
    players: p.players,
    topName: p.top ? (boot.elements[p.top.elementId]?.web_name ?? `#${p.top.elementId}`) : null,
    topShare: p.top?.share ?? 0,
  }));
  const tightest = [...result.positions].sort((a, b) => a.effectivePicks - b.effectivePicks)[0];
  const tightestLabel = POS_LABEL[tightest.pos];
  return {
    component: "crowding",
    title: "Crowding",
    prose: `The ${tightestLabel} market is making ~${tightest.effectivePicks.toFixed(1)} effective picks across ${tightest.players} owned players — collapse means differential value, spread means the template is cheap.`,
    props: { rows },
  };
}

async function wpaCard(params: Record<string, unknown>, ctx: ResolveContext): Promise<ResolvedCard | null> {
  if (!ctx.teamId) return null;

  // rival: explicit param, else the neighbour directly above you in your first classic league
  let rivalEntry = typeof params.rivalEntry === "number" ? params.rivalEntry : null;
  let rivalName: string | null = null;
  if (rivalEntry == null) {
    try {
      const entry = await getEntry(ctx.teamId);
      const leagueId = entry.leagues?.classic?.[0]?.id;
      if (leagueId != null) {
        const standings = await getStandings(leagueId, 1);
        const rows = standings.standings.results;
        const mine = rows.find((r) => r.entry === ctx.teamId);
        const above = mine ? rows.find((r) => r.rank === mine.rank - 1) : rows.find((r) => r.entry !== ctx.teamId);
        if (above) {
          rivalEntry = above.entry;
          rivalName = above.entry_name;
        }
      }
    } catch {
      rivalEntry = null;
    }
  }
  if (rivalEntry == null) return null;

  const [youCtx, themCtx] = await Promise.all([
    buildWebContext(ctx.teamId, ctx.currentGw),
    buildWebContext(rivalEntry, ctx.currentGw),
  ]);
  if (!youCtx || !themCtx) return null;

  const result = wpaPaired(
    { players: youCtx.players, fixtures: youCtx.fixtures, multipliers: youCtx.multipliers },
    { players: themCtx.players, fixtures: themCtx.fixtures, multipliers: themCtx.multipliers },
    youCtx.fit,
    { M: 2000, seed: 2026, topN: 4 },
  );
  if (!result) return null;

  if (rivalName == null) {
    try {
      const rival = await getEntry(rivalEntry);
      rivalName = rival.name ?? null;
    } catch {
      rivalName = null;
    }
  }
  const boot = await getBootstrapLite();
  const moments = result.moments.map((m) => ({
    name: boot.elements[m.elementId]?.web_name ?? `#${m.elementId}`,
    side: m.side,
    wpa: Math.round(m.wpa * 1000) / 10,
  }));
  const pct = Math.round(result.winProb * 100);
  const hero = moments[0];
  const prose = hero
    ? `Across ${result.draws.toLocaleString("en-GB")} paired simulations you beat ${rivalName ?? `entry ${rivalEntry}`} ${pct}% of the time — ${hero.name} is the swing that matters most.`
    : `Across ${result.draws.toLocaleString("en-GB")} paired simulations you beat ${rivalName ?? `entry ${rivalEntry}`} ${pct}% of the time.`;
  return {
    component: "wpa",
    title: "Win probability added",
    prose,
    props: {
      winProb: pct,
      rivalName: rivalName ?? `Entry ${rivalEntry}`,
      expectedPoints: result.expectedPoints,
      moments,
    },
  };
}

// ── v3-10: the twin study ────────────────────────────────────────────────────

async function twinStudyCard(params: Record<string, unknown>, ctx: ResolveContext): Promise<ResolvedCard | null> {
  if (!hasDb || !ctx.teamId) return null;
  const boot = await getBootstrapLite();
  const squadIds = await squadIdsFor(ctx);
  if (!squadIds.length) return null;

  // the decision under study: a player in your squad the model may name
  const named = typeof params.playerName === "string" ? findElement(boot, params.playerName) : null;
  const target = named && squadIds.includes(named.id) ? named.id : squadIds[squadIds.length - 1];

  // Cohort rows for the settled GW. Stored-data reads degrade, they do not
  // throw (V9-G): `hasDb` says a database is configured, not that the schema
  // was ever applied, so both selects go through dbRead with an honest empty.
  const snapRows = await dbRead(
    "ask:twinStudy:snapshot",
    () => [] as { id: number }[],
    () =>
      db()
        .select({ id: cohortSnapshot.id })
        .from(cohortSnapshot)
        .where(eq(cohortSnapshot.event, ctx.currentGw))
        .limit(1),
  );
  if (!snapRows.length) return null;
  // EO rows (matchId 0) plus twins matched to this squad by the 30k top-up.
  const rows = await dbRead(
    "ask:twinStudy:entries",
    () => [] as {
      entry: number;
      elements: number[];
      counts: [number, number, number];
      squadCostTenths: number;
      bankTenths: number;
      eventTransfers: number | null;
      gwPoints: number | null;
      arm: string | null;
    }[],
    () =>
      db()
        .select({
          entry: cohortEntry.entry,
          elements: cohortEntry.elements,
          counts: cohortEntry.counts,
          squadCostTenths: cohortEntry.squadCostTenths,
          bankTenths: cohortEntry.bankTenths,
          eventTransfers: cohortEntry.eventTransfers,
          gwPoints: cohortEntry.gwPoints,
          arm: cohortEntry.arm,
        })
        .from(cohortEntry)
        .where(
          and(
            eq(cohortEntry.snapshotId, snapRows[0].id),
            // The teamId gate above has already narrowed this; assert for drizzle.
            or(eq(cohortEntry.matchId, 0), eq(cohortEntry.matchId, ctx.teamId as number)),
          ),
        ),
  );
  if (!rows.length) return null;

  const settled = rows.filter((r) => r.gwPoints != null && r.arm != null) as {
    entry: number;
    elements: number[];
    counts: [number, number, number];
    squadCostTenths: number;
    bankTenths: number;
    eventTransfers: number | null;
    gwPoints: number;
    arm: string;
  }[];
  // outcomes only exist post-settle — before that there is nothing honest to show
  if (settled.length < 100) return null;

  const history = await getHistory(ctx.teamId).catch(() => null);
  const myBank = history?.current[history.current.length - 1]?.bank ?? 0;
  const myFt = history?.current[history.current.length - 1]?.event_transfers ?? 1;
  const result = twinStudy(
    squadIds,
    myBank,
    myFt,
    settled.map((r) => ({
      entry: r.entry,
      elements: r.elements,
      counts: r.counts,
      squadCostTenths: r.squadCostTenths,
      bankTenths: r.bankTenths,
      ft: r.eventTransfers,
      rankAt: null,
    })),
    new Map(settled.map((r) => [r.entry, {
      entry: r.entry,
      gwPoints: r.gwPoints,
      captainPoints: 0,
      arm: (r.arm as "transfer" | "hit" | "chip" | "captain" | "hold"),
    }])),
    new Map(),
  );
  if (!result.arms.length) return null;

  const targetName = boot.elements[target]?.web_name ?? `#${target}`;
  const arms = result.arms.map((a) => ({
    arm: a.arm,
    n: a.n,
    mean: a.mean,
    median: a.median,
  }));
  const best = [...arms].sort((a, b) => b.mean - a.mean)[0];
  return {
    component: "twin-study",
    title: "Twin study",
    prose: `Among ${result.n} near-twins of your squad (≥13 shared players, bank within £0.5m), the "${best.arm}" arm averaged ${best.mean.toFixed(1)} points — observational, not causal. Sample ${result.n}, reliability ${result.reliable ? "ok" : "thin"}.`,
    props: { arms, n: result.n, reliable: result.reliable, targetName, note: result.note },
  };
}
