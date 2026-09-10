import { Est } from "@/components/gaffer/Est";
import { cn } from "@/lib/ui/cn";
import type { CareerPace, CareerReport } from "@/lib/engines/career";

/**
 * The seasons before this one.
 *
 * The app has always fetched this and thrown it away — `history.past` was
 * used for one note reading "3 previous seasons" and nothing else.
 *
 * The section says out loud what it cannot show. FPL keeps three numbers per
 * finished season and discards the squads, the transfers and the chip timing,
 * so there is no way to explain a season from here. Leaving that unsaid would
 * invite the reader to assume the app looked at last year's decisions and had
 * no opinion, when the truth is that last year's decisions no longer exist.
 */

const TREND_COPY: Record<CareerReport["trend"], string | null> = {
  improving: "Your rank has moved forward across the seasons on record.",
  declining: "Your rank has drifted back across the seasons on record.",
  steady: "Your rank has held roughly level across the seasons on record.",
  "too-few": null,
};

export function CareerRecord({ report, pace }: { report: CareerReport; pace: CareerPace | null }) {
  if (report.seasons.length === 0) {
    return (
      <section aria-labelledby="career-h" className="rounded-lg bg-surface-1 card-ring p-5">
        <h2 id="career-h" className="upper-label text-2xs text-ink-lo">
          Seasons on record
        </h2>
        <p className="mt-2 max-w-[62ch] text-sm text-ink-mid">
          FPL has no finished seasons on file for this team — this is your first, or the entry
          was made after a rollover. The record starts filling in next May.
        </p>
      </section>
    );
  }

  const trend = TREND_COPY[report.trend];
  // Newest first: the season you remember is the one you want at the top.
  const rows = [...report.seasons].reverse();

  return (
    <section aria-labelledby="career-h" className="rounded-lg bg-surface-1 card-ring p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="career-h" className="upper-label text-2xs text-ink-lo">
          Seasons on record
        </h2>
        <p className="text-2xs text-ink-lo">
          {report.seasons.length} finished {report.seasons.length === 1 ? "season" : "seasons"}
          {report.medianRank != null && (
            <> · median finish {report.medianRank.toLocaleString("en-GB")}</>
          )}
        </p>
      </div>

      <ul className="mt-3 space-y-1.5">
        {rows.map((s) => {
          const isBest = report.seasons.length > 1 && s.season === report.best?.season;
          const improved = s.rankDelta != null && s.rankDelta < 0;
          return (
            <li
              key={s.season}
              className={cn(
                "flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md px-3 py-2.5",
                isBest ? "bg-surface-0 card-ring" : "bg-surface-3/40",
              )}
            >
              <span className="min-w-[4.5rem] font-medium text-ink-1 num-tabular">{s.season}</span>
              <span className="fig-num text-[19px] leading-none text-ink-hi">
                {s.points.toLocaleString("en-GB")}
              </span>
              <span className="text-2xs text-ink-lo">pts</span>
              <span className="text-2xs text-ink-mid num-tabular">
                finished {s.rank.toLocaleString("en-GB")}
              </span>
              {s.rankDelta != null && s.rankDelta !== 0 && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-2xs font-semibold num-tabular",
                    improved ? "bg-surge/15 text-surge" : "bg-flare/15 text-flare",
                  )}
                  title={
                    improved
                      ? "Gained places on the season before"
                      : "Lost places to the season before"
                  }
                >
                  {improved ? "▲" : "▼"} {Math.abs(s.rankDelta).toLocaleString("en-GB")}
                </span>
              )}
              {isBest && <span className="upper-label ml-auto text-2xs text-volt">best</span>}
            </li>
          );
        })}
      </ul>

      {trend && <p className="mt-3 text-sm text-ink-mid">{trend}</p>}
      {report.trend === "too-few" && (
        <p className="mt-3 text-sm text-ink-mid">
          {report.seasons.length === 1
            ? "One finished season is a result, not a pattern."
            : "Two seasons state a movement; a third would make it a direction."}
        </p>
      )}

      {pace && (
        <p className="mt-2 text-sm text-ink-mid">
          This season you are scoring{" "}
          <span className="text-ink-hi num-tabular">{pace.pointsPerGw}</span> a gameweek over{" "}
          {pace.gwsPlayed} — {describe(pace.vsBest)} your best season&apos;s pace and{" "}
          {describe(pace.vsMedian)} your median.
        </p>
      )}

      <p className="mt-4 max-w-[64ch] text-2xs leading-relaxed text-ink-lo">
        {/* The limitation, stated rather than left to be inferred. */}
        FPL keeps three numbers for a finished season — the total, the rank and the name — and
        discards the squads, the transfers and the chip timing at the rollover. So this is the
        record and not the reasons: nothing here can tell you which moves cost you a season,
        because those moves no longer exist to read. A per-gameweek figure{" "}
        <Est method="Total points ÷ 38. A manager who joined mid-season played fewer, and FPL does not publish how many.">
          assumes you played all 38
        </Est>
        .
      </p>
    </section>
  );
}

/** "3.2 ahead of" / "1.8 behind" / "level with" — never a bare signed number. */
function describe(delta: number): string {
  if (delta === 0) return "level with";
  return delta > 0 ? `${delta} ahead of` : `${Math.abs(delta)} behind`;
}
