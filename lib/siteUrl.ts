/**
 * Where this deployment lives, as an absolute origin.
 *
 * Needed for the handful of things that cannot be relative: the OG and Twitter
 * card images social platforms fetch by URL, the canonical link that tells a
 * search engine which of several addresses is the real one, and the sitemap.
 * Everything else in the app is happily relative and needs none of this — the
 * calendar feed, for one, reads the origin off the request it is answering,
 * which is why subscribing survives a domain change without a code change.
 *
 * Resolution order, and why each step exists:
 *
 *   NEXT_PUBLIC_SITE_URL            an explicit answer, for a self-host or a
 *                                   staging domain that should speak for
 *                                   itself.
 *   VERCEL_PROJECT_PRODUCTION_URL   Vercel's name for the project's
 *                                   PRODUCTION domain. Deliberately not
 *                                   VERCEL_URL, which is the per-deployment
 *                                   address and changes on every push — using
 *                                   it would hand a search engine a canonical
 *                                   that stops existing, and point every
 *                                   social card at a dead deploy.
 *   localhost                       development.
 *
 * Note the production variable follows the custom domain once one is
 * assigned, so pointing a new domain at the project is a dashboard action
 * with no deploy attached — nothing here names a domain, on purpose.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalise(explicit);

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return normalise(production);

  return "http://localhost:3000";
}

/** Vercel's variables carry no protocol, and a trailing slash breaks new URL(). */
function normalise(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}

/** True only on the live production deployment — previews are not the site. */
export const isProduction = process.env.VERCEL_ENV === "production";
