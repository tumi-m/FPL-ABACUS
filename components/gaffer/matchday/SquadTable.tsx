"use client";

import * as React from "react";
import { Meter } from "@/components/charts/Meter";
import { ClubFlag } from "@/components/gaffer/ClubCrest";
import { LiveDot } from "@/components/gaffer/LiveDot";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";
import { POSITION_SHORT } from "@/lib/ui/format";

type SortKey = "webName" | "minutes" | "livePoints" | "bonus" | "defconCount";

export function SquadTable({ model, settled }: { model: MatchdayModel; settled?: boolean }) {
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "livePoints", dir: -1 });

  const rows = [...model.squad].sort((a, b) => {
    const av = a[sort.key as keyof typeof a];
    const bv = b[sort.key as keyof typeof b];
    if (typeof av === "string" && typeof bv === "string") return sort.dir * av.localeCompare(bv);
    return sort.dir * (Number(av) - Number(bv));
  });

  const th = (key: SortKey, label: string, right = false) => (
    <th
      aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      className={`py-1.5 ${right ? "px-2 text-right" : "pr-2 text-left"} text-2xs uppercase tracking-wide font-semibold text-ink-3`}
    >
      <button
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : -1 }))}
        className="hover:text-ink-1"
      >
        {label}
        {sort.key === key && (sort.dir === 1 ? " ↑" : " ↓")}
      </button>
    </th>
  );

  return (
    <section aria-label="Squad table" className="rounded-lg bg-surface-1 card-ring p-4 md:p-5">
      <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wide text-ink-3">Squad detail</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm num-tabular">
          <thead>
            <tr className="border-b border-hairline">
              {th("webName", "Player")}
              <th className="py-1.5 px-2 text-left text-2xs uppercase tracking-wide font-semibold text-ink-3">Fixture</th>
              {th("minutes", "Min", true)}
              {th("livePoints", "Pts", true)}
              {th("bonus", "Bonus", true)}
              {th("defconCount", "DEFCON", true)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.element} className={`border-b border-hairline last:border-0 ${r.onBench ? "opacity-60" : ""}`}>
                <td className="py-2 pr-2">
                  <span className="flex items-center gap-2">
                    <ClubFlag teamId={r.teamId} className="h-4" />
                    <span className="font-medium text-ink-1">{r.webName}</span>
                  </span>
                  <span className="ml-3 text-xs text-ink-3">{POSITION_SHORT[r.pos]}</span>
                  {r.isCaptain && r.multiplier >= 2 && <span title="Captain" aria-label="Captain" className="ml-1 inline-grid h-4 w-4 place-items-center rounded-full bg-brand align-[1px] text-[9px] font-bold text-brand-ink">C</span>}
                  {r.subbedInFor !== null && <span className="ml-1 text-xs text-brand">⇅</span>}
                  {r.onBench && <span className="ml-1.5 text-2xs uppercase tracking-wide text-ink-3">bench</span>}
                </td>
                <td className="py-2 px-2 text-xs text-ink-2">
                  {r.opponentShort}
                  {r.fixtureState !== "pre" && ` · ${Math.min(r.fixtureMinute, 90)}′`}
                  <StateDot state={r.fixtureState} />
                </td>
                <td className="py-2 px-2 text-right text-ink-2">{r.minutes}</td>
                <td className="py-2 px-2 text-right font-medium text-ink-1">
                  {/* remount on settle so the wash plays exactly once */}
                  <span key={settled ? "settled" : "live"} className={settled ? "inline-block settle-wash" : "inline-block"}>
                    {r.livePoints}
                  </span>
                </td>
                <td className="py-2 px-2 text-right text-ink-2">
                  {r.bonus > 0 ? r.bonus : "—"}
                  {!r.bonusOfficial && r.bonus > 0 && <sup className="text-brand">*</sup>}
                </td>
                <td className="w-28 py-2 pl-2">
                  {r.defconThreshold < 99 ? (
                    <Meter value={r.defconCount / r.defconThreshold} hint={`${r.defconCount}/${r.defconThreshold}`} tone="defcon" />
                  ) : (
                    <span className="text-xs text-ink-3">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-2xs text-ink-3">
        {settled ? "Bonus settled by FPL." : "* projected bonus — final when FPL adds official bonus."}
      </p>
    </section>
  );
}

function StateDot({ state }: { state: "pre" | "live" | "done" }) {
  if (state === "live") return <LiveDot className="ml-1.5 !h-1.5 !w-1.5 align-middle" />;
  if (state === "done") return <span aria-label="finished" className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-hairline-strong align-middle" />;
  return <span aria-label="yet to play" className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full border border-hairline-strong align-middle" />;
}
