"use client";

import { PlayerAvatar, useAvatarMode } from "@/components/gaffer/PlayerAvatar";

/**
 * The avatar, reading the device preference for itself.
 *
 * `PlayerAvatar` takes the mode as a prop so a list can resolve it once and
 * hand it to every row. A server component has no hooks to resolve it with,
 * so this thin client wrapper does the reading — use it for the one-off marks
 * on server-rendered pages, and the prop form everywhere a list is involved.
 */
export function SelfAvatar({
  photo,
  teamId,
  className,
  eager,
}: {
  photo: string | null | undefined;
  teamId: number;
  className?: string;
  eager?: boolean;
}) {
  const [mode] = useAvatarMode();
  return <PlayerAvatar photo={photo} teamId={teamId} mode={mode} className={className} eager={eager} />;
}
