/**
 * Tagger — regex name-matching of raw news items against the FPL bootstrap.
 * web_name values like "Ødegaard" or "Julián Álvarez (Ar)" need escaping and
 * loose word boundaries; matches map to element ids and club ids so the page
 * can rank by squad relevance. Pure functions only.
 */
import type { RawNewsItem } from "@/lib/news/sources";

export interface ElementRef {
  id: number;
  webName: string;
  team: number;
}

export interface TaggedItem extends RawNewsItem {
  elementIds: number[];
  teamIds: number[];
}

/** Escape regex specials, then allow spaces/underscores/dots where they sit. */
function nameToRegex(name: string): RegExp | null {
  const escaped = name
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "[\\s'’-]");
  if (escaped.length < 3) return null;
  // Lookaround keeps "Salah" from matching inside "Salahaddin"-style strings.
  return new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "iu");
}

export interface Tagger {
  patterns: { id: number; team: number; re: RegExp }[];
  byId: Map<number, ElementRef>;
}

export function buildTagger(elements: ElementRef[]): Tagger {
  const patterns: Tagger["patterns"] = [];
  const seen = new Set<string>();
  for (const e of elements) {
    const key = e.webName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const re = nameToRegex(e.webName);
    if (re) patterns.push({ id: e.id, team: e.team, re });
  }
  return { patterns, byId: new Map(elements.map((e) => [e.id, e])) };
}

export function tagItem(tagger: Tagger, item: RawNewsItem): TaggedItem {
  const haystack = `${item.title} ${item.summary ?? ""}`;
  const elementIds = new Set<number>();
  const teamIds = new Set<number>();
  for (const p of tagger.patterns) {
    if (p.re.test(haystack)) {
      elementIds.add(p.id);
      const team = tagger.byId.get(p.id)?.team;
      if (team != null) teamIds.add(team);
    }
  }
  return { ...item, elementIds: [...elementIds], teamIds: [...teamIds] };
}

/**
 * Ingest-time relevance — generic, not squad aware:
 * recency (12h half-life-ish decay over 3 days) × source weight, plus a bump
 * when several players are tagged (a story naming three players matters more).
 */
export function relevanceOf(item: TaggedItem, sourceWeight: number, now: Date): number {
  const ageHours = Math.max(0, (now.getTime() - item.publishedAt.getTime()) / 3_600_000);
  const recency = Math.pow(0.5, ageHours / 72); // half-life 3 days
  const spread = 1 + Math.min(0.5, item.elementIds.length * 0.15);
  const base = item.elementIds.length > 0 ? 1 : 0.6; // untagged chatter ranks lower
  return Number((sourceWeight * recency * spread * base).toFixed(4));
}
