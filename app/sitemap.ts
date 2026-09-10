import type { MetadataRoute } from "next";
import { requestOrigin } from "@/lib/siteUrl";

/**
 * The pages a stranger can open, on the host that served this file.
 *
 * `requestOrigin()` rather than the stated canonical, and that is the fix for
 * four errors on four URLs. Google validates a sitemap's entries against the
 * host it fetched the sitemap from, and the previous version listed whatever
 * `VERCEL_PROJECT_PRODUCTION_URL` reported — the apex, because that variable
 * returns the shortest domain — while being served at the www address. Every
 * entry was rejected as belonging to another site.
 *
 * Describing the host that answered cannot go wrong that way, whatever the
 * environment says, and it means the file is correct at both addresses at
 * once. The canonical tag on each page still nominates one preferred host, so
 * a crawler arriving via the apex is told where the real copy lives; that is
 * the canonical's job, not the sitemap's.
 *
 * Most of the app needs a team id and redirects without one, so listing
 * /field or /planner would hand a crawler URLs that all answer with the same
 * redirect — worse than listing nothing, because it teaches the crawler the
 * sitemap is unreliable. Player pages are public and there are six hundred,
 * which would be a real addition, but generating them means an FPL call
 * inside the sitemap and FPL answered 403 for a spell this week; a sitemap
 * that intermittently 500s is a worse signal than a small one that always
 * works.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await requestOrigin();
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/players`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/compare`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/arcade`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
