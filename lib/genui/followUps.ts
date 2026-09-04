/**
 * What to ask next.
 *
 * A one-shot answer ends the conversation: the reader gets a card, and the
 * only way to go deeper is to guess what else the desk understands. Every
 * answer now offers the two or three questions that actually follow from it,
 * which doubles as the discovery surface for a router whose vocabulary is
 * otherwise invisible.
 *
 * Deterministic on purpose. These are derived from which card was resolved,
 * not generated — a suggestion the router cannot answer is worse than none,
 * and every string here maps to an intent the router already handles.
 */

const BY_COMPONENT: Record<string, string[]> = {
  "captain-compare": ["Who is the differential captain?", "What are the fixtures for my top scorers?"],
  "exposure-scatter": ["Where am I most exposed?", "Who should I captain?"],
  "price-gauge": ["Who is about to rise in price?", "Who is falling in price?"],
  "fixture-run": ["What are the fixtures for my top scorers?", "Are there any blanks or doubles coming?"],
  "defcon-check": ["Who swings my rank most?", "Where am I most exposed?"],
  "xg-vs-actual": ["Who is overperforming their xG?", "Who is due a return?"],
  "rank-projection": ["Who swings my rank most?", "Where did I lose rank?"],
  "swing-impact": ["Who swings my rank most?", "Where am I most exposed?"],
  "chip-timeline": ["When should I play my wildcard?", "Are there any doubles coming?"],
  "injury-list": ["Who is doubtful this week?", "Who should I captain?"],
  "news-search": ["Any injury news on my squad?", "What is the latest team news?"],
  "transfer-sim": ["Where am I most exposed?", "Who is about to rise in price?"],
  "effective-bets": ["Where am I most exposed?", "Who is the differential captain?"],
  "true-form": ["Who is due a return?", "Who is overperforming their xG?"],
  "squad-generator": ["Who is about to rise in price?", "Who is due a return?"],
  "transfer-watch": ["Who is about to rise in price?", "Where am I most exposed?"],
  "chip-timing": ["When should I play my bench boost?", "Are there any doubles coming?"],
  review: ["Where did I lose rank?", "Who should I captain?"],
  crowding: ["Where am I most exposed?", "Who is the differential captain?"],
  wpa: ["Who swings my rank most?", "Where did I lose rank?"],
  "twin-study": ["Where did I lose rank?", "Where did I lose rank?"],
};

/** Asked of anyone, whether or not a team id is known. */
const GENERAL = ["Who should I captain?", "Who is about to rise in price?", "Any injury news?"];

/** Only worth offering once we know whose squad we are talking about. */
const WITH_TEAM = ["Where am I most exposed?", "Who is about to rise in price?"];

export function followUpsFor(component: string | null, teamKnown: boolean, limit = 3): string[] {
  const specific = component ? (BY_COMPONENT[component] ?? []) : [];
  const pool = [...specific, ...(teamKnown ? WITH_TEAM : []), ...GENERAL];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of pool) {
    const k = q.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(q);
    if (out.length >= limit) break;
  }
  return out;
}
