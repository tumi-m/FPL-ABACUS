import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/primitives/Tooltip";

/** Wraps any estimated number: prepends ~, dotted underline, method tooltip. */
export function Est({ children, method }: { children: string; method: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        className="cursor-help border-b border-dotted border-hairline-strong font-normal"
        aria-label={`Estimated: ${children}. ${method}`}
      >
        <span aria-hidden>~</span>
        {children}
      </TooltipTrigger>
      <TooltipContent>{method}</TooltipContent>
    </Tooltip>
  );
}
