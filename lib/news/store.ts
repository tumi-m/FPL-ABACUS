/**
 * News store — the only module in lib/news that touches Postgres.
 * Insert-or-skip on the url hash; reads are bounded and ordered by time.
 */
import { desc, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dbRead } from "@/lib/db/read";
import { hasDb } from "@/lib/env";
import { newsItem } from "@/lib/db/schema";
import { urlHashOf } from "@/lib/news/sources";
import type { TaggedItem } from "@/lib/news/tagger";

export async function saveItems(items: (TaggedItem & { relevance: number })[]): Promise<number> {
  if (!hasDb || items.length === 0) return 0;
  const rows = items.map((i) => ({
    urlHash: urlHashOf(i.url),
    url: i.url.slice(0, 1024),
    source: i.source,
    title: i.title,
    summary: i.summary?.slice(0, 2048) ?? null,
    publishedAt: i.publishedAt,
    elementIds: i.elementIds,
    teamIds: i.teamIds,
    relevance: i.relevance,
  }));
  let saved = 0;
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const inserted = await db()
      .insert(newsItem)
      .values(chunk)
      .onConflictDoNothing({ target: newsItem.urlHash })
      .returning({ id: newsItem.id });
    saved += inserted.length;
  }
  return saved;
}

export interface StoredNewsRow {
  urlHash: string;
  url: string;
  source: string;
  title: string;
  summary: string | null;
  publishedAt: Date;
  elementIds: number[];
  teamIds: number[];
  relevance: number;
}

/** Newest window of tagged news; caller does squad-specific ranking. */
export async function recentItems(limit = 120, maxAgeDays = 10): Promise<StoredNewsRow[]> {
  return dbRead("news items", () => [] as StoredNewsRow[], async () => {
    const since = new Date(Date.now() - maxAgeDays * 86_400_000);
    return db()
      .select({
        urlHash: newsItem.urlHash,
        url: newsItem.url,
        source: newsItem.source,
        title: newsItem.title,
        summary: newsItem.summary,
        publishedAt: newsItem.publishedAt,
        elementIds: newsItem.elementIds,
        teamIds: newsItem.teamIds,
        relevance: newsItem.relevance,
      })
      .from(newsItem)
      .where(gt(newsItem.publishedAt, since))
      .orderBy(desc(newsItem.publishedAt))
      .limit(limit);
  });
}

/** Housekeeping — drop anything older than the retention window. */
export async function pruneOld(maxAgeDays = 14): Promise<number> {
  if (!hasDb) return 0;
  const cutoff = new Date(Date.now() - maxAgeDays * 86_400_000);
  const removed = await db().delete(newsItem).where(sql`${newsItem.publishedAt} < ${cutoff}`).returning({ id: newsItem.id });
  return removed.length;
}
