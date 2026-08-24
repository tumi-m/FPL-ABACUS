import { cn } from "@/lib/ui/cn";
import { clubOf, type Club } from "@/config/clubs";
import { crest as crestUrl } from "@/lib/ui/format";
import * as React from "react";

/**
 * Angled club flag — FLOODLIGHT rev-02 §8. The club colour as a 9° parallelogram.
 * Decorative; always pair with the club code somewhere on the row.
 */
export function ClubFlag({
  teamId,
  className,
  colorVar,
}: {
  teamId: number | null | undefined;
  className?: string;
  colorVar?: string;
}) {
  const club = clubOf(teamId);
  return (
    <span
      aria-hidden="true"
      className={cn("skewed inline-block w-[5px] self-stretch rounded-[2px]", className)}
      style={{ background: colorVar ?? club.rail }}
    />
  );
}

/**
 * Crest tile — 36×30 skewed rectangle with the counter-skewed code inside and
 * the chrome bevel applied. Replaces remote crest images: faster, always
 * legible, never a broken image.
 */
export function CrestTile({ teamId, className }: { teamId: number | null | undefined; className?: string }) {
  const club = clubOf(teamId);
  return (
    <span
      title={club.name}
      className={cn(
        "skewed card-ring inline-flex h-[30px] w-9 shrink-0 items-center justify-center rounded-[3px]",
        "font-display text-[11px] font-extrabold tracking-wide",
        className,
      )}
      style={{ background: club.rail, color: club.lightInk ? "var(--ink-fixed-dark)" : "var(--ink-on-dark)" }}
    >
      <span>{club.code}</span>
    </span>
  );
}

/**
 * Real club crest from the FPL CDN — falls back to the skewed CrestTile code
 * tile when the badge missing or fails (remote never blocks layout).
 */
export function CrestBadge({
  teamId,
  size = 20,
  className,
}: {
  teamId: number | null | undefined;
  size?: number;
  className?: string;
}) {
  const club = clubOf(teamId);
  const [broken, setBroken] = React.useState(false);
  if (broken || club.crestCode === 0) {
    return <CrestTile teamId={teamId} className={className} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={crestUrl(club.crestCode)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className={cn("inline-block shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
      title={club.name}
    />
  );
}

export type { Club };
