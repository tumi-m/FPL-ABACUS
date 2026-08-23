/**
 * Intent router (v2 §9) — deterministic question → component mapping.
 * Router-first: the model is only consulted when nothing matches here, and
 * even then its answer must name a registry component. Zero model calls for
 * the shapes below; vitest pins the big three (captaincy/price/hit).
 */

export interface RouteResult {
  intent: string;
  component: string;
  /** Extracted hints the resolver may use (names, directions). */
  params: Record<string, unknown>;
  score: number;
}

interface Shape {
  intent: string;
  component: string;
  patterns: RegExp[];
  extract?: (q: string) => Record<string, unknown>;
}

const DIRECTION = () => {
  const rise = /\b(rise|ris(e|ing)|up|increase|going up|tonight)\b/i;
  return (q: string): Record<string, unknown> =>
    rise.test(q) ? { direction: "rise" } : {};
};

function quotedOrCaps(q: string): string | null {
  const quoted = q.match(/["“']([\p{L}\-. ']{2,40})["”']/u);
  if (quoted) return quoted[1].trim();
  return null;
}

const STOP_TAIL = new Set([
  "or", "and", "to", "for", "if", "the", "a", "an", "in", "out", "is", "now",
  "this", "next", "week", "gw", "tonight", "today", "over", "vs",
]);

/** Best-effort player-name extraction: "should I captain salah" → "salah". */
export function extractPlayerName(q: string): string | null {
  const explicit = quotedOrCaps(q);
  if (explicit) return explicit;
  const m = q.match(
    /(?:captain|cap|armlink|sell|buy|sign|transfer in|bring in|get|watch|start|play)\s+((?:[a-z]\.\s)?[\p{L}][\p{L}'\-]+(?:\s+[\p{L}'\-]+)?)/iu,
  );
  if (!m) return null;
  const words = m[1].trim().split(/\s+/);
  // drop trailing filler the greedy match swallowed
  while (words.length > 1 && STOP_TAIL.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  const name = words.join(" ").trim();
  if (!name || STOP_TAIL.has(name.toLowerCase())) return null;
  return name;
}

const SHAPES: Shape[] = [
  // ── v5-D assistant intents — more specific, so they sort first ──────────
  {
    intent: "squad.generate",
    component: "squad-generator",
    patterns: [
      /\b(build|generate|make|create|pick|draft)\b.*\b(squad|team|wildcard)\b/i,
      /\bwildcard (team|squad|picks)\b/i,
      /\bwhat (team|squad) should i\b/i,
      /\boptimi[sz]e my squad\b/i,
    ],
    extract: (q) => ({
      risk: /\bdifferential|bold|risky\b/i.test(q)
        ? "differential"
        : /\bsafe|template|reliable\b/i.test(q)
          ? "safe"
          : "balanced",
    }),
  },
  {
    intent: "transfer.watch",
    component: "transfer-watch",
    patterns: [
      /\bwho should i (sell|offload)\b/i, /\bweakest\b/i, /\bwho to (offload|move out|ship out)\b/i,
      /\bsquad weaknesses?\b/i, /\bbest transfer targets?\b/i,
    ],
  },
  {
    intent: "chip.timing",
    component: "chip-timing",
    patterns: [
      /\bwhen should i (play|use)\b/i, /\bbest week for (my )?(wildcard|free ?hit|bench boost|bb|tc)\b/i,
      /\bchips? timing\b/i,
    ],
    extract: (q) => ({ query: q.slice(0, 120) }),
  },
  // ── captaincy ────────────────────────────────────────────────────────────
  {
    intent: "captain.pick",
    component: "captain-compare",
    patterns: [
      /\bcaptain\b/i, /\barmband\b/i, /\bwho.*(c|skipper)\b.*\?/i, /\bskipper\b/i,
      /\btriple captain\b/i, /\barmband (on|to)\b/i,
    ],
    extract: (q) => {
      const playerName = extractPlayerName(q);
      return playerName ? { playerName } : {};
    },
  },
  // ── price ────────────────────────────────────────────────────────────────
  {
    intent: "price.change",
    component: "price-gauge",
    patterns: [
      /\bprice\b/i, /\brise tonight\b/i, /\bwill .* (rise|fall|drop)\b/i, /\bprice change\b/i,
      /\bin price\b/i, /\bvalue (rising|falling)\b/i, /\bprice pressure\b/i,
    ],
    extract: (q) => ({ ...DIRECTION()(q), ...(extractPlayerName(q) ? { playerName: extractPlayerName(q) } : {}) }),
  },
  // ── hits & transfers ────────────────────────────────────────────────────
  {
    intent: "hit.cost",
    component: "transfer-sim",
    patterns: [
      /\b(take|taking|worth|cost)\b[^?]*\bhit\b/i, /\b-?4 ?(pt|point)?s?\b/i, /\b−4\b/,
      /\btake a hit\b/i, /\bhow many hit/i, /\bfree transfer/i, /\broll(ing)? (my )?(ft|transfer)/i,
      /\btransfer (out|in)\b/i, /\bshould i (sell|swap|move out)\b/i,
    ],
    extract: (q) => {
      const outM = q.match(/(?:sell|move out|transfer out|off)\s+([\p{L}'\-]+(?:\s[\p{L}'\-]+)?)/iu);
      const inM = q.match(/(?:buy|bring in|transfer in|get|for)\s+([\p{L}'\-]+(?:\s[\p{L}'\-]+)?)/iu);
      return {
        ...(outM ? { out: outM[1] } : {}),
        ...(inM ? { in: inM[1] } : {}),
      };
    },
  },
  // ── fixtures ─────────────────────────────────────────────────────────────
  {
    intent: "fixture.run",
    component: "fixture-run",
    patterns: [
      /\bfixtures?\b/i, /\bfixture run\b/i, /\beasy (run|fixtures)\b/i, /\bhard (run|fixtures)\b/i,
      /\bwhen do .* fixtures turn\b/i, /\bdoubles?\b/i, /\bblank(s)?\b/i,
    ],
    extract: (q) => {
      const playerName = extractPlayerName(q);
      return playerName ? { playerName } : {};
    },
  },
  // ── defcon / bonus ───────────────────────────────────────────────────────
  {
    intent: "defcon.check",
    component: "defcon-check",
    patterns: [
      /\bdefcon\b/i, /\bbonus point/i, /\bbps\b/i, /\bdefensive contribution/i, /\bdoes he hit 10\b/i,
    ],
    extract: (q) => {
      const playerName = extractPlayerName(q);
      return playerName ? { playerName } : {};
    },
  },
  // ── underlying numbers ───────────────────────────────────────────────────
  {
    intent: "xg.compare",
    component: "xg-vs-actual",
    patterns: [
      /\bxg\b/i, /\bxgi\b/i, /\bdue\b/i, /\bunderlying\b/i, /\bfinishing\b/i, /\boverperform/i,
      /\bunderperform/i, /\blucky|unlucky\b/i,
    ],
    extract: (q) => {
      const playerName = extractPlayerName(q);
      return playerName ? { playerName } : {};
    },
  },
  // ── rank outlook ─────────────────────────────────────────────────────────
  {
    intent: "rank.project",
    component: "rank-projection",
    patterns: [
      /\brank\b/i, /\bor\b/i, /\bfinish\b/i, /\btop ?10k\b/i, /\bprojection\b/i,
      /\bwhere (will|am) i\b/i, /\boverall\b/i,
    ],
  },
  // ── live swing ───────────────────────────────────────────────────────────
  {
    intent: "swing.impact",
    component: "swing-impact",
    patterns: [/\bswing\b/i, /\brank impact\b/i, /\bgained|ranks?\b.*event/i, /\bmoved me\b/i],
  },
  // ── exposure ─────────────────────────────────────────────────────────────
  {
    intent: "exposure.check",
    component: "exposure-scatter",
    patterns: [/\bexposure\b/i, /\btemplate overlap\b/i, /\beffective ownership\b/i, /\beo\b/i, /\bdifferential/i],
  },
  // ── chips ────────────────────────────────────────────────────────────────
  {
    intent: "chip.when",
    component: "chip-timeline",
    patterns: [/\bwildcard\b/i, /\bfree ?hit\b/i, /\bbench boost\b/i, /\bchips?\b/i, /\bwhen.*play.*chip/i],
  },
  // ── availability ─────────────────────────────────────────────────────────
  {
    intent: "injury.list",
    component: "injury-list",
    patterns: [
      /\binjur/i, /\binjured\b/i, /\bdoubt/i, /\bfit(ness)?\b/i, /\bchance of playing\b/i,
      /\bflagged\b/i, /\bbench (him|them)\b/i, /\bout\b.*\bweek\b/i,
    ],
    extract: (q) => {
      const playerName = extractPlayerName(q);
      return playerName ? { playerName } : {};
    },
  },
  // ── news ─────────────────────────────────────────────────────────────────
  {
    intent: "news.search",
    component: "news-search",
    patterns: [/\bnews\b/i, /\blatest\b/i, /\brumour/i, /\bgossip\b/i, /\bwhat.s happening\b/i, /\bpaper ?talk/i],
    extract: (q) => ({ query: q.slice(0, 120) }),
  },
  {
    intent: "gw.review",
    component: "review",
    patterns: [
      /\bhow did i do\b/i, /\breview my (gameweek|week|gw)\b/i, /\bsummarise my gameweek\b/i,
      /\bwhat happened (to me |last week)\b/i,
    ],
  },
  // ── v3 Q5 extras: the market lens ───────────────────────────────────────
  {
    intent: "market.crowding",
    component: "crowding",
    patterns: [
      /\bcrowding\b/i, /\bwhere (is|'s) (the )?(alpha|edge)\b/i,
      /\btemplate or differential\b/i, /\beffective picks\b/i, /\bhow crowded\b/i,
    ],
  },
  {
    intent: "market.wpa",
    component: "wpa",
    patterns: [
      /\bwin prob(ability)?\b/i, /\bwpa\b/i, /\bhead.?to.?head\b/i,
      /\bodds of beating\b/i, /\bwill i beat\b/i, /\bh2h\b/i,
    ],
    extract: (q) => {
      const m = q.match(/(?:vs\.?|against|versus|beat(?:ing)?)\s*#?(\d{3,8})\b/i);
      return m ? { rivalEntry: Number(m[1]) } : {};
    },
  },
  {
    intent: "twin.study",
    component: "twin-study",
    patterns: [
      /\btwins?\b/i, /\bwhat if i (kept|sold|held)\b/i, /\bdid i make the right (transfer|call|move)\b/i,
      /\bmanagers like me\b/i, /\bpeople with my (squad|team)\b/i,
    ],
    extract: (q) => {
      const playerName = extractPlayerName(q);
      return playerName ? { playerName } : {};
    },
  },
];

export function route(query: string): RouteResult | null {
  const scored = SHAPES.map((s) => {
    let hits = 0;
    for (const p of s.patterns) {
      if (p.test(query)) hits++;
    }
    return { shape: s, score: hits };
  }).filter((r) => r.score > 0);

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return {
    intent: best.shape.intent,
    component: best.shape.component,
    params: best.shape.extract?.(query) ?? {},
    score: best.score,
  };
}

/**
 * Fallback when the model is unavailable AND routing missed: the highest-
 * scoring partial shape, or null. Never fabricates an intent.
 */
export function bestGuess(query: string): RouteResult | null {
  const direct = route(query);
  if (direct && direct.score >= 2) return direct;
  // single-word fallbacks for the most valuable intents
  if (/\bcaptain|price|hit|fixture|news|injur|chip|rank\b/i.test(query)) {
    const partial = route(query);
    if (partial) return partial;
    if (/\bprice\b/i.test(query)) return { intent: "price.change", component: "price-gauge", params: {}, score: 1 };
    if (/\bhit\b/i.test(query)) return { intent: "hit.cost", component: "transfer-sim", params: {}, score: 1 };
    if (/\bchip\b/i.test(query)) return { intent: "chip.when", component: "chip-timeline", params: {}, score: 1 };
    if (/injur/i.test(query)) return { intent: "injury.list", component: "injury-list", params: {}, score: 1 };
    if (/\bnews\b/i.test(query)) return { intent: "news.search", component: "news-search", params: { query }, score: 1 };
    if (/\brank\b/i.test(query)) return { intent: "rank.project", component: "rank-projection", params: {}, score: 1 };
    if (/\bcaptain/i.test(query)) return { intent: "captain.pick", component: "captain-compare", params: {}, score: 1 };
    if (/fixture/i.test(query))
      return { intent: "fixture.run", component: "fixture-run", params: {}, score: 1 };
  }
  return null;
}
