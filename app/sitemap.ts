import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

/**
 * Only the pages a stranger can actually open.
 *
 * Most of the app needs a team id and redirects to the landing page without
 * one, so listing /field or /planner here would hand a crawler a set of URLs
 * that all answer with a redirect to the same place — which is worse than
 * listing nothing, because it teaches the crawler the sitemap is unreliable.
 * These five render for anybody.
 *
 * Player pages are public and there are six hundred of them, which would be a
 * real addition — but generating them means an FPL call inside the sitemap,
 * and FPL answered 403 for a spell this week. A sitemap that intermittently
 * 500s is a worse signal than a small one that always works; the explorer
 * links to every player, so they are reachable by crawl either way.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/players`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/compare`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/arcade`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
