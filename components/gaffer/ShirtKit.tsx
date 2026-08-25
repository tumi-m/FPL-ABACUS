"use client";

import * as React from "react";
import { clubOf } from "@/config/clubs";
import { cn } from "@/lib/ui/cn";

/**
 * A club shirt, drawn.
 *
 * Some people read a pitch faster by kit than by face — it is how the game
 * looks on television, and it sidesteps the headshot CDN entirely. Twenty
 * clubs cannot be told apart by colour alone (three wear red, two wear white),
 * so each kit carries a pattern as well, and the club code sits on the shirt.
 *
 * The colours come from the club rail tokens, so a kit never introduces a raw
 * hex and always matches the chrome tint the rest of the app uses.
 */

export type KitPattern = "solid" | "stripes" | "halves" | "sash" | "hoops";

/** Which pattern each club wears, so the twenty stay distinguishable. */
const PATTERN: Record<number, KitPattern> = {
  1: "solid", // Arsenal
  2: "solid", // Aston Villa
  3: "stripes", // Bournemouth
  4: "stripes", // Brentford
  5: "stripes", // Brighton
  6: "solid", // Chelsea
  7: "solid", // Coventry
  8: "sash", // Crystal Palace
  9: "solid", // Everton
  10: "solid", // Fulham
  11: "stripes", // Hull
  12: "solid", // Ipswich
  13: "solid", // Leeds
  14: "solid", // Liverpool
  15: "solid", // Man City
  16: "solid", // Man Utd
  17: "stripes", // Newcastle
  18: "solid", // Nott'm Forest
  19: "halves", // Spurs
  20: "stripes", // Sunderland
};

export function ShirtKit({
  teamId,
  className,
  label,
}: {
  teamId: number | null | undefined;
  className?: string;
  /** Overrides the default "Arsenal kit" title. */
  label?: string;
}) {
  const club = clubOf(teamId);
  const pattern = PATTERN[club.id] ?? "solid";
  const id = React.useId();
  // The dark trim reads on every rail colour, light or dark.
  const trim = club.lightInk ? "var(--ink-fixed-dark)" : "var(--ink-on-dark)";

  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={label ?? `${club.name} kit`}
      className={cn("block", className)}
    >
      <defs>
        <clipPath id={`${id}-body`}>
          <path d="M16 8 L10 12 L6 20 L12 24 L13 42 Q24 44 35 42 L36 24 L42 20 L38 12 L32 8 Q24 13 16 8 Z" />
        </clipPath>
      </defs>

      {/* base colour */}
      <path
        d="M16 8 L10 12 L6 20 L12 24 L13 42 Q24 44 35 42 L36 24 L42 20 L38 12 L32 8 Q24 13 16 8 Z"
        fill={club.rail}
      />

      {/* pattern, clipped to the shirt body */}
      <g clipPath={`url(#${id}-body)`} opacity="0.34">
        {pattern === "stripes" &&
          [0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={8 + i * 8} y="4" width="4" height="44" fill={trim} />
          ))}
        {pattern === "hoops" &&
          [0, 1, 2, 3].map((i) => (
            <rect key={i} x="4" y={12 + i * 8} width="40" height="4" fill={trim} />
          ))}
        {pattern === "halves" && <rect x="24" y="4" width="24" height="44" fill={trim} />}
        {pattern === "sash" && (
          <path d="M4 34 L34 4 L42 10 L12 40 Z" fill={trim} />
        )}
      </g>

      {/* collar and sleeve trim — chrome, not data */}
      <path d="M16 8 Q24 13 32 8 L30 6 Q24 10 18 6 Z" fill={trim} opacity="0.5" />
      <path
        d="M16 8 L10 12 L6 20 L12 24 L13 42 Q24 44 35 42 L36 24 L42 20 L38 12 L32 8 Q24 13 16 8 Z"
        fill="none"
        stroke={trim}
        strokeOpacity="0.35"
        strokeWidth="1"
      />

      {/* the code is the encoder; the colour only supports it */}
      <text
        x="24"
        y="33"
        textAnchor="middle"
        fontSize="11"
        fontWeight="800"
        fill={trim}
        style={{ fontVariationSettings: '"wdth" 110' }}
      >
        {club.code}
      </text>
    </svg>
  );
}
