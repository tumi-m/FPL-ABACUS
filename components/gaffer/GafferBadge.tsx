import Image from "next/image";
import { cn } from "@/lib/ui/cn";

/**
 * The gaffer's badge — the same mark that sits in the wordmark.
 *
 * The Ask button used to carry a typographic "?", which read as a help icon
 * rather than as the gaffer you are about to talk to. The badge says who
 * answers. It sizes to the current font size like a glyph would, so it can
 * stand in for the "?" anywhere without re-laying out the button around it.
 */
export function GafferBadge({ className, size = "1.35em" }: { className?: string; size?: string }) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-block shrink-0 align-[-0.3em]", className)}
      style={{ height: size, width: size }}
    >
      <Image
        src="/images/gaffer-badge.png"
        alt=""
        fill
        sizes="32px"
        className="rounded-full object-contain"
        unoptimized
      />
    </span>
  );
}
