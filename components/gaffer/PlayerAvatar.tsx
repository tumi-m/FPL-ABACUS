"use client";

import * as React from "react";
import { PlayerPhoto } from "@/components/gaffer/PlayerPhoto";
import { ShirtKit } from "@/components/gaffer/ShirtKit";
import { cn } from "@/lib/ui/cn";

/**
 * One player mark, drawn the way this device likes them.
 *
 * Headshots are the default because a face is the fastest way to recognise a
 * player, but they depend on a third-party CDN and not everybody wants them —
 * so the whole app can be flipped to club kits from a single switch, the way
 * Focal does it. The choice lives in localStorage and is read once at mount.
 */

const STORAGE_KEY = "gaffer_avatar";
export type AvatarMode = "face" | "kit";

const EVENT = "gaffer:avatar-mode";

function read(): AvatarMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "kit" ? "kit" : "face";
  } catch {
    return "face";
  }
}

/**
 * The current preference, live across every component on the page.
 *
 * Starts on "face" so the server render and the first client render agree —
 * the stored value is applied in an effect, which is a one-frame swap rather
 * than a hydration mismatch.
 */
export function useAvatarMode(): [AvatarMode, (m: AvatarMode) => void] {
  const [mode, setMode] = React.useState<AvatarMode>("face");

  React.useEffect(() => {
    setMode(read());
    const onChange = () => setMode(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const set = React.useCallback((next: AvatarMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — the choice lasts for this session only */
    }
    setMode(next);
    // Tell every other avatar on the page, not just this one.
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [mode, set];
}

export function PlayerAvatar({
  photo,
  teamId,
  mode,
  className,
  eager = false,
}: {
  photo: string | null | undefined;
  teamId: number;
  mode: AvatarMode;
  className?: string;
  eager?: boolean;
}) {
  if (mode === "kit" || !photo) {
    return <ShirtKit teamId={teamId} className={cn("h-full w-full p-1", className)} />;
  }
  return <PlayerPhoto photo={photo} teamId={teamId} className={className} eager={eager} />;
}

/** The switch itself — chrome, in the app's tab-group recipe. */
export function AvatarToggle({
  mode,
  onChange,
  className,
}: {
  mode: AvatarMode;
  onChange: (m: AvatarMode) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Player artwork"
      className={cn("flex gap-1 rounded-md card-ring p-1", className)}
    >
      {(
        [
          { id: "face", label: "Faces" },
          { id: "kit", label: "Kits" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={mode === opt.id}
          onClick={() => onChange(opt.id)}
          title={
            opt.id === "kit"
              ? "Show club kits instead of player photographs"
              : "Show player photographs"
          }
          className={cn(
            "skewed rounded-sm px-2.5 py-1.5 text-2xs uppercase-label transition-colors dur-instant",
            mode === opt.id ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
          )}
        >
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
