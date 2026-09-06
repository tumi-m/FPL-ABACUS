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
 * Every fixture says what it paid you. A count of your players in a match was
 * the wrong number: three of yours in a game you took two points from is a
 * worse afternoon than one of yours in a game you took fourteen from, and the
 * old pill showed both as a bigger number for the first. Open a line and it
 * names who, so the figure is never something you have to take on trust — and
 * the lines add up to the score in the hero above, which is the only reason a
 * per-match figure is worth printing at all.
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

  // Counted over fixtures that gave you something, not over every fixture you
  // had a player in: a blank is not a match that "paid you 0 from 1".
  const scored = model.fixturesRail.filter((f) => f.state !== "pre" && f.contributors.length > 0);
  const total = scored.reduce((t, f) => t + f.yourPoints, 0);
  const played = scored.length;

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
          {/* What the round has paid you so far, and out of how many matches —
              the same figure the hero shows, arrived at from the other end. */}
          {played > 0 && (
            <span className="text-ink-mid">
              {total} pts from {played} {played === 1 ? "match" : "matches"}
            </span>
          )}
          {played > 0 && " · "}
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
  const [open, setOpen] = React.useState(false);
  const played = f.state !== "pre";
  const kickoff = kickoffLabel(f.kickoff);
  const yours = f.contributors.length > 0;
  // Before a ball is kicked there are no points to report, so the line says
  // how many of yours are in it instead — the only useful thing there is to
  // know about a fixture that has not started.
  const showPoints = played && f.yourPlayers > 0;

  const score = (
    <span className="flex min-w-0 items-center gap-1.5">
      <ClubFlag teamId={f.homeTeamId} />
      <span className="font-medium text-ink-1 num-tabular">{f.homeShort}</span>
      <span className={cn("num-tabular tabular-nums", played ? "fig-num text-ink-hi" : "text-ink-3")}>
        {played ? `${f.homeScore ?? 0}–${f.awayScore ?? 0}` : "v"}
      </span>
      <span className="font-medium text-ink-1 num-tabular">{f.awayShort}</span>
      <ClubFlag teamId={f.awayTeamId} />
    </span>
  );

  const meta = (
    <span className="flex shrink-0 items-center gap-2 text-xs text-ink-3 num-tabular">
      {showPoints ? (
        <span
          className={cn(
            "inline-flex items-baseline gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold",
            f.yourPoints > 0 ? "bg-brand-wash text-brand" : "bg-surface-3 text-ink-lo",
          )}
        >
          <span className="tabular-nums">{f.yourPoints}</span>
          <span className="font-normal opacity-80">pts</span>
        </span>
      ) : (
        f.yourPlayers > 0 && (
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-2xs text-ink-mid">
            {f.yourPlayers} yours
          </span>
        )
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
  );

  const label = showPoints
    ? `${f.homeShort} ${f.homeScore ?? 0}–${f.awayScore ?? 0} ${f.awayShort}. ${f.yourPoints} points for you.`
    : `${f.homeShort} versus ${f.awayShort}. ${f.yourPlayers} of your players.`;

  return (
    <li className={cn("rounded-md", f.yourPlayers > 0 ? "bg-surface-0 card-ring" : "")}>
      {yours ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${label} Show who.`}
          className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors dur-instant hover:bg-surface-3"
        >
          {score}
          {meta}
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-colors dur-instant hover:bg-surface-3">
          {score}
          {meta}
        </div>
      )}

      {yours && open && (
        <ul className="border-t border-line px-2.5 py-1.5">
          {f.contributors.map((c) => (
            <li key={c.element} className="flex items-baseline justify-between gap-3 py-0.5 text-2xs">
              <span className={cn("truncate", c.multiplier === 0 ? "text-ink-lo" : "text-ink-mid")}>
                {c.webName}
                {c.isCaptain && <span className="ml-1 text-brand">(C)</span>}
                {c.multiplier === 0 && <span className="ml-1 text-ink-lo">bench</span>}
              </span>
              <span
                className={cn(
                  "shrink-0 tabular-nums num-tabular",
                  c.multiplier === 0 ? "text-ink-lo" : "text-ink-hi",
                )}
              >
                {c.points}
              </span>
            </li>
          ))}
          {f.yourBenchPoints > 0 && (
            <li className="mt-1 border-t border-line pt-1 text-2xs text-ink-lo">
              {f.yourBenchPoints} of that sat on your bench.
            </li>
          )}
        </ul>
      )}
    </li>
  );
}
