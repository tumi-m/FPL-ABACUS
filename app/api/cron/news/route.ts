import { NextRequest, NextResponse } from "next/server";
import { cronGuard } from "@/lib/server/cronGuard";
import { hasDb } from "@/lib/env";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { NEWS_SOURCES, fetchAllSources } from "@/lib/news/sources";
import { buildTagger, relevanceOf, tagItem, type TaggedItem } from "@/lib/news/tagger";
import { pruneOld, saveItems } from "@/lib/news/store";

export const maxDuration = 60;

/**
 * Hourly news ingest — RSS×3 + Reddit JSON, regex-tagged against the FPL
 * bootstrap, upserted on URL hash. Self-throttling: sources are cheap and the
 * hash conflict makes re-runs no-ops.
 */
export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;

  if (!hasDb) {
    return NextResponse.json({ ok: true, skipped: "no-database-configured" });
  }

  try {
    const boot = await getBootstrapLite();
    const tagger = buildTagger(
      Object.values(boot.elements).map((e) => ({
        id: e.id,
        webName: e.web_name,
        team: e.team,
      })),
    );
    const weightById = new Map(NEWS_SOURCES.map((s) => [s.id, s.weight]));

    const results = await fetchAllSources();
    const now = new Date();
    const tagged: (TaggedItem & { relevance: number })[] = [];
    const perSource: Record<string, number> = {};

    for (const r of results) {
      perSource[r.sourceId] = r.items.length;
      const weight = weightById.get(r.sourceId) ?? 0.5;
      for (const item of r.items.slice(0, 40)) {
        const t = tagItem(tagger, item);
        tagged.push({ ...t, relevance: relevanceOf(t, weight, now) });
      }
    }

    // Freshest first — if a source floods us we keep its newest window.
    tagged.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    const saved = await saveItems(tagged.slice(0, 160));
    const pruned = await pruneOld();

    return NextResponse.json({
      ok: true,
      fetched: perSource,
      saved,
      pruned,
      errors: results.filter((r) => r.error).map((r) => ({ source: r.sourceId, error: r.error })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 502 },
    );
  }
}
