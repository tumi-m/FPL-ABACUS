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
