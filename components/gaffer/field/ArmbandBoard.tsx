"use client";

import { useEffect, useState } from "react";
import { Est } from "@/components/gaffer/Est";
import { POSITION_SHORT } from "@/lib/ui/format";
import { cn } from "@/lib/ui/cn";
import type { SquadRow } from "@/lib/engines/matchdayModel";
import type { CaptainRow } from "@/app/api/gaffer/captain/route";

/** Ownership at or above this reads as the template pick. */
const TEMPLATE_EO = 50;
/** At or below this, captaining him is an attacking move rather than a hold. */
const DIFFERENTIAL_EO = 15;
/** Enough to see the shape of the decision without becoming a second squad list. */
const SHOWN = 6;

interface MinutesRow {
  id: number;
  pStart: number | null;
  reliable: boolean;
  note: string;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; gw: number; rows: CaptainRow[]; minutes: Map<number, MinutesRow> }
  | { kind: "failed" };

/**
 * The armband — who to captain in the next unplayed gameweek.
 *
 * The captaincy is the biggest single lever in the game: it doubles one
 * player's return, and getting it wrong costs more than most transfers gain.
 * It deserved a surface of its own rather than a line in an ask card.
 *
 * Three things decide it and all three are here. Projected points say who
 * scores most; the fixture says why; ownership says what the pick is *for* —
 * captaining a player half the game already captains protects a rank, and
 * captaining one nobody owns attacks it. Those are different decisions and a
 * board that ranks on points alone cannot tell them apart.
 */
export function ArmbandBoard({ squad }: { squad: SquadRow[] }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const ids = squad.map((r) => r.element);
  const key = ids.join(",");

  useEffect(() => {
    if (!key) return;
    let live = true;
    setState({ kind: "loading" });
    // The projection and the minutes model are separate reads on purpose:
    // minutes already has a route serving the PeekSheet and the planner, and a
    // second copy of that logic here is how two surfaces start disagreeing.
    Promise.all([
      fetch(`/api/gaffer/captain?players=${encodeURIComponent(key)}`).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      ),
      fetch(`/api/gaffer/minutes?players=${encodeURIComponent(key)}`)
        .then((r) => (r.ok ? r.json() : { players: [] }))
        .catch(() => ({ players: [] })),
    ])
      .then(([cap, min]: [{ gw: number; rows: CaptainRow[] }, { players?: MinutesRow[] }]) => {
        if (!live) return;
        setState({
          kind: "ready",
          gw: cap.gw,
          rows: cap.rows,
          minutes: new Map((min.players ?? []).map((p) => [p.id, p])),
        });
      })
      .catch(() => {
        if (live) setState({ kind: "failed" });
      });
    return () => {
      live = false;
    };
  }, [key]);

  if (state.kind === "failed") {
    return (
      <Shell>
        <p className="text-sm text-ink-lo">
          The armband board could not be projected — FPL did not answer, or the fixture list is not
          published yet. Nothing here is cached from an older week; an out-of-date captaincy call is
          worse than none.
        </p>
      </Shell>
    );
  }
  if (state.kind === "loading") {
    return (
      <Shell>
        <p className="text-sm text-ink-lo">Projecting the week…</p>
      </Shell>
    );
  }

  const byId = new Map(squad.map((r) => [r.element, r]));
  const ranked = [...state.rows]
    .filter((r) => byId.has(r.id))
    // Keepers out. The armband on a goalkeeper is legal and effectively never
    // right, and the fixture model happily projects a shutout high enough to
    // rank one second — a row that reads as a broken board rather than a
    // suggestion, and costs the rest of the list its credibility.
    .filter((r) => byId.get(r.id)!.pos !== 1)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, SHOWN);

  if (ranked.length === 0 || ranked[0].xp <= 0) {
    return (
      <Shell gw={state.gw}>
        <p className="text-sm text-ink-lo">
          Nobody in your fifteen has a fixture in GW{state.gw} that the model can price — a blank
          week, or a squad that has not been picked yet.
        </p>
      </Shell>
    );
  }

  const top = ranked[0];
  const topRow = byId.get(top.id)!;
  const best = top.xp;
  const verdict =
    topRow.eo >= TEMPLATE_EO
      ? "the template pick — this one protects a rank rather than chasing one"
      : topRow.eo <= DIFFERENTIAL_EO
        ? "a differential — it gains on the field if it lands, and loses if it does not"
        : "the pick on points, and owned by enough of the field to be no great gamble";

  return (
    <Shell gw={state.gw}>
      <p className="mb-3 text-sm leading-relaxed text-ink-2">
        <span className="font-medium text-ink-hi">{topRow.webName}</span> — {verdict}.
      </p>

      {/* A ranked list rather than a table. Five columns do not fit a 390px
          phone — the first draft pushed Owned and Starts off the edge, and put
          the fixture meter and the points bar side by side as two blue pills a
          reader could not tell apart. One figure per row, everything else on a
          meta line under the name, and the bar spanning the row as the only
          chart on it. */}
      <ol className="space-y-2">
        {ranked.map((r, i) => {
          const row = byId.get(r.id)!;
          const mins = state.minutes.get(r.id);
          const isPick = i === 0;
          const fixture =
            r.fixtures.length === 0
              ? "blank"
              : r.fixtures.map((f) => `${f.home ? "" : "@"}${f.opponent}`).join(" · ");
          return (
            <li key={r.id} className="border-t border-hairline pt-2 first:border-0 first:pt-0">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1">
                  <span className={cn("font-medium", isPick ? "text-ink-hi" : "text-ink-2")}>
                    {row.webName}
                  </span>
                  <span className="ml-1.5 whitespace-nowrap text-2xs text-ink-lo">
                    {POSITION_SHORT[row.pos]}·{row.teamShort}
                  </span>
                  {row.isCaptain && (
                    <span className="ml-1.5 text-2xs text-volt" title="Your armband this week">
                      armband
                    </span>
                  )}
                  {row.onBench && (
                    <span
                      className="ml-1.5 text-2xs text-ink-lo"
                      title="On your bench — he would have to start to score"
                    >
                      benched
                    </span>
                  )}
                </span>
                <span className={cn("fig-num shrink-0", isPick ? "text-ink-hi" : "text-ink-2")}>
                  <Est method="The planner's own projection for this gameweek — fixture model plus published expectation and form, doubles stacked. An estimate, not FPL's figure.">
                    {r.xp.toFixed(1)}
                  </Est>
                </span>
              </div>

              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-ink-lo">
                <span className="whitespace-nowrap">
                  {fixture}
                  {r.fixtures.length > 1 && (
                    <span className="ml-1 fig-num text-volt" title="A double gameweek">
                      ×{r.fixtures.length}
                    </span>
                  )}
                </span>
                {r.fixtures.length > 0 && (
                  <span className="whitespace-nowrap fig-num" title="FPL's 1–5 fixture difficulty">
                    FDR {r.fixtures[0].difficulty}
                  </span>
                )}
                <span className="whitespace-nowrap fig-num">{row.eo.toFixed(0)}% owned</span>
                {mins?.reliable && mins.pStart != null ? (
                  <span className="whitespace-nowrap fig-num">
                    <Est method="Posterior P(start) from his own appearance history, widened when that history is thin.">
                      {`${Math.round(mins.pStart * 100)}%`}
                    </Est>
                    {" to start"}
                  </span>
                ) : (
                  <span className="whitespace-nowrap" title={mins?.note ?? "Not enough history"}>
                    minutes unmodelled
                  </span>
                )}
              </div>

              {/* the only chart on the row: points against the leader */}
              <div
                aria-hidden
                className={cn("mt-1 h-1 rounded-full", isPick ? "bg-volt" : "bg-brand")}
                style={{ width: `${Math.max(3, (r.xp / best) * 100)}%` }}
              />
            </li>
          );
        })}
      </ol>

      <p className="mt-2 text-2xs leading-relaxed text-ink-lo">
        Ranked on projected points for GW{state.gw}. Keepers are left off — the armband on a
        goalkeeper is legal and effectively never right. Owned is effective ownership in your
        cohort, and a player with too little history says his minutes are unmodelled rather than
        offering a probability dressed up as one.
      </p>
    </Shell>
  );
}

function Shell({ gw, children }: { gw?: number; children: React.ReactNode }) {
  return (
    <section aria-label="The armband" className="rounded-lg bg-surface-1 card-ring p-4 md:p-5">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h2 className="upper-label text-2xs text-ink-lo">The armband</h2>
        {gw != null && <span className="fig-num text-2xs text-ink-lo">GW{gw}</span>}
        <span className="ml-auto text-2xs text-ink-lo">Who to captain next, not who you did</span>
      </div>
      {children}
    </section>
  );
}
