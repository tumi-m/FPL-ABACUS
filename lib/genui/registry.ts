/**
 * GenUI registry (v2 §9) — the model selects components from this list and
 * may fill selection parameters ONLY. Every rendered number is resolved
 * server-side from our engines by lib/genui/resolve.ts. Nothing else passes.
 */
import { z } from "zod";

export const ParamSchemas = {
  playerName: z.string().min(2).max(40),
  query: z.string().min(2).max(120),
  direction: z.enum(["rise", "fall", "any"]).default("any"),
  horizonGws: z.number().int().min(1).max(38).default(5),
} as const;

export interface GenUIComponent {
  key: string;
  title: string;
  /** What the resolver grounds it with — documentation of the data path. */
  engine: string;
  params?: z.ZodTypeAny;
}

export const REGISTRY: Record<string, GenUIComponent> = {
  "captain-compare": {
    key: "captain-compare",
    title: "Captaincy board",
    engine: "bootstrapLite ep_next × effective ownership",
    params: ParamSchemas.playerName.optional(),
  },
  "exposure-scatter": {
    key: "exposure-scatter",
    title: "Where am I exposed?",
    engine: "matchdayModel squad EO vs your multiplier",
  },
  "price-gauge": {
    key: "price-gauge",
    title: "Price watch",
    engine: "element transfer pressure → PriceGauge",
    params: ParamSchemas.playerName.optional(),
  },
  "fixture-run": {
    key: "fixture-run",
    title: "Fixture swing",
    engine: "fixtureModel rolling windows per 90",
    params: ParamSchemas.playerName.optional(),
  },
  "defcon-check": {
    key: "defcon-check",
    title: "DEFCON tracker",
    engine: "live defcon events vs bonus threshold",
    params: ParamSchemas.playerName.optional(),
  },
  "xg-vs-actual": {
    key: "xg-vs-actual",
    title: "Due or finished?",
    engine: "element-summary history cumulative xGI vs returns",
    params: ParamSchemas.playerName,
  },
  "rank-projection": {
    key: "rank-projection",
    title: "Rank outlook",
    engine: "field score distribution vs your live score",
  },
  "swing-impact": {
    key: "swing-impact",
    title: "Rank impact by event",
    engine: "matchdayModel swings reconciled to rank delta",
  },
  "chip-timeline": {
    key: "chip-timeline",
    title: "Chip timeline",
    engine: "entry history chips on a GW lane",
  },
  "injury-list": {
    key: "injury-list",
    title: "Availability desk",
    engine: "squad status/news + FPL chance-of-playing",
  },
  "news-search": {
    key: "news-search",
    title: "Newsdesk search",
    engine: "tagged news_item table ranked by relevance",
    params: ParamSchemas.query.optional(),
  },
  "transfer-sim": {
    key: "transfer-sim",
    title: "Transfer simulation",
    engine: "ep_next delta payback vs −4 hit",
    params: z.object({ out: ParamSchemas.playerName.optional(), in: ParamSchemas.playerName.optional() }).optional(),
  },
  "effective-bets": {
    key: "effective-bets",
    title: "Effective bets",
    engine: "Dixon–Coles copula sims → participation ratio of squad Σ (v3-4/5)",
  },
  "true-form": {
    key: "true-form",
    title: "True form",
    engine: "Kalman local-level filter over per-90 contribution with cameo discount (v3-6)",
    params: ParamSchemas.playerName,
  },
  "squad-generator": {
    key: "squad-generator",
    title: "Squad builder",
    engine:
      "deterministic greedy optimiser over bootstrap + projections under full FPL constraints (v5-D); model sets strategy params only",
    params: z
      .object({
        budgetTenths: z.number().int().min(700).max(1000).optional(),
        risk: z.enum(["safe", "balanced", "differential"]).optional(),
      })
      .optional(),
  },
  "transfer-watch": {
    key: "transfer-watch",
    title: "Transfer watch",
    engine: "squad ranked by ep_next vs price band; flags weakest links",
  },
  "chip-timing": {
    key: "chip-timing",
    title: "Chip timing",
    engine: "Snell envelope over remaining gameweeks on a fixture-ease payoff curve (v3-15)",
  },
  review: {
    key: "review",
    title: "Gameweek review",
    engine: "matchdayModel facts composed into template prose — hero, swings, regret",
  },
  crowding: {
    key: "crowding",
    title: "Crowding",
    engine:
      "per-position ownership concentration → HHI, effective picks (1/HHI), entropy (v3-18)",
  },
  wpa: {
    key: "wpa",
    title: "Win probability added",
    engine:
      "paired Dixon–Coles copula sim of your XI vs a league rival → leave-one-out win-prob swings (v3-19); model sets the rival entry only",
    params: z.object({ rivalEntry: z.number().int().min(1).max(99_999_999).optional() }).optional(),
  },
  "twin-study": {
    key: "twin-study",
    title: "Twin study",
    engine:
      "cohort pairing (≥13/15 overlap, ±£0.5m bank) over sampled squads, partitioned by decision arm; observational (v3-10)",
    params: ParamSchemas.playerName.optional(),
  },
};

export const COMPONENT_KEYS = Object.keys(REGISTRY);

export function isValidComponent(key: unknown): key is keyof typeof REGISTRY & string {
  return typeof key === "string" && key in REGISTRY;
}

/** Validate model-supplied params against the registry; strips unknown keys. */
export function coerceParams(key: string, raw: unknown): Record<string, unknown> | null {
  const def = REGISTRY[key];
  if (!def?.params) return {};
  const parsed = def.params.safeParse(raw);
  return parsed.success ? (parsed.data as Record<string, unknown>) : null;
}
