import type { ReactNode } from "react";

/**
 * Broadcast lower-third page header (style guide §7) — volt flag + gradient
 * body, fig-num title, upper-label meta. One component so every route speaks
 * the same language. Chrome carries the skew; titles stay flat.
 */
export function PageHeader({
  title,
  meta,
  media,
  action,
  ariaLabel,
}: {
  title: string;
  meta?: string;
  /** Identity media before the title — player face, crest, etc. */
  media?: ReactNode;
  action?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <header className="lower3" aria-label={ariaLabel ?? title}>
      <div className="lower3-flag bg-volt" />
      <div className="lower3-body">
        {media}
        <div className="min-w-0">
          <h1 className="fig-num truncate text-[22px] leading-none">{title}</h1>
          {meta && <p className="upper-label mt-1.5 text-2xs text-ink-lo">{meta}</p>}
        </div>
        {action && <div className="ml-auto flex items-center">{action}</div>}
      </div>
    </header>
  );
}
