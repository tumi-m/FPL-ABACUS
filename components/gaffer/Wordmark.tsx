import { brand } from "@/config/brand";
import { cn } from "@/lib/ui/cn";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-[3px] font-semibold tracking-tight text-ink-1", className)}>
      <span aria-hidden className="text-brand">·</span>
      {brand.name}
    </span>
  );
}
