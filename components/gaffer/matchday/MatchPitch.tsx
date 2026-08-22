"use client";

import * as React from "react";
import Image from "next/image";
import { crest } from "@/lib/ui/format";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

/** 4-row pitch: GK / DEF / MID / FWD with kits, live chips, captain armband. */
export function MatchPitch({ model }: { model: MatchdayModel }) {
  const rows = [1, 2, 3, 4].map((pos) =>
    model.squad.filter((s) => s.pos === pos && !s.onBench).sort((a, b) => b.multiplier - a.multiplier),
  );
  const bench = model.squad.filter((s) => s.onBench);

  return (
    <section aria-label="Your team on the pitch" className="rounded-lg bg-surface-1 card-ring p-4 md:p-5">
      <div
        className="rounded-lg p-3 md:p-5"
        style={{
          background:
            "repeating-linear-gradient(180deg, var(--surface-0) 0px, var(--surface-0) 34px, var(--surface-1) 34px, var(--surface-1) 68px)",
        }}
      >
        <div className="space-y-2">
          {rows.map((row, i) => (
            <ul key={i} className="flex flex-wrap items-stretch justify-center gap-1.5">
              {row.map((p) => (
                <li key={p.element} className="w-[72px]">
                  <PlayerToken row={p} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-hairline pt-3" role="separator" />
      <h3 className="mb-2 mt-3 text-2xs font-semibold uppercase tracking-wide text-ink-3">Bench</h3>
      <ul className="flex flex-wrap gap-1.5">
        {bench.map((p) => (
          <li key={p.element} className="w-[72px] opacity-70">
            <PlayerToken row={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlayerToken({ row }: { row: MatchdayModel["squad"][number] }) {
  const done = row.fixtureState === "done";
  const live = row.fixtureState === "live";
  return (
    <div className={`relative rounded-md px-1 pb-1 pt-1.5 text-center ${done ? "opacity-50" : ""}`}>
      {live && (
        <span aria-hidden className="absolute inset-x-1 top-0 h-[2px] rounded-full bg-brand" />
      )}
      {row.isCaptain && (
        <span aria-label="Captain" title="Captain" className="absolute left-1 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-brand text-[9px] font-bold text-brand-ink">
          C
        </span>
      )}
      {row.subbedInFor !== null && (
        <span aria-label="Auto-substitute" title="Projected auto-sub in" className="absolute right-1 top-0.5 text-xs text-brand">
          ⇅
        </span>
      )}
      {row.teamShort && (
        <Image src={crest(row.teamCode)} alt="" width={28} height={28} className="mx-auto h-7 w-7 object-contain" />
      )}
      <span className="block truncate text-2xs font-medium text-ink-1">{row.webName}</span>
      <span
        className={`mt-0.5 inline-block min-w-6 rounded-sm px-1 text-2xs font-bold num-tabular ${
          live ? "bg-brand text-brand-ink" : done ? "bg-surface-3 text-ink-3" : "bg-surface-3 text-ink-2"
        }`}
      >
        {row.livePoints}
      </span>
    </div>
  );
}
