"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { clubOf } from "@/config/clubs";
import { crest as crestUrl } from "@/lib/ui/format";
import { CrestTile } from "@/components/gaffer/ClubCrest";

/**
 * Real club crest from the FPL CDN — falls back to the skewed CrestTile code
 * tile when the badge is missing or fails (remote never blocks layout).
 *
 * It lives in its own client module because that fallback needs state, and a
 * hook in a shared module takes the whole module client-side with it: the
 * server-rendered pages that import the stateless `ClubFlag` and `CrestTile`
 * beside it would crash on render. Splitting keeps those two server-safe.
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

