"use client";

import * as React from "react";
import Image from "next/image";
import { CLUB } from "@/config/clubs";
import { ENGLAND_COAST_PATH } from "@/config/englandCoast";
import { getFavClub, setFavClub } from "@/lib/store/team";
import { crest as crestUrl } from "@/lib/ui/format";
import { cn } from "@/lib/ui/cn";

/**
 * Club map band — the twenty Premier League crests pinned at their stadiums on
 * a stylised turf England. Clicking a crest tints the chrome accent app-wide
 * (same control as the pick carousel); tap again to clear. Decorative map,
 * real geography: the accessible club list sits beside it.
 */
export function ClubMap() {
  const [fav, setFav] = React.useState<number | null>(null);
  React.useEffect(() => setFav(getFavClub()), []);
  const pick = (id: number) => {
    const next = fav === id ? null : id;
    setFav(next);
    setFavClub(next);
  };

  const clubs = React.useMemo(() => Object.values(CLUB), []);

  return (
    <section aria-label="Premier League map" className="mx-auto w-full max-w-[1100px] px-4 py-10">
      <div className="grid items-center gap-6 md:grid-cols-[minmax(0,340px)_1fr]">
        <div>
          <p className="upper-label text-2xs text-white/55">The map — every crest, pinned home</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-mid">
            Twenty clubs, one league. Tap a crest to tint the whole app to that club&apos;s colour —
            the chrome shifts, the numbers never do.
          </p>
          <p className="mt-3 text-sm text-ink-hi">
            {fav != null ? `${CLUB[fav].name} tint on` : "Default floodlight look"}
          </p>

          {/* accessible club list mirrors the map */}
          <ul className="mt-4 grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-2">
            {clubs.map((club) => (
              <li key={club.id}>
                <button
                  type="button"
                  onClick={() => pick(club.id)}
                  aria-pressed={fav === club.id}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-2xs transition-colors dur-instant",
                    fav === club.id ? "bg-surface-3 text-ink-hi" : "text-ink-lo hover:text-ink-hi",
                  )}
                >
                  <Image
                    src={crestUrl(club.crestCode)}
                    alt=""
                    width={14}
                    height={14}
                    className="shrink-0"
                    unoptimized
                  />
                  <span className="truncate">{club.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* the map — real coastline, crest markers at stadium positions */}
        <div className="relative overflow-hidden rounded-xl card-ring">
          <div className="absolute inset-0 bg-[linear-gradient(170deg,#0d2c1d,#071c14)]" aria-hidden />
          <svg
            viewBox="0 -6 100 112"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
            className="absolute inset-0 h-full w-full"
          >
            <path d={ENGLAND_COAST_PATH} fill="#1d5c3a" stroke="#2a8355" strokeWidth="0.5" />
          </svg>
          <ul className="relative aspect-[100/110] w-full">
            {clubs.map((club) => {
              const active = fav === club.id;
              return (
                <li
                  key={club.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${club.map.x}%`, top: `${club.map.y}%` }}
                >
                  <button
                    type="button"
                    onClick={() => pick(club.id)}
                    aria-pressed={active}
                    aria-label={`${club.name} — tint the app to ${club.name}`}
                    title={club.name}
                    className={cn(
                      "grid place-items-center rounded-md p-0.5 transition-all dur-instant",
                      active
                        ? "scale-110 bg-black/45 shadow-lg"
                        : "opacity-90 hover:scale-110 hover:bg-black/30 hover:opacity-100",
                    )}
                  >
                    <Image
                      src={crestUrl(club.crestCode)}
                      alt=""
                      width={30}
                      height={30}
                      className="drop-shadow-[0_3px_5px_rgba(0,0,0,.6)] md:h-8 md:w-8"
                      unoptimized
                    />
                    {active && (
                      <span
                        aria-hidden
                        className="absolute -bottom-1 h-1 w-6 rounded-full"
                        style={{ background: club.rail }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
