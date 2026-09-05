/**
 * A fixture server that speaks the FPL API.
 *
 * CI used to run the e2e suite against fantasy.premierleague.com, which made
 * the suite a function of the real season: tests went red because a club's
 * fixtures changed, because the calendar advanced past a hardcoded gameweek,
 * or because FPL rate-limited a runner. None of those are regressions, and all
 * of them cost a red build.
 *
 * This serves the recordings in __fixtures__/ instead, on the same paths, so
 * `FPL_API_BASE=http://127.0.0.1:4599/api pnpm start` gives a deterministic
 * app. It is deliberately flag-free: one behaviour, the same every run, so a
 * failure is always the code and never the weather.
 *
 *   node scripts/mock-fpl.mjs
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "__fixtures__");
const read = (n) => JSON.parse(fs.readFileSync(path.join(FIX, n), "utf8"));

const PORT = Number(process.env.MOCK_PORT ?? 4599);

const boot = read("bootstrap.json");
const gw1 = read("fixtures-gw1.json");
const status = read("event-status.json");
const entry = read("entry-1851681.json");
const history = read("history-1851681.json");
const live = read("live-gw1.json");
const summary = read("element-summary-1.json");

/* ───────────────────────────  a league of players  ──────────────────────── */

/**
 * The recording covers two clubs, which is not a league: a market board has
 * nothing to rank, a scatter cannot tell its top fifteen from the whole field,
 * and a percentile cohort is too thin to mean anything. The recorded players
 * are copied across all twenty clubs with jittered season lines so every
 * league-wide surface has a real distribution to draw.
 *
 * The jitter comes from a seeded linear congruential generator, never
 * Math.random: two runs of the suite must see byte-identical players or the
 * fixture server has just reintroduced the flakiness it exists to remove.
 */
{
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const extra = [];
  for (const team of boot.teams.map((t) => t.id)) {
    for (const el of boot.elements.slice(0, 18)) {
      const c = { ...el, id: el.id + team * 1000, team };
      c.minutes = Math.round(200 + rnd() * 1600);
      c.goals_scored = Math.round(rnd() * 6);
      c.assists = Math.round(rnd() * 5);
      c.expected_goals = +(c.goals_scored + (rnd() - 0.5) * 3.5).toFixed(2);
      c.expected_assists = +(c.assists + (rnd() - 0.5) * 3).toFixed(2);
      c.expected_goal_involvements = +(c.expected_goals + c.expected_assists).toFixed(2);
      c.expected_goals_conceded = +(rnd() * 14).toFixed(2);
      c.clean_sheets = Math.round(rnd() * 4);
      c.saves = Math.round(rnd() * 20);
      c.defensive_contribution = Math.round(rnd() * 40);
      c.tackles = Math.round(rnd() * 25);
      c.recoveries = Math.round(rnd() * 60);
      c.clearances_blocks_interceptions = Math.round(rnd() * 40);
      c.total_points = Math.round(rnd() * 60);
      c.bps = Math.round(rnd() * 250);
      c.bonus = Math.round(rnd() * 9);
      c.yellow_cards = Math.round(rnd() * 4);
      c.red_cards = rnd() > 0.9 ? 1 : 0;
      c.own_goals = rnd() > 0.95 ? 1 : 0;
      c.penalties_saved = rnd() > 0.96 ? 1 : 0;
      c.penalties_missed = rnd() > 0.94 ? 1 : 0;
      c.selected_by_percent = +(rnd() * 45).toFixed(1);
      c.transfers_in_event = Math.round(rnd() * 90000);
      c.transfers_out_event = Math.round(rnd() * 90000);
      // the recorded bootstrap is dead flat at zero, so the price ledger and
      // the value trail have no shape without this
      c.cost_change_start = Math.round((rnd() - 0.45) * 9);
      c.cost_change_event = rnd() > 0.82 ? (rnd() > 0.5 ? 1 : -1) : 0;
      // set-piece duty, so the dead-ball ring has something to draw
      c.corners_and_indirect_freekicks_order = rnd() > 0.85 ? 1 : rnd() > 0.7 ? 2 : null;
      c.direct_freekicks_order = rnd() > 0.9 ? 1 : null;
      c.penalties_order = rnd() > 0.93 ? 1 : null;
      c.now_cost = Math.round(40 + rnd() * 90);
      extra.push(c);
    }
  }
  boot.elements = boot.elements.concat(extra);
}

/* ─────────────────────────  a season to plan against  ───────────────────── */

/**
 * The recording is one live gameweek, so on its own there is no calendar: the
 * ticker has nothing to rank, the planner nothing to project over, and the
 * Dixon-Coles fit no finished matches to learn from. Both halves are
 * synthesised by rotating the twenty clubs — deterministic, no randomness, so
 * two runs of the suite see byte-identical fixtures.
 */
const teamIds = boot.teams.map((t) => t.id);
const fixtures = [...gw1];

// Finished rounds behind us, so the strength model has matches to fit.
let pastId = 5000;
for (let gw = -6; gw <= 0; gw++) {
  const rot = [...teamIds.slice((gw + 20) % 20), ...teamIds.slice(0, (gw + 20) % 20)];
  for (let i = 0; i < rot.length; i += 2) {
    fixtures.push({
      ...gw1[0], id: pastId++, code: pastId, event: 1,
      team_h: rot[i], team_a: rot[i + 1],
      team_h_difficulty: 3, team_a_difficulty: 3,
      started: true, finished: true, finished_provisional: true, minutes: 90,
      team_h_score: (i + gw + 12) % 4, team_a_score: (i + gw + 7) % 3,
      kickoff_time: new Date(Date.UTC(2026, 6, 1) + (gw + 8) * 7 * 86_400_000).toISOString(),
      stats: [],
    });
  }
}

// Gameweeks ahead, with one blank and one double so the chip and calendar
// surfaces have both shapes to read.
let nextId = 1000;
for (let gw = 2; gw <= 8; gw++) {
  const rot = [...teamIds.slice(gw % 20), ...teamIds.slice(0, gw % 20)];
  for (let i = 0; i < rot.length; i += 2) {
    if (gw === 5 && i === 0) continue; // a blank for two clubs
    fixtures.push({
      ...gw1[0], id: nextId++, code: nextId, event: gw,
      team_h: rot[i], team_a: rot[i + 1],
      team_h_difficulty: 1 + ((gw + i) % 5),
      team_a_difficulty: 1 + ((gw + i + 2) % 5),
      started: false, finished: false, finished_provisional: false,
      minutes: 0, team_h_score: null, team_a_score: null, stats: [],
    });
  }
  if (gw === 6) {
    fixtures.push({
      ...gw1[0], id: nextId++, code: nextId, event: 6,
      team_h: rot[0], team_a: rot[3],
      team_h_difficulty: 2, team_a_difficulty: 3,
      started: false, finished: false, finished_provisional: false,
      minutes: 0, team_h_score: null, team_a_score: null, stats: [],
    });
  }
}

/* ──────────────────────────────  a legal XI  ────────────────────────────── */

/** 2 GK, 5 DEF, 5 MID, 3 FWD in slot order, captain on the first pick. */
function buildPicks() {
  const need = { 1: 2, 2: 5, 3: 5, 4: 3 };
  const chosen = [];
  for (const pos of [1, 2, 3, 4]) {
    for (const el of boot.elements) {
      if (el.element_type !== pos || need[pos] === 0) continue;
      // The recording covers two clubs, so the three-per-club rule is relaxed
      // here; planner.ts enforces it and its unit tests cover it properly.
      need[pos]--;
      chosen.push(el);
    }
  }
  const order = [
    ...chosen.filter((e) => e.element_type === 1).slice(0, 1),
    ...chosen.filter((e) => e.element_type === 2).slice(0, 4),
    ...chosen.filter((e) => e.element_type === 3).slice(0, 4),
    ...chosen.filter((e) => e.element_type === 4).slice(0, 2),
  ];
  const bench = chosen.filter((e) => !order.includes(e));
  const all = [...order, ...bench];
  return {
    active_chip: null,
    automatic_subs: [],
    entry_history: {
      event: 1, points: 60, total_points: 60, rank: 1, rank_sort: 1,
      overall_rank: 500000, bank: 15, value: 1000,
      event_transfers: 0, event_transfers_cost: 0, points_on_bench: 5,
    },
    picks: all.map((el, i) => ({
      element: el.id,
      position: i + 1,
      multiplier: i === 0 ? 2 : i < 11 ? 1 : 0,
      is_captain: i === 0,
      is_vice_captain: i === 1,
      selling_price: el.now_cost,
      purchase_price: el.now_cost,
    })),
  };
}

const picks = buildPicks();

/* ────────────────────────────────  routes  ──────────────────────────────── */

const json = (res, body, code = 200) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const notFound = (res) => json(res, { detail: "Not found." }, 404);

/** A mini-league big enough to average, rank and scatter. */
function standings(leagueId, page) {
  const TOTAL = 137;
  const start = (page - 1) * 50;
  const results = [];
  for (let i = start; i < Math.min(start + 50, TOTAL); i++) {
    const rank = i + 1;
    results.push({
      id: 900000 + rank,
      event_total: 83 - Math.round((i / TOTAL) * 35),
      player_name: `Manager ${rank}`,
      rank, last_rank: rank + (rank % 3) - 1, rank_sort: rank,
      total: 1200 - i * 6,
      entry: rank === 3 ? 1851681 : 700000 + rank,
      entry_name: rank === 3 ? "GP The Great FC" : `Team ${rank}`,
      has_played: true,
    });
  }
  return {
    league: {
      id: leagueId, name: "Livin Saliba Loca", created: "2026-07-01T00:00:00Z",
      closed: false, max_entries: null, league_type: "x", scoring: "c",
      admin_entry: null, start_event: 1, code_privacy: "p",
      has_cup: false, cup_league: null, rank: null,
    },
    new_entries: { has_next: false, page: 1, results: [] },
    standings: { has_next: start + 50 < TOTAL, page, results },
    last_updated_data: null,
  };
}

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  if (url === "/api/bootstrap-static/") return json(res, boot);
  if (url === "/api/fixtures/") return json(res, fixtures);
  if (url === "/api/event-status/") return json(res, status);
  if (/^\/api\/element-summary\/\d+\/$/.test(url)) return json(res, summary);
  if (/^\/api\/entry\/\d+\/transfers\/$/.test(url)) return json(res, []);
  if (/^\/api\/event\/\d+\/live\/$/.test(url)) return json(res, live);

  // The real API 404s an id nobody owns, and the gate's error copy depends on
  // getting a 404 rather than an empty body.
  const entryMatch = /^\/api\/entry\/(\d+)\/$/.exec(url);
  if (entryMatch) {
    return Number(entryMatch[1]) > 9_999_999 ? notFound(res) : json(res, entry);
  }
  if (/^\/api\/entry\/\d+\/history\/$/.test(url)) return json(res, history);

  if (/^\/api\/entry\/\d+\/event\/\d+\/picks\/$/.test(url)) {
    const id = Number(/\/entry\/(\d+)\//.exec(url)[1]);
    // 28333 resolves as an entry but has no picks — a manager who joined after
    // this gameweek. The compare failure paths need both flavours of 404.
    if (id === 28333 || id > 9_999_999) return notFound(res);
    // 4242 fields a partly different XI, so a compare is a real intersection
    // rather than fifteen out of fifteen.
    if (id === 4242) {
      const taken = new Set(picks.picks.map((p) => p.element));
      const spare = boot.elements.map((e) => e.id).filter((x) => !taken.has(x));
      let next = 0;
      return json(res, {
        ...picks,
        entry_history: { ...picks.entry_history, event_transfers_cost: 4 },
        picks: picks.picks.map((p, i) =>
          i % 3 === 0 && next < spare.length ? { ...p, element: spare[next++] } : p,
        ),
      });
    }
    return json(res, picks);
  }

  const league = /^\/api\/leagues-classic\/(\d+)\/standings\/?$/.exec(url);
  if (league) {
    const page = Number(new URL(req.url, "http://x").searchParams.get("page_standings") || 1);
    return json(res, standings(Number(league[1]), page));
  }

  console.log("mock-fpl MISS", url);
  return json(res, { detail: "not found", url }, 404);
});

server.listen(PORT, () => {
  console.log(`mock FPL on http://127.0.0.1:${PORT}/api — ${boot.elements.length} players, ${fixtures.length} fixtures`);
});
