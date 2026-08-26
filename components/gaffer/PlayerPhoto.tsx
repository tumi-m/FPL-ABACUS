"use client";

import * as React from "react";
import { playerImgSources } from "@/lib/ui/format";
import { CrestTile } from "@/components/gaffer/ClubCrest";
import { cn } from "@/lib/ui/cn";

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
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    setIdx(0);
    setLoaded(false);
  }, [photo]);

  const src = idx < sources.length ? sources[idx] : null;

  /*
   * The crest is always underneath.
   *
   * The cascade used to swap the <img>'s src in place and show nothing behind
   * it, which left two holes: a source that 404s renders the browser's own
   * broken-image glyph for the frame or two before onError lands, and Safari
   * does not always fire onError on a lazily-loaded image at all — so a table
   * of fifteen players came out as a grid of question marks. Painting the club
   * crest as the base layer means the worst case is a crest, never a glyph,
   * and the photo simply arrives on top of it when it arrives.
   *
   * Each source gets its own element via `key`, so a browser that has already
   * decided one URL is broken cannot carry that verdict onto the next.
   */
  return (
    <span className="relative grid h-full w-full place-items-center">
      <span aria-hidden className="absolute inset-0 grid place-items-center">
        <CrestTile teamId={teamId} />
      </span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          loading={eager ? "eager" : "lazy"}
          /* Hidden until it has actually decoded. A broken <img> paints the
             browser's own glyph over whatever is behind it, so leaving it
             visible while it loads or fails would put a question mark on top
             of the crest instead of letting the crest do its job. */
          className={cn("relative transition-opacity dur-instant", className, loaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setIdx((i) => i + 1);
          }}
        />
      )}
    </span>
  );
}
