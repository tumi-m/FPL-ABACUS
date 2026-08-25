"use client";

import * as React from "react";
import { ClubFlag } from "@/components/gaffer/ClubCrest";
import { LiveDot } from "@/components/gaffer/LiveDot";
import { cn } from "@/lib/ui/cn";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

type Row = MatchdayModel["fixturesRail"][number];

/**
 * The round's scoreboard — every fixture, grouped by what it is doing.
 *
 * The old rail listed ten fixtures in schedule order and left you to find the
 * ones in play. On a matchday the three states are three different questions —
 * what is happening now, what already happened, what is still to come — so
 * they are three blocks, in that order, and the live one leads.
 *
 * Fixtures with your players in them carry a count, because on this screen
 * "Brighton 2–1 Palace" matters exactly as much as how many of your fifteen
 * were in it.
 */

const ORDER: Row["state"][] = ["live", "done", "pre"];
const HEADINGS: Record<Row["state"], string> = {
  live: "In play",
  done: "Results",
  pre: "To come",
};

/** Kickoff as local time — "Sat 15:00" — or nothing if FPL has not set one. */
function kickoffLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function Scoreboard({ model }: { model: MatchdayModel }) {
  const groups = React.useMemo(() => {
    const by: Record<Row["state"], Row[]> = { live: [], done: [], pre: [] };
    for (const f of model.fixturesRail) by[f.state].push(f);
    // Within a block: the fixtures you have players in first, then by kickoff.
    for (const state of ORDER) {
      by[state].sort(
        (a, b) =>
          b.yourPlayers - a.yourPlayers ||
          String(a.kickoff ?? "").localeCompare(String(b.kickoff ?? "")),
      );
    }
    return by;
  }, [model.fixturesRail]);

  if (model.fixturesRail.length === 0) {
    return (
      <section aria-label="Scoreboard" className="rounded-lg bg-surface-1 card-ring p-6">
        <h2 className="upper-label text-2xs text-ink-lo">Scoreboard</h2>
        <p className="mt-3 text-center text-sm text-ink-lo">
          No fixtures scheduled for GW{model.event.id}.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Scoreboard" className="rounded-lg bg-surface-1 card-ring p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="upper-label text-2xs text-ink-lo">
          GW{model.event.id} scoreboard
        </h2>
        <p className="text-2xs text-ink-lo">
          {groups.live.length > 0
            ? `${groups.live.length} in play`
            : groups.pre.length > 0
              ? `${groups.pre.length} to come`
              : "Round complete"}
        </p>
      </div>

      <div className="mt-3 space-y-4">
        {ORDER.filter((state) => groups[state].length > 0).map((state) => (
          <div key={state}>
            <h3 className="upper-label mb-1.5 flex items-center gap-1.5 text-2xs text-ink-lo">
              {state === "live" && <LiveDot className="!h-1.5 !w-1.5" />}
              {HEADINGS[state]}
              <span className="text-ink-lo/70">{groups[state].length}</span>
            </h3>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {groups[state].map((f) => (
                <FixtureLine key={f.id} f={f} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function FixtureLine({ f }: { f: Row }) {
  const played = f.state !== "pre";
  const kickoff = kickoffLabel(f.kickoff);
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-colors dur-instant",
        f.yourPlayers > 0 ? "bg-surface-0 card-ring" : "hover:bg-surface-3",
      )}
      title={
        f.yourPlayers > 0
          ? `${f.yourPlayers} of your players ${played ? "are" : "will be"} in this match`
          : undefined
      }
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <ClubFlag teamId={f.homeTeamId} />
        <span className="font-medium text-ink-1 num-tabular">{f.homeShort}</span>
        <span
          className={cn(
            "num-tabular tabular-nums",
            played ? "fig-num text-ink-hi" : "text-ink-3",
          )}
        >
          {played ? `${f.homeScore ?? 0}–${f.awayScore ?? 0}` : "v"}
        </span>
        <span className="font-medium text-ink-1 num-tabular">{f.awayShort}</span>
        <ClubFlag teamId={f.awayTeamId} />
      </span>

      <span className="flex shrink-0 items-center gap-2 text-xs text-ink-3 num-tabular">
        {f.yourPlayers > 0 && (
          <span
            aria-label={`${f.yourPlayers} of your players`}
            className="rounded-full bg-brand-wash px-1.5 text-2xs font-semibold text-brand"
          >
            {f.yourPlayers}
          </span>
        )}
        {f.state === "live" && (
          <span className="inline-flex items-center gap-1 text-volt">
            <LiveDot className="!h-1.5 !w-1.5" />
            {Math.min(f.minute, 90)}&prime;
          </span>
        )}
        {f.state === "done" && <span>FT</span>}
        {f.state === "pre" && <span>{kickoff ?? "TBC"}</span>}
      </span>
    </li>
  );
}
