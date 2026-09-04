import { Est } from "@/components/gaffer/Est";
import { cn } from "@/lib/ui/cn";
import type { GwProfileData } from "@/lib/server/buildGwProfile";

/**
 * The personal blank/double calendar (v10 D7) — Crellin's sheet, but it
 * knows your fifteen.
 *
 * One row per gameweek: how many of your XI play, with doubles and blanks
 * called out. A row beyond FPL's published horizon is a "possible" row — a
 * cup round not yet scheduled can still move it — and says so in words,
 * never as a confirmed count. The best Bench Boost week is simply your
 * fullest scheduled week; the calendar names it and lets you decide.
 */

export function GwProfileCalendar({ profile }: { profile: GwProfileData }) {
  const { rows, benchBoostGw, squadKnown } = profile;
  const busiest = rows.reduce((max, r) => Math.max(max, r.startersPlaying), 0);

  return (
    <section aria-label="Blank and double calendar" className="rounded-lg bg-surface-1 card-ring p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xs font-semibold uppercase tracking-wide text-ink-3">
          {squadKnown ? "Your blank and double weeks" : "The season's fixture calendar"}
        </h2>
        {benchBoostGw != null && (
          <p className="text-2xs text-ink-2">
            Bench Boost would bite hardest in{" "}
            <span className="font-semibold text-ink-1">GW{benchBoostGw}</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 pb-1.5 text-2xs uppercase tracking-wide text-ink-lo">
        <span className="w-12 shrink-0">GW</span>
        <span className="flex-1">Starters out</span>
        <span className="w-28 shrink-0 text-right">Doubles / blanks</span>
      </div>

      <ol className="space-y-1">
        {rows.map((r) => {
          const width = busiest > 0 ? Math.round((r.startersPlaying / busiest) * 100) : 0;
          return (
            <li key={r.gw} className="flex items-center gap-2">
              <span className="w-12 shrink-0 fig-num text-xs text-ink-2">{r.gw}</span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="h-4 shrink-0 rounded-sm bg-surface-3" style={{ width: `${Math.max(width, 2)}%` }} />
                <span className="num-tabular text-xs text-ink-1">
                  <Est
                    method={
                      r.confidence === "scheduled"
                        ? "Counted from FPL's published fixture list for this gameweek."
                        : "Beyond FPL's published schedule — cup rounds can still add blanks or doubles. Counted from the fixtures published so far."
                    }
                  >
                    {String(r.startersPlaying)}
                  </Est>
                </span>
              </span>
              <span className="w-28 shrink-0 text-right text-2xs num-tabular">
                {r.starterDoubles > 0 && (
                  <span className="mr-1 text-positive">
                    <Est method="Doubles counted from the published fixture list; a week beyond it can change.">
                      {`+${r.starterDoubles}`}
                    </Est>
                  </span>
                )}
                {r.starterBlanks > 0 && (
                  <span className={cn(r.confidence === "scheduled" ? "text-critical" : "text-ink-lo")}>
                    <Est method="Blanks counted from the published fixture list; beyond it a blank is the absence of a schedule, not a confirmed one.">
                      {String(r.starterBlanks)}
                    </Est>
                  </span>
                )}
                {r.starterDoubles === 0 && r.starterBlanks === 0 && (
                  <span className="text-ink-lo">{r.confidence === "scheduled" ? "—" : "possible"}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-2.5 text-2xs leading-relaxed text-ink-lo">
        {squadKnown
          ? "Counted for the eleven who would start. Weeks marked possible sit beyond the fixture list FPL has published — a cup round can still add a blank or a double, and the calendar will change when it is drawn."
          : "Set your team ID on the landing page and this becomes your own calendar — who blanks, who doubles, and where the Bench Boost would bite."}
      </p>
    </section>
  );
}