import Link from "next/link";
import { cn } from "@/lib/ui/cn";

/**
 * The three honest states (v10 A4).
 *
 * The app degrades honestly but it degraded inconsistently: some surfaces
 * said "Nothing here.", some rendered an empty list, some a spinner. Three
 * shapes only, each saying something a person can act on:
 *
 *   EmptyState    — "you have not done the thing yet" + the way to do it.
 *   ThinCoverage  — "the model does not have enough data to be worth
 *                   showing" + what would fix it.
 *   HonestFailure — "upstream did not answer" + retry. (The panel form of
 *                   UpstreamFailure for slots too small for a section.)
 *
 * Skeletons of the real shape beat spinners; loading.tsx owns those. These
 * components own the moment after the data has arrived and said something.
 */

export function EmptyState({
  title,
  action,
  href,
  children,
  className,
}: {
  /** One line, as a conclusion — "No watchlist yet", not "Warning". */
  title: string;
  /** The label of the way out — the button or link that does the thing. */
  action?: string;
  /** Where the way out leads. Omit for "nothing to do" states. */
  href?: string;
  /** The one sentence of how, when the action alone is not enough. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg bg-surface-1 card-ring px-6 py-8 text-center", className)}>
      <p className="text-sm font-medium text-ink-1">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-[52ch] text-xs leading-relaxed text-ink-lo">{children}</p>}
      {action && href && (
        <Link
          href={href}
          className="skewed mt-4 inline-flex h-9 items-center rounded-md bg-raised px-4 text-2xs uppercase-label text-ink-mid card-ring transition-colors dur-instant hover:text-ink-hi"
        >
          <span>{action}</span>
        </Link>
      )}
    </div>
  );
}

export function ThinCoverage({
  title,
  what,
  className,
}: {
  /** What is missing, as a conclusion — "Not enough snapshot history". */
  title: string;
  /** What would fix it, honestly — "hourly snapshots have not covered this player yet". */
  what: string;
  className?: string;
}) {
  return (
    <div
      role="note"
      aria-label={`${title} — ${what}`}
      className={cn("rounded-md bg-surface-2 px-4 py-3", className)}
    >
      <p className="flex items-baseline gap-2 text-xs text-ink-2">
        <span aria-hidden className="fig-num text-base leading-none text-ink-lo">—</span>
        <span className="font-medium">{title}</span>
      </p>
      <p className="mt-1 pl-6 text-2xs leading-relaxed text-ink-lo">{what}</p>
    </div>
  );
}

/**
 * The inline failure — a sentence and a retry, never a raw error, for the
 * slots too small for the full UpstreamFailure section.
 */
export function HonestFailure({
  what,
  onRetry,
  retryHref,
  className,
}: {
  /** The sentence — what the user cannot have, never the cause. */
  what: string;
  /** Client-side retry callback. */
  onRetry?: () => void;
  /** Or a plain href for a server-side fresh request. */
  retryHref?: string;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("rounded-md bg-surface-1 card-ring px-4 py-3", className)}>
      <p className="text-xs text-ink-2">{what}</p>
      {(onRetry || retryHref) && (
        retryHref ? (
          <a
            href={retryHref}
            className="mt-2 inline-flex h-8 items-center rounded-sm bg-surface-3 px-3 text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:text-ink-hi"
          >
            <span>Try again</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex h-8 items-center rounded-sm bg-surface-3 px-3 text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:text-ink-hi"
          >
            <span>Try again</span>
          </button>
        )
      )}
    </div>
  );
}