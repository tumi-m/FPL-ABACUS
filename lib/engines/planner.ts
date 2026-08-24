/**
 * planner — the transfer desk's rule engine.
 *
 * Everything the planner refuses to let you do lives here as a pure function:
 * the official squad rules (like for like, £ you actually have, three per
 * club), the chain collapse that keeps a staged plan honest when you move the
 * same slot twice, and the horizon arithmetic the pitch and the market table
 * both read from. No React, no fetching — the UI only renders what these
 * return.
 */

export type PlannerPos = 1 | 2 | 3 | 4;

export interface PlannerPlayer {
  id: number;
  /** Display name (FPL's web_name). */
  name: string;
  pos: number;
  /** Club id. */
  team: number;
  /** Club three-letter code — never the sole encoder, always beside a colour. */
  code: string;
  /** Price in tenths of a million. */
  cost: number;
  photo: string;
  form: number;
  ppg: number;
  points: number;
  /** Ownership share, percent. */
  owned: number;
  minutes: number;
  status: string;
  news: string;
  /** Projected points per horizon gameweek — blanks zero, doubles stacked. */
  horizon: number[];
  /** Tenths moved this gameweek / since the season opened. */
  costChangeEvent: number;
  costChangeStart: number;
  /** Net transfers this gameweek (in − out). */
  netTransfers: number;
}

/* ── Shared shapes ─────────────────────────────────────────────────────────
   The pitch, the market table and the ticker all read these, so they live
   beside the rules rather than inside a server-only module. */

/** One club-gameweek: who they play, where, and how hard FPL rates it. */
export interface TickerCell {
  opp: string;
  oppId: number;
  home: boolean;
  fdr: number;
}

export interface PlannerClub {
  id: number;
  code: string;
  name: string;
  crestCode: number;
}

export interface PlannerGw {
  id: number;
  /** Short deadline label, e.g. "28 Aug". */
  deadline: string;
  /** Clubs playing twice / not at all that week. */
  doubles: number;
  blanks: number;
}

export interface PlannerSquadSlot {
  element: number;
  /** FPL pick position, 1–11 starters then 12–15 bench in order. */
  slot: number;
  /** Selling price in tenths — what FPL would actually credit you. */
  sellPrice: number;
  isCaptain: boolean;
  isVice: boolean;
}

/** club id → gw id → the fixtures that club plays that week (empty = blank). */
export type Ticker = Record<number, Record<number, TickerCell[]>>;

export interface FixtureRow {
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
}

/**
 * Turn the season fixture list into the club × gameweek grid the whole planner
 * reads. Every club gets an entry for every gameweek in the window, so a blank
 * is an empty array rather than a missing key — the UI never has to guess
 * whether it is looking at "no fixture" or "no data".
 */
export function buildTicker(
  fixtures: FixtureRow[],
  clubs: PlannerClub[],
  gws: number[],
): Ticker {
  const codeOf = new Map(clubs.map((c) => [c.id, c.code]));
  const ticker: Ticker = {};
  for (const club of clubs) {
    ticker[club.id] = {};
    for (const gw of gws) ticker[club.id][gw] = [];
  }
  for (const f of fixtures) {
    if (f.event == null) continue;
    const home = ticker[f.team_h]?.[f.event];
    const away = ticker[f.team_a]?.[f.event];
    if (home) {
      home.push({ opp: codeOf.get(f.team_a) ?? "?", oppId: f.team_a, home: true, fdr: f.team_h_difficulty });
    }
    if (away) {
      away.push({ opp: codeOf.get(f.team_h) ?? "?", oppId: f.team_h, home: false, fdr: f.team_a_difficulty });
    }
  }
  return ticker;
}

/** Easiness score for a club-gameweek: doubles add up, blanks score nothing. */
export function runScore(cells: TickerCell[]): number {
  let total = 0;
  for (const c of cells) total += 6 - c.fdr;
  return total;
}

/** FPL difficulty 1..5 → the six-step heat ramp, easiest fixture hottest. */
export function fdrHeatStep(fdr: number): number {
  switch (fdr) {
    case 1:
      return 6;
    case 2:
      return 5;
    case 3:
      return 3;
    case 4:
      return 2;
    default:
      return 1;
  }
}

export interface PlanMove {
  out: number;
  in: number;
}

export const POS_LABEL: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
export const POS_NAME: Record<number, string> = {
  1: "Goalkeeper",
  2: "Defender",
  3: "Midfielder",
  4: "Forward",
};

/** Squad rule: never more than three players from one club. */
export const MAX_PER_CLUB = 3;
export const HIT_COST = 4;

/** Points over the first `weeks` gameweeks of a horizon array. */
export function windowPoints(horizon: number[] | undefined, weeks: number): number {
  if (!horizon || horizon.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < Math.min(weeks, horizon.length); i++) total += horizon[i];
  return Math.round(total * 10) / 10;
}

/** The fifteen ids you would own if every staged move went through. */
export function applyMoves(base: number[], moves: PlanMove[]): number[] {
  const ids = [...base];
  for (const m of moves) {
    const at = ids.indexOf(m.out);
    if (at >= 0) ids[at] = m.in;
  }
  return ids;
}

/**
 * Stage one swap onto an existing plan, collapsing chains.
 *
 * Selling a player you only bought in this same plan is not a second
 * transfer — it rewrites the first one. Moving him back to whoever he
 * replaced cancels that transfer outright. Without this the ledger would
 * charge you hits for moves you never actually make.
 */
export function stageMove(moves: PlanMove[], outId: number, inId: number): PlanMove[] {
  if (outId === inId) return moves;
  const chained = moves.findIndex((m) => m.in === outId);
  if (chained >= 0) {
    const origin = moves[chained].out;
    if (origin === inId) return moves.filter((_, i) => i !== chained);
    return moves.map((m, i) => (i === chained ? { out: origin, in: inId } : m));
  }
  if (moves.some((m) => m.out === outId)) return moves;
  return [...moves, { out: outId, in: inId }];
}

/** Bank left (tenths) once every staged move is paid for. */
export function bankAfter(
  bankTenths: number,
  moves: PlanMove[],
  sellPriceOf: (id: number) => number,
  costOf: (id: number) => number,
): number {
  let bank = bankTenths;
  for (const m of moves) bank += sellPriceOf(m.out) - costOf(m.in);
  return bank;
}

export interface SwapCheck {
  ok: boolean;
  /** Why not, in the words the desk shows the user. */
  reason?: string;
}

export interface SwapContext {
  /** Ids currently in the working squad (moves already applied). */
  squadIds: number[];
  bankTenths: number;
  playerOf: (id: number) => PlannerPlayer | undefined;
  sellPriceOf: (id: number) => number;
}

/** Every official reason a swap is illegal, checked in the order a manager meets them. */
export function checkSwap(outId: number, inId: number, ctx: SwapContext): SwapCheck {
  const out = ctx.playerOf(outId);
  const incoming = ctx.playerOf(inId);
  if (!out || !incoming) return { ok: false, reason: "Unknown player" };
  if (outId === inId) return { ok: false, reason: "Already in your squad" };
  if (ctx.squadIds.includes(inId)) return { ok: false, reason: "Already in your squad" };
  if (out.pos !== incoming.pos) {
    return { ok: false, reason: `${POS_NAME[incoming.pos]} can't replace a ${POS_NAME[out.pos]?.toLowerCase()}` };
  }
  const budget = ctx.bankTenths + ctx.sellPriceOf(outId);
  if (incoming.cost > budget) {
    return { ok: false, reason: `£${((incoming.cost - budget) / 10).toFixed(1)}m short` };
  }
  if (incoming.team !== out.team) {
    let fromClub = 0;
    for (const id of ctx.squadIds) {
      if (id === outId) continue;
      if (ctx.playerOf(id)?.team === incoming.team) fromClub++;
    }
    if (fromClub >= MAX_PER_CLUB) {
      return { ok: false, reason: `Already 3 from ${incoming.code}` };
    }
  }
  return { ok: true };
}

export interface PlanSummary {
  transfers: number;
  hits: number;
  hitCost: number;
  /** Projected points the moves add over the window, before the hit. */
  gross: number;
  /** Gross minus the hit — what the plan is actually worth. */
  net: number;
  bankTenths: number;
}

export function summarisePlan(
  moves: PlanMove[],
  opts: {
    freeTransfers: number;
    weeks: number;
    bankTenths: number;
    playerOf: (id: number) => PlannerPlayer | undefined;
    sellPriceOf: (id: number) => number;
  },
): PlanSummary {
  const hits = Math.max(0, moves.length - opts.freeTransfers);
  let gross = 0;
  for (const m of moves) {
    const out = opts.playerOf(m.out);
    const incoming = opts.playerOf(m.in);
    gross += windowPoints(incoming?.horizon, opts.weeks) - windowPoints(out?.horizon, opts.weeks);
  }
  gross = Math.round(gross * 10) / 10;
  const hitCost = hits * HIT_COST;
  return {
    transfers: moves.length,
    hits,
    hitCost,
    gross,
    net: Math.round((gross - hitCost) * 10) / 10,
    bankTenths: bankAfter(
      opts.bankTenths,
      moves,
      opts.sellPriceOf,
      (id) => opts.playerOf(id)?.cost ?? 0,
    ),
  };
}

export type SortKey =
  | "projected"
  | "price-high"
  | "price-low"
  | "form"
  | "points"
  | "owned"
  | "value";

export const SORTS: { key: SortKey; label: string }[] = [
  { key: "projected", label: "Projected points" },
  { key: "points", label: "Season points" },
  { key: "form", label: "Form" },
  { key: "value", label: "Points per £m" },
  { key: "owned", label: "Ownership" },
  { key: "price-high", label: "Price: high to low" },
  { key: "price-low", label: "Price: low to high" },
];

export interface MarketFilter {
  search: string;
  pos: number | null;
  team: number | null;
  maxCost: number | null;
  /** Budget in tenths when "affordable only" is on; null leaves everything in. */
  affordableWithin: number | null;
  sort: SortKey;
  weeks: number;
  /** Ids already owned — kept out of the market list. */
  exclude: Set<number>;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** The market table's one pass: filter, then order. */
export function filterMarket(players: PlannerPlayer[], f: MarketFilter): PlannerPlayer[] {
  const q = norm(f.search.trim());
  const rows = players.filter((p) => {
    if (f.exclude.has(p.id)) return false;
    if (f.pos != null && p.pos !== f.pos) return false;
    if (f.team != null && p.team !== f.team) return false;
    if (f.maxCost != null && p.cost > f.maxCost) return false;
    if (f.affordableWithin != null && p.cost > f.affordableWithin) return false;
    if (q && !norm(p.name).includes(q) && !norm(p.code).includes(q)) return false;
    return true;
  });
  const proj = (p: PlannerPlayer) => windowPoints(p.horizon, f.weeks);
  rows.sort((a, b) => {
    switch (f.sort) {
      case "price-high":
        return b.cost - a.cost || proj(b) - proj(a);
      case "price-low":
        return a.cost - b.cost || proj(b) - proj(a);
      case "form":
        return b.form - a.form || proj(b) - proj(a);
      case "points":
        return b.points - a.points || proj(b) - proj(a);
      case "owned":
        return b.owned - a.owned || proj(b) - proj(a);
      case "value":
        return b.points / Math.max(1, b.cost) - a.points / Math.max(1, a.cost);
      default:
        return proj(b) - proj(a) || b.points - a.points;
    }
  });
  return rows;
}

/**
 * Price-move pressure from the public bootstrap alone.
 *
 * The stored-snapshot model in `lib/engines/price.ts` is the honest one, but
 * it needs a database behind it. This is the fallback every visitor can see:
 * net transfers this gameweek against the rough number of net moves a price
 * change takes, signed so falls read as negative progress. It is an estimate
 * and the UI labels it as one.
 */
export const PRICE_MOVE_TRANSFERS = 180_000;

export interface PriceOutlook {
  direction: "up" | "down" | "flat";
  /** Signed share of the way to the next change, clamped to ±1.5. */
  progress: number;
  /** Already moved this gameweek? Then a second move is very unlikely. */
  movedThisGw: boolean;
  label: string;
}

export function priceOutlook(p: {
  netTransfers: number;
  costChangeEvent: number;
}): PriceOutlook {
  const progress = Math.max(-1.5, Math.min(1.5, p.netTransfers / PRICE_MOVE_TRANSFERS));
  const movedThisGw = p.costChangeEvent !== 0;
  const direction = progress > 0.02 ? "up" : progress < -0.02 ? "down" : "flat";
  let label: string;
  if (movedThisGw) label = p.costChangeEvent > 0 ? "Rose this GW" : "Fell this GW";
  else if (Math.abs(progress) >= 0.92) label = direction === "up" ? "Rise tonight" : "Fall tonight";
  else if (Math.abs(progress) >= 0.6) label = direction === "up" ? "Rising fast" : "Falling fast";
  else if (Math.abs(progress) >= 0.25) label = direction === "up" ? "Drifting up" : "Drifting down";
  else label = "Unlikely to change";
  return { direction, progress, movedThisGw, label };
}

/**
 * Six-step heat index for a projected-points cell, 1 (coldest) to 6.
 * Cuts come from the population on screen so the ramp always uses its
 * full range rather than bunching in the middle.
 */
export function heatIndex(value: number, cuts: number[]): number {
  let step = 1;
  for (const c of cuts) if (value >= c) step++;
  return Math.min(6, step);
}

/** Even quantile cut points over a value population (k−1 cuts for k steps). */
export function heatCuts(values: number[], k = 6): number[] {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const cuts: number[] = [];
  for (let i = 1; i < k; i++) {
    const at = (sorted.length - 1) * (i / k);
    const lo = Math.floor(at);
    const hi = Math.ceil(at);
    cuts.push(sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo));
  }
  return cuts;
}
