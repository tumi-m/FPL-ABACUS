import "server-only";

/**
 * Deadlines for enhancements.
 *
 * Some of what a page shows is the page — your picks, the live scores — and
 * some of it makes the page better: the rank curve behind the estimated live
 * rank, the cohort EO sample, the swing event log. The second kind must never
 * be able to hold the first hostage.
 *
 * The cache underneath is stale-while-revalidate, so a slow call here is not
 * wasted: it keeps running and populates the cache for the next render. This
 * only decides how long *this* request is willing to wait before going
 * without. Every consumer already has an honest empty state — the matchday
 * model drops to "no rank estimate" rather than guessing — so the degraded
 * render is truthful rather than blank.
 */

/**
 * Resolve `work` within `ms`, or hand back `fallback`.
 *
 * The promise is not cancelled; it is left to finish in the background and
 * warm the cache. Rejections are swallowed for the same reason a timeout is:
 * this is an enhancement, and the caller has somewhere honest to fall back to.
 */
export function withDeadline<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  // Nothing waits on the loser, so an unhandled rejection would be noise.
  work.catch(() => undefined);
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** How long a page will wait for an enhancement before rendering without it. */
export const ENHANCEMENT_MS = 1_500;
