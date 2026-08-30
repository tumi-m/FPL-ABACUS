import type { UpstreamFailureRead } from "@/lib/engines/upstreamFailure";

/**
 * The shared failure panel.
 *
 * Screens used to hand-roll a centred grey sentence each, which is how three
 * of them ended up asserting "FPL may be busy" about faults that were nothing
 * of the sort. One panel, fed by readUpstreamFailure, so the claim always
 * matches the error — and a reload link only where reloading could actually
 * help, since offering one on a mistyped id invites an infinite retry.
 */
export function UpstreamFailure({
  read,
  retryHref,
  children,
}: {
  read: UpstreamFailureRead;
  /** Where "Try again" should point. Omitted when a retry cannot help. */
  retryHref?: string;
  /** Anything the screen can still offer despite the failure. */
  children?: React.ReactNode;
}) {
  return (
    <section
      aria-label="Load failed"
      className="rounded-lg bg-surface-1 card-ring px-6 py-8 text-center"
    >
      <p className="text-sm font-medium text-ink-1">{read.title}</p>
      {read.body && (
        <p className="mx-auto mt-2 max-w-[52ch] text-xs leading-relaxed text-ink-lo">{read.body}</p>
      )}
      {(retryHref && read.retryable) || children ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {retryHref && read.retryable && (
            /* A plain anchor, not a Link: the point is a fresh request to the
               server, which is exactly what the client router avoids doing. */
            <a
              href={retryHref}
              className="skewed inline-flex h-9 items-center rounded-md bg-raised px-4 text-2xs uppercase-label text-ink-mid card-ring transition-colors dur-instant hover:text-ink-hi"
            >
              <span>Try again</span>
            </a>
          )}
          {children}
        </div>
      ) : null}
    </section>
  );
}
