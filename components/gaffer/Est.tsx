import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/primitives/Tooltip";

/** Wraps any estimated number: prepends ~, dotted underline, method tooltip.
 *
 *  The trigger renders as a span (asChild), not a button: these figures sit
 *  inside the pitch's player tiles, which are buttons themselves — a nested
 *  button is invalid HTML, and the browser's repair of it killed hydration
 *  and with it every click handler on the page. */
export function Est({ children, method }: { children: string; method: string }) {
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
