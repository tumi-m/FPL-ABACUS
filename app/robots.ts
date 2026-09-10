import type { MetadataRoute } from "next";
import { isProduction, requestOrigin, siteUrl } from "@/lib/siteUrl";

/**
 * Two jobs, and the second is the reason to bother.
 *
 * It names the sitemap, and it keeps deployments that are not production out
 * of the index. Vercel gives each push its own public address, and without
 * this a preview of a half-finished branch is exactly as crawlable as the
 * real site — Google gets to pick which is canonical.
 *
 * The Sitemap: line points at the host that asked, so a crawler that found
 * this file at either address is sent to a sitemap it will accept. Host: names
 * the stated canonical, which is the one hostname worth preferring, and is the
 * one place in this file where the two differ on purpose.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!isProduction) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  const origin = await requestOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing here is secret — it is all behind a team id — but a crawler
      // spending its budget on JSON it cannot read is budget not spent on
      // the pages a person would land on.
      disallow: ["/api/"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: siteUrl(),
  };
}
