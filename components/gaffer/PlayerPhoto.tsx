"use client";

import * as React from "react";
import { playerImgSources } from "@/lib/ui/format";
import { CrestTile } from "@/components/gaffer/ClubCrest";

/**
 * Player face with a source cascade — the current-season asset set first,
 * the legacy CDN second, the club crest when both fail. New signings (Wirtz,
 * Isak's Liverpool era) only exist on the current set; old hands stay covered
 * by the fallback if a season set is ever pruned.
 */
export function PlayerPhoto({
  photo,
  teamId,
  className,
  eager = false,
}: {
  photo: string | null | undefined;
  teamId: number;
  className?: string;
  eager?: boolean;
}) {
  const sources = React.useMemo(() => (photo ? playerImgSources(photo) : []), [photo]);
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => setIdx(0), [photo]);

  if (sources.length === 0 || idx >= sources.length) {
    return (
      <span aria-hidden className="grid h-full w-full place-items-center">
        <CrestTile teamId={teamId} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[idx]}
      alt=""
      loading={eager ? "eager" : "lazy"}
      className={className}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
