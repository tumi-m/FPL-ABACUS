"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { layoutAnswer, type LayoutCard } from "@/lib/genui/layout";
import dynamic from "next/dynamic";

/** The card renderer — one chunk, loaded when an answer actually carries a card. */
const AskCard = dynamic(() => import("@/components/gaffer/ask/AskCards").then((m) => m.AskCard), {
  ssr: false,
  loading: () => <div className="h-24 animate-pulse rounded-lg bg-surface-3/40" />,
});

/**
 * The interface that assembles itself (v10 E4).
 *
 * A multi-tool answer is composed into a generated mini-dashboard rather
 * than a flat stack: the hero card leads — one gradient hero figure per
 * screen, so only its container may carry one — and the support cards take
 * the template the pure chooser picked (beside the hero, banded under it,
 * or stacked).
 *
 * Each part rises into place as it arrives (A5): a 60 ms-staggered
 * fade-and-lift, chrome only. The data inside a card never animates and
 * numbers never count up; under prefers-reduced-motion the global kill
 * switch collapses the animation to one frame and the final DOM is
 * identical.
 *
 * Templates are deterministic — the model names components; this module
 * never lets it name a layout.
 */
export function AssembledAnswer({
  cards,
}: {
  cards: { component: string; props: Record<string, unknown>; prose: string; note?: string }[];
}) {
  const layout = layoutAnswer(cards);
  if (!layout.hero) return null;

  const render = (c: LayoutCard, i: number, className?: string) => (
    <div
      key={`${c.component}-${i}`}
      className={cn("ask-rise min-w-0", className)}
      // Chrome staggers; the content it wraps does not move on its own.
      style={{ animationDelay: `${i * 60}ms` }}
    >
      <AskCard component={c.component} props={(c as unknown as { props: Record<string, unknown> }).props} />
    </div>
  );

  if (layout.template === "single") {
    return render(layout.hero, 0);
  }

  const heroNode = (
    <div key="hero" className="ask-rise min-w-0" style={{ animationDelay: "0ms" }}>
      <div className="rounded-xl card-lift bg-raised p-1">
        <AskCard
          component={layout.hero.component}
          props={(layout.hero as unknown as { props: Record<string, unknown> }).props}
        />
      </div>
      <p className="mt-1.5 px-1 text-xs leading-relaxed text-ink-lo">{layout.hero.prose}</p>
    </div>
  );

  if (layout.template === "hero-side") {
    return (
      <section
        aria-label="Assembled answer"
        className="grid items-start gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
      >
        {heroNode}
        {render(layout.support[0], 1)}
      </section>
    );
  }

  if (layout.template === "hero-band") {
    return (
      <section aria-label="Assembled answer" className="space-y-3">
        {heroNode}
        <div className="grid gap-3 md:grid-cols-2">
          {layout.support.map((c, i) => render(c, i + 1))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Assembled answer" className="space-y-3">
      {heroNode}
      {layout.support.map((c, i) => render(c, i + 1))}
    </section>
  );
}