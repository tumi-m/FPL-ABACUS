"use client";

/**
 * Route-segment error boundary.
 *
 * Before this file existed, any uncaught server exception rendered Next's
 * default crash page — a raw error and a stack, exactly what the "the user
 * gets a sentence" rule forbids. The cause reaches the server log through the
 * framework; what reaches the user is one honest sentence and a way back that
 * does not lose the session, because the shell (theme, team cookie, nav) is
 * still mounted around this segment.
 */

import { COPY } from "@/lib/copy/deck";

export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[50dvh] place-items-center px-4 py-16">
      <div className="w-full max-w-md rounded-lg bg-surface-1 card-ring px-6 py-8 text-center">
        <h1 className="text-sm font-medium text-ink-1">{COPY.unexpected.title}</h1>
        <p className="mx-auto mt-2 max-w-[48ch] text-xs leading-relaxed text-ink-lo">
          {COPY.unexpected.body}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="skewed inline-flex h-9 items-center rounded-md bg-raised px-4 text-2xs uppercase-label text-ink-mid card-ring transition-colors dur-instant hover:text-ink-hi"
          >
            <span>Try again</span>
          </button>
          <a
            href="/live"
            className="skewed inline-flex h-9 items-center rounded-md bg-raised px-4 text-2xs uppercase-label text-ink-mid card-ring transition-colors dur-instant hover:text-ink-hi"
          >
            <span>Back to Matchday</span>
          </a>
        </div>
        {error.digest && (
          <p className="mt-4 text-2xs text-ink-3 fig-num">ref {error.digest}</p>
        )}
      </div>
    </div>
  );
}