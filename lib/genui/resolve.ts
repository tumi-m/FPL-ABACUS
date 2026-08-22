import "server-only";

/**
 * Resolver — the ONLY place where genUI cards get numbers. Given a routed
 * component + params + entry context it produces props for the client
 * renderer from cached upstream data and our engines. The model never
 * supplies values; unknown names degrade gracefully (nulls, not guesses).
 */
import { getBootstrapLite, type ElementLite } from "@/lib/fpl/bootstrapLite";
import { getElementSummary, getFixturesAll, getHistory, getPicks } from "@/lib/fpl/endpoints";
import { buildFixtureModel, easiness, projectFixture } from "@/lib/engines/fixtureModel";
import { fitDixonColes, type DcMatch } from "@/lib/quant/strength";
import { simulateWeb, type WebPlayer } from "@/lib/quant/correlationWeb";
import { trueForm } from "@/lib/quant/estimators";
import { recentItems } from "@/lib/news/store";
import { hasDb } from "@/lib/env";
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
      return priceGauge(params);
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

async function priceGauge(params: Record<string, unknown>): Promise<ResolvedCard | null> {
  const boot = await getBootstrapLite();
  const el =
    findElement(boot, params.playerName) ??
    [...Object.values(boot.elements)].sort(
      (a, b) =>
        b.transfersInEvent - b.transfersOutEvent - (a.transfersInEvent - a.transfersOutEvent),
    )[0];
  if (!el) return null;
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
    note: "Velocity history needs more price snapshots.",
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
  const boot = await getBootstrapLite();
  const squadIds = await squadIdsFor(ctx);
  if (!squadIds.length) return null;

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

  // Next fixture per squad player.
  const webPlayers: WebPlayer[] = [];
  const webFixtures: { elementId: number; homeTeam: number; awayTeam: number; isHome: boolean }[] = [];
  for (const id of squadIds.slice(0, 11)) {
    const el = boot.elements[id];
    if (!el) continue;
    const fx = fixtures.find(
      (f) => f.event === ctx.currentGw && (f.team_h === el.team || f.team_a === el.team),
    );
    if (!fx) continue;
    const isHome = fx.team_h === el.team;
    const teamGoals = fit.mu + fit.gamma; // rough home-weighted baseline for share normalisation
    void teamGoals;
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
    webFixtures.push({ elementId: id, homeTeam: fx.team_h, awayTeam: fx.team_a, isHome });
  }
  if (webPlayers.length < 3) return null;

  const web = simulateWeb(webPlayers, webFixtures, fit, undefined, { M: 800, seed: 2026 });
  const bets = web.effectiveBets;
  return {
    component: "effective-bets",
    title: "Effective bets",
    prose: `Your XI behaves like ${bets.toFixed(1)} independent bets across ${webPlayers.length} players — stacking correlates outcomes and swings variance.`,
    props: {
      value: bets / webPlayers.length,
      label: "Effective bets",
      hint: `${bets.toFixed(1)} / ${webPlayers.length}`,
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
