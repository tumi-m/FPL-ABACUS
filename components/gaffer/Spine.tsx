"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";

/**
 * The page spine — section landmarks and a rail that jumps between them.
 *
 * The Field is six thousand pixels tall on a phone, the Planner five, the
 * player explorer nearly six. Every one of them was already divided into
 * sections in the markup, and every section heading was set in the smallest,
 * dimmest style the system has — quieter than the titles of the cards inside
 * it. So the structure was real and invisible, and the pages read as one
 * undifferentiated wall you scrolled through hoping to recognise something.
 *
 * Two parts, and they only work together:
 *
 *   PageSection  gives a section a heading with the weight of a chapter break
 *                — a flag, a rule across the page, and ink you can actually
 *                see — plus the anchor the rail needs.
 *   SectionNav   is that document's table of contents, stuck under the
 *                header, tracking where you are as you scroll.
 *
 * Chrome, both of them: the flag and the chips carry the skew, the headings
 * and the hints stay flat and upright like every other piece of text that
 * means something.
 */

/** Height of the app header plus this rail — what a jump has to clear. */
const STICKY_OFFSET = 104;

export interface SpineSection {
  id: string;
  /** What the rail calls it — shorter than the heading where that helps. */
  label: string;
}

export function PageSection({
  id,
  title,
  hint,
  aside,
  children,
  className,
}: {
  id: string;
  title: string;
  /** One line under the rule: what this section is for. */
  hint?: string;
  /** Anything that belongs on the heading row itself — a legend, a toggle. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      /* Clears the sticky header and rail, so a jump does not land the
         heading underneath them. */
      style={{ scrollMarginTop: `${STICKY_OFFSET}px` }}
      className={cn("space-y-3", className)}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={`${id}-h`} className="flex items-center gap-2 text-ink-hi">
          <span aria-hidden className="skewed h-3.5 w-1 rounded-[1px] bg-volt" />
          <span className="upper-label text-xs">{title}</span>
        </h2>
        {/* The rule is what makes it a break rather than another label. */}
        <span aria-hidden className="hidden h-px min-w-6 flex-1 bg-line sm:block" />
        {aside}
      </div>
      {hint && <p className="max-w-[68ch] text-2xs leading-relaxed text-ink-lo">{hint}</p>}
      {children}
    </section>
  );
}

/**
 * The jump rail.
 *
 * Sticky under the header, horizontally scrollable, and it follows you: the
 * chip for the section you are reading lights up, and scrolls itself into
 * view so the rail never shows you a set of chips that excludes where you
 * are. Sections that are not on the page yet — a block still loading, a
 * comparison nobody has opened — are simply not offered.
 */
export function SectionNav({
  sections,
  className,
}: {
  sections: SpineSection[];
  className?: string;
}) {
  const [active, setActive] = React.useState<string | null>(null);
  const [present, setPresent] = React.useState<string[]>([]);
  const railRef = React.useRef<HTMLDivElement>(null);

  // Only offer what is actually rendered. A rail that jumps to nothing is
  // worse than no rail.
  React.useEffect(() => {
    const check = () => setPresent(sections.filter((s) => document.getElementById(s.id)).map((s) => s.id));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [sections]);

  React.useEffect(() => {
    if (present.length === 0) return;
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.intersectionRatio);
        // The section occupying most of the band under the rail wins. Picking
        // "the first one intersecting" instead made the chip flicker back to
        // the previous section every time a tall one scrolled past.
        let best: string | null = null;
        let bestRatio = 0;
        for (const id of present) {
          const r = seen.get(id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            best = id;
          }
        }
        if (best) setActive(best);
      },
      { rootMargin: `-${STICKY_OFFSET}px 0px -55% 0px`, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const id of present) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [present]);

  // Keep the live chip in view without dragging the page with it.
  React.useEffect(() => {
    if (!active) return;
    const chip = railRef.current?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    chip?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const shown = sections.filter((s) => present.includes(s.id));
  // One landmark is not a table of contents.
  if (shown.length < 2) return null;

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    // Move the keyboard with the page — a jump that only scrolls leaves a
    // screen reader and a tab order behind where they were.
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };

  return (
    <nav
      aria-label="Jump to a section"
      className={cn("sticky top-14 z-30 -mx-4 px-4 py-2 md:-mx-6 md:px-6", className)}
    >
      <div
        ref={railRef}
        className="flex gap-1 overflow-x-auto rounded-full glass-edge p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {shown.map((s) => (
          <button
            key={s.id}
            type="button"
            data-chip={s.id}
            onClick={() => jump(s.id)}
            aria-current={active === s.id ? "true" : undefined}
            className={cn(
              "h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-2xs upper-label transition-colors dur-instant",
              active === s.id
                ? "bg-volt font-semibold text-on-accent"
                : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
