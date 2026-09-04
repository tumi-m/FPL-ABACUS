"use client";

import * as React from "react";
import Image from "next/image";
import { playerImgSources } from "@/lib/ui/format";
import { CrestTile } from "@/components/gaffer/ClubCrest";
import { cn } from "@/lib/ui/cn";

/**
 * Player face with a source cascade — the current-season asset set first,
 * the legacy CDN second, the club crest when both fail. New signings (Wirtz,
 * Isak's Liverpool era) only exist on the current set; old hands stay covered
 * by the fallback if a season set is ever pruned.
 *
 * next/image (v10 A3): the optimizer gives AVIF/WebP and a size ladder that
 * matches the 32–96 px the app actually renders, and — the point of the
 * change — `width`/`height` are intrinsic, so the browser reserves the box
 * before the face arrives and the table of fifteen players no longer reflows
 * as photos decode. The optimizer never changes a URL's content semantics,
 * so the cascade works the same: a 404 on the *origin* propagates through
 * `/_next/image` as a 400/404 and `onError` advances to the next source.
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

  /*
   * Reset during render, not in an effect.
   *
   * Restarting the cascade in a `useEffect([photo])` looks equivalent and is
   * not: effects also run on mount, and they run *after* refs. So the ref
   * below would correctly notice an already-decoded image, set loaded, and
   * then the mount pass of the effect would immediately set it back to false —
   * leaving a fully-downloaded photo pinned at opacity-0 with the club crest
   * showing through it for the life of the page. Comparing against the last
   * photo during render only fires on an actual change.
   */
  const [prevPhoto, setPrevPhoto] = React.useState(photo);
  if (photo !== prevPhoto) {
    setPrevPhoto(photo);
    setIdx(0);
    setLoaded(false);
  }

  const src = idx < sources.length ? sources[idx] : null;

  /*
   * Ask the element, don't wait to be told.
   *
   * A cached photo — or one served instantly off a warm CDN edge — can finish
   * loading in the gap between the server's markup arriving and React
   * hydrating it. The load event has already been and gone by the time onLoad
   * exists, so it never fires, `loaded` stays false, and a photo that is sat
   * right there in the browser renders at opacity-0 for the life of the page.
   * A ref callback runs the instant the element is attached, so it can just
   * read what the browser already knows. `key={src}` gives each source its own
   * element, so this re-runs for every step of the cascade.
   */
  const measure = React.useCallback((node: HTMLImageElement | null) => {
    if (!node || !node.complete) return;
    if (node.naturalWidth > 0) setLoaded(true);
    // complete with no pixels is a 404 that also beat hydration — the onError
    // handler missed it for the same reason, so advance the cascade here.
    else setIdx((i) => i + 1);
  }, []);

  /*
   * The crest is underneath until the photo lands, and then it is gone.
   *
   * The cascade used to swap the <img>'s src in place with nothing behind it,
   * which left two holes: a source that 404s renders the browser's own
   * broken-image glyph for the frame or two before onError lands, and Safari
   * does not always fire onError on a lazily-loaded image at all — so a table
   * of fifteen players came out as a grid of question marks. A crest below the
   * photo fixed that, but it fixed it for every player: the headshots are cut
   * out with transparent shoulders, so a permanent crest showed through as a
   * coloured plate with the club's three letters poking out behind every face
   * on the pitch. The photo is meant to float on the grass.
   *
   * So the crest is a fallback rather than a backdrop — painted while nothing
   * has decoded, and unmounted the moment something has. The worst case is
   * still a crest and never a glyph, which was the whole point of it.
   *
   * Each source gets its own element via `key`, so a browser that has already
   * decided one URL is broken cannot carry that verdict onto the next.
   */
  return (
    <span className="relative grid h-full w-full place-items-center">
      {!loaded && (
        <span aria-hidden className="absolute inset-0 grid place-items-center">
          <CrestTile teamId={teamId} />
        </span>
      )}
      {src && (
        <Image
          key={src}
          ref={measure}
          src={src}
          alt=""
          width={64}
          height={80}
          // Rendered at 32–96 px across the app; 64×80 is the middle of the
          // ladder and the optimizer picks the nearest larger step per DPR.
          sizes="64px"
          priority={eager}
          loading={eager ? undefined : "lazy"}
          /* Hidden until it has actually decoded. A broken <img> paints the
             browser's own glyph over whatever is behind it, so leaving it
             visible while it loads or fails would put a question mark on top
             of the crest instead of letting the crest do its job. */
          className={cn("relative h-full w-full object-contain object-top transition-opacity dur-instant", className, loaded ? "opacity-100" : "opacity-0")}
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