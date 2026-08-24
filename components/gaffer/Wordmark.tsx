import Image from "next/image";
import { brand } from "@/config/brand";
import { cn } from "@/lib/ui/cn";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-[3px] font-semibold tracking-tight text-ink-1",
        className,
      )}
    >
      <span aria-hidden className="relative inline-block h-[1em] w-[1em] translate-y-[0.14em]">
        <Image
          src="/images/gaffer-badge.png"
          alt=""
          fill
          sizes="1.4em"
          className="rounded-full object-contain"
          unoptimized
        />
      </span>
      {brand.name}
    </span>
  );
}
