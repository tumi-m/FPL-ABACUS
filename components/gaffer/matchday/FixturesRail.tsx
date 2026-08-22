"use client";

import type { MatchdayModel } from "@/lib/engines/matchdayModel";
import { ClubFlag } from "@/components/gaffer/ClubCrest";
import { LiveDot } from "@/components/gaffer/LiveDot";

export function FixturesRail({ model }: { model: MatchdayModel }) {
  return (
    <section aria-label="Fixtures" className="rounded-lg bg-surface-1 card-ring p-5">
      <h2 className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Fixtures</h2>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {model.fixturesRail.map((f) => (
          <li
            key={f.id}
            className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors dur-instant hover:bg-surface-3"
            title={f.yourPlayers > 0 ? `${f.yourPlayers} of your players involved` : undefined}
          >
            <span className="flex items-center gap-2">
              <ClubFlag teamId={f.homeTeamId} />
              <span className="font-medium text-ink-1 num-tabular">{f.homeShort}</span>
              <span className="text-ink-3 num-tabular">{f.homeScore ?? "–"}–{f.awayScore ?? "–"}</span>
              <span className="font-medium text-ink-1 num-tabular">{f.awayShort}</span>
              <ClubFlag teamId={f.awayTeamId} />
            </span>
            <span className="flex items-center gap-2 text-xs text-ink-3 num-tabular">
              {f.yourPlayers > 0 && (
                <span aria-label={`${f.yourPlayers} of your players`} className="rounded-full bg-brand-wash px-1.5 text-2xs font-semibold text-brand">
                  {f.yourPlayers}
                </span>
              )}
              {f.state === "live" && (
                <>
                  <LiveDot className="!h-1.5 !w-1.5" />
                  {Math.min(f.minute, 90)}&prime;
                </>
              )}
              {f.state === "done" && "FT"}
              {f.state === "pre" && "—"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
