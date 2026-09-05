import { UNAVAILABLE_LINE, UNAVAILABLE_STATS, type Provenance } from "@/lib/provenance";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/primitives/Tooltip";
import { cn } from "@/lib/ui/cn";

/**
 * Provenance (v10 D8) — the three states a figure can have, one visual
 * language each.
 *
 *   Published   — FPL's own field. Deliberately undecorated: marking our
 *                 honesty would be marking nothing, and every surface would
 *                 grow a wart. Its provenance is the absence of the marks.
 *   Estimated   — the model's output: the dotted underline, the ~, and the
 *                 method in the tooltip. This is the existing <Est>, aliased
 *                 so a sweep can grep for the family rather than one name.
 *   Unavailable — Opta-only. Where a competitor would print a number, this
 *                 prints an explicit "Not published by FPL" affordance and
 *                 names the stat and the reason. The absence IS the feature.
 *
 * The audit test asserts every numeric leaf on the player, planner and board
 * surfaces sits inside one of these three. Nothing outside globals.css and
 * the chart palette gets a raw colour, so these use tokens only.
 */

/** FPL's own figure — no decoration, by design. Renders the number bare. */
export function Published({ children }: { children: React.ReactNode }) {
  return <span>{children}</span>;
}

/**
 * A modelled figure. Same contract and same rendering as Est — the dotted
 * underline, the ~, the method tooltip — under the provenance name so the
 * audit (and a reader of the diff) can see the seam named, not implied.
 */
export function Estimated({ children, method }: { children: string; method: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        asChild
        className="cursor-help border-b border-dotted border-hairline-strong font-normal"
        aria-label={`Estimated: ${children}. ${method}`}
      >
        <span
          tabIndex={0}
          role="note"
        >
          <span aria-hidden>~</span>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{method}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A stat the app deliberately does not show a number for. Renders as the
 * stat's name with an em-dash, and the reason one tap away — the shape a
 * competitor's column would have, minus the invention.
 */
export function Unavailable({
  label,
  why,
  className,
}: {
  label: string;
  why: string;
  className?: string;
}) {
  const stat = UNAVAILABLE_STATS.find((s) => s.label === label);
  const reason = why ?? stat?.why ?? UNAVAILABLE_LINE;
  return (
    <Tooltip>
      <TooltipTrigger
        asChild
        className={cn("cursor-help border-b border-dotted border-hairline-strong", className)}
        aria-label={`${label}: ${UNAVAILABLE_LINE}. ${reason}`}
      >
        <span
          tabIndex={0}
          role="note"
        >
          <span className="text-ink-3">{label}</span>{" "}
          <span aria-hidden className="fig-num text-ink-lo">—</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[38ch]">{reason}</TooltipContent>
    </Tooltip>
  );
}

export type { Provenance };