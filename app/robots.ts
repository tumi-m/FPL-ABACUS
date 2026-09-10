import type { MetadataRoute } from "next";
import { isProduction, siteUrl } from "@/lib/siteUrl";

/**
 * Two jobs, and the second one is the reason this file exists.
 *
 * It names the sitemap, and it keeps every deployment that is not production
 * out of the index. Vercel gives each push its own public address; without
 * this, a preview of a half-finished branch is as crawlable as the real site,
 * and Google is free to decide the preview is the canonical copy. That has
 * been true of every deploy so far.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  if (!isProduction) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing here is secret — it is all behind a team id — but a crawler
      // spending its budget on JSON it cannot read is budget not spent on
      // the pages a person would land on.
      disallow: ["/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
