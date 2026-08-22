/**
 * News sources — BBC / Guardian / FFScout RSS + r/FantasyPL JSON.
 * Parsers are pure (testable); fetching is a thin timeout-guarded wrapper.
 * No Twitter — the API is paid, per locked decision.
 */
import { createHash } from "node:crypto";

export interface RawNewsItem {
  url: string;
  title: string;
  summary: string | null;
  publishedAt: Date;
  source: string;
}

/** Canonical dedupe key — sha256 of the trimmed lowercase URL. */
export function urlHashOf(url: string): string {
  return createHash("sha256").update(url.trim().toLowerCase()).digest("hex");
}

export interface NewsSource {
  id: string;
  label: string;
  kind: "rss" | "reddit-json";
  url: string;
  /** Source weight in ingest-time relevance (0..1]. */
  weight: number;
}

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "bbc",
    label: "BBC Sport",
    kind: "rss",
    url: "https://feeds.bbci.co.uk/sport/football/premierleague/rss.xml",
    weight: 0.9,
  },
  {
    id: "guardian",
    label: "The Guardian",
    kind: "rss",
    url: "https://www.theguardian.com/football/rss",
    weight: 0.85,
  },
  {
    id: "ffscout",
    label: "FFScout",
    kind: "rss",
    url: "https://www.fantasyfootballscout.co.uk/feed/",
    weight: 0.7,
  },
  {
    id: "reddit",
    label: "r/FantasyPL",
    kind: "reddit-json",
    url: "https://www.reddit.com/r/FantasyPL/top.json?t=day&limit=50",
    weight: 0.5,
  },
];

/** Decode the XML entities we actually meet in these feeds. */
function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function tagText(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return null;
  return decodeEntities(m[1]).trim();
}

/** Minimal RSS/Atom item parser — just enough for titles, links and dates. */
export function parseRss(xml: string): { title: string; url: string; publishedAt: Date; summary: string | null }[] {
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) ?? [];
  const out: { title: string; url: string; publishedAt: Date; summary: string | null }[] = [];
  for (const b of blocks) {
    const title = tagText(b, "title");
    let url = tagText(b, "link");
    if (!url) {
      // Atom puts the link in an href attribute
      const href = b.match(/<link[^>]*href="([^"]+)"/i);
      url = href ? decodeEntities(href[1]) : null;
    }
    if (!title || !url) continue;
    const dateStr = tagText(b, "pubDate") ?? tagText(b, "published") ?? tagText(b, "updated");
    const parsed = dateStr ? new Date(dateStr) : new Date();
    const summary = tagText(b, "description") ?? tagText(b, "summary") ?? tagText(b, "content");
    out.push({
      title: stripTags(title).slice(0, 512),
      url,
      publishedAt: Number.isNaN(parsed.getTime()) ? new Date() : parsed,
      summary: summary ? stripTags(summary).slice(0, 2048) : null,
    });
  }
  return out;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

interface RedditChild {
  data?: {
    title?: string;
    permalink?: string;
    url_overridden_by_dest?: string;
    selftext?: string;
    created_utc?: number;
    link_flair_text?: string | null;
  };
}

export function parseRedditJson(body: string): { title: string; url: string; publishedAt: Date; summary: string | null }[] {
  let parsed: { data?: { children?: RedditChild[] } };
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  const children = parsed.data?.children ?? [];
  const out: { title: string; url: string; publishedAt: Date; summary: string | null }[] = [];
  for (const c of children) {
    const d = c.data;
    if (!d?.title || !d.permalink) continue;
    out.push({
      title: d.title.slice(0, 512),
      url: `https://www.reddit.com${d.permalink}`,
      publishedAt: new Date((d.created_utc ?? Date.now() / 1000) * 1000),
      summary: d.link_flair_text ?? (d.selftext ? d.selftext.slice(0, 280) : null),
    });
  }
  return out;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "fpl-gaffer/1.0 (news aggregation; contact via repo issues)",
      Accept: "application/rss+xml, application/xml, application/json;q=0.9, */*;q=0.8",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

export interface SourceResult {
  sourceId: string;
  items: RawNewsItem[];
  error?: string;
}

/** Fetch every source in parallel; failures degrade to empty with an error note. */
export async function fetchAllSources(timeoutMs = 6000): Promise<SourceResult[]> {
  return Promise.all(
    NEWS_SOURCES.map(async (s): Promise<SourceResult> => {
      try {
        const body = await fetchWithTimeout(s.url, timeoutMs);
        const parsed = s.kind === "rss" ? parseRss(body) : parseRedditJson(body);
        return {
          sourceId: s.id,
          items: parsed.map((p) => ({ ...p, source: s.id })),
        };
      } catch (err) {
        return {
          sourceId: s.id,
          items: [],
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );
}
