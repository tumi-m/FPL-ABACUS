import { headers } from "next/headers";

/**
 * Where this deployment lives, as an absolute origin.
 *
 * Needed for the handful of things that cannot be relative: the OG and Twitter
 * card images social platforms fetch by URL, the canonical link that tells a
 * search engine which of several addresses is the real one, and the sitemap.
 *
 * ── The trap this file was written into, and now avoids
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` sounds like "the project's real address".
 * It is documented as the SHORTEST production custom domain — and the
 * shortest is exactly the one a www-primary project redirects away from.
 * With fplgaffers.com and www.fplgaffers.com both on the project, it hands
 * back the apex: 14 characters against 18. So the sitemap was served at the
 * www address while listing apex URLs, Google rejected all four for being on
 * another host, and every canonical tag pointed at a hostname that answers
 * 308. The canonical existed to consolidate two copies of the site onto one
 * and was quietly nominating the wrong one.
 *
 * No environment variable Vercel sets can distinguish the primary domain from
 * the one redirecting to it, so the only reliable answer is a stated one.
 * `NEXT_PUBLIC_SITE_URL` is that, and a production build without it now says
 * so in the build log rather than guessing silently.
 *
 * Resolution order:
 *
 *   NEXT_PUBLIC_SITE_URL            the stated answer. The only one that can
 *                                   know which of several working hostnames
 *                                   is the canonical one.
 *   VERCEL_PROJECT_PRODUCTION_URL   a fallback, with the caveat above. Better
 *                                   than nothing; not to be relied on by a
 *                                   project with a www redirect.
 *   localhost                       development.
 *
 * Deliberately never VERCEL_URL: that is the per-deployment address and
 * changes on every push, so it would hand a search engine a canonical that
 * stops existing and point every social card at a dead deploy.
 */

let warned = false;

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalise(explicit);

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) {
    if (isProduction && !warned) {
      warned = true;
      console.warn(
        "[gaffer] NEXT_PUBLIC_SITE_URL is not set, so the canonical host is " +
          `falling back to VERCEL_PROJECT_PRODUCTION_URL (${production}). That variable ` +
          "returns the SHORTEST production domain, which on a www-primary project is the " +
          "apex — the hostname that redirects. Set NEXT_PUBLIC_SITE_URL to the canonical " +
          "origin, including www if that is the primary.",
      );
    }
    return normalise(production);
  }

  return "http://localhost:3000";
}

/**
 * The origin of the request being answered.
 *
 * For anything a crawler fetches by URL and then validates against the URL it
 * fetched — a sitemap, above all — this is the right answer and the stated
 * canonical is the wrong one. Google requires a sitemap's entries to sit under
 * the same host as the sitemap itself, so a file that describes the host it
 * was served from cannot produce a cross-host rejection no matter how the
 * environment is configured. It is the same trick the calendar feed uses,
 * which is why subscribing survived the domain change without a code change.
 *
 * Falls back to the stated canonical when there is no request to read, which
 * is what happens if the route is ever prerendered.
 */
export async function requestOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return siteUrl();
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return normalise(`${proto}://${host}`);
  } catch {
    // No request context — prerender, or a unit test.
    return siteUrl();
  }
}

/** Vercel's variables carry no protocol, and a trailing slash breaks new URL(). */
function normalise(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}

/**
 * Is this the live site, rather than a preview or a local build?
 *
 * Positively identifying the NON-production cases, rather than requiring
 * VERCEL_ENV to equal "production", because the two mistakes are not equally
 * priced. Wrongly allowing a preview to be crawled costs a stray indexed page
 * nobody will find. Wrongly disallowing production takes the whole site out of
 * Google — and the first version defaulted to that whenever VERCEL_ENV was
 * absent or renamed, which is a silent, total, hard-to-notice failure. So the
 * default is visible, and only a known preview or development environment
 * turns crawling off.
 */
const NON_PRODUCTION = new Set(["preview", "development"]);
export const isProduction = !NON_PRODUCTION.has(process.env.VERCEL_ENV ?? "");
