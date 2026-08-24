"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Prize-condition filter rail for league standings. Collapsed behind a toggle
 * until asked — the standings table is the page. Every control writes into
 * the URL (server renders stay pure); empty value removes the condition.
 */
export function LeagueFilters({ basePath, disabled }: { basePath: string; disabled?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [minGw, setMinGw] = React.useState(params.get("minGw") ?? "");
  const [topN, setTopN] = React.useState(params.get("topN") ?? "");
  const [open, setOpen] = React.useState(
    Boolean(params.get("q") || params.get("minGw") || params.get("topN")),
  );

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(params);
    next.delete("page");
    const set = (k: string, v: string) => (v.trim() === "" ? next.delete(k) : next.set(k, v.trim()));
    set("q", q);
    set("minGw", minGw);
    set("topN", topN);
    router.push(`${basePath}?${next.toString()}`, { scroll: false });
  };

  const inputCls =
    "h-9 w-full rounded-md border border-(--line) bg-raised px-2.5 text-sm text-ink-hi placeholder:text-ink-lo focus:border-(--volt) focus:outline-none";

  if (!open) {
    const anyActive = Boolean(q || minGw || topN);
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="skewed inline-flex h-9 items-center rounded-md bg-raised card-ring px-4 text-xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
      >
        {anyActive ? "Filters · on" : "Filters"}
      </button>
    );
  }

  return (
    <form onSubmit={apply} className="flex flex-wrap items-end gap-2 rounded-lg bg-surface-1 card-ring p-3" aria-label="Filter standings">
      <div className="w-full sm:w-44">
        <label htmlFor="lf-q" className="upper-label mb-1 block text-2xs text-ink-lo">
          Name contains
        </label>
        <input id="lf-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="manager or team" className={inputCls} disabled={disabled} />
      </div>
      <div className="w-24">
        <label htmlFor="lf-min-gw" className="upper-label mb-1 block text-2xs text-ink-lo">
          Min GW pts
        </label>
        <input id="lf-min-gw" type="number" inputMode="numeric" min={0} value={minGw} onChange={(e) => setMinGw(e.target.value)} placeholder="60" className={`${inputCls} num-tabular`} disabled={disabled} />
      </div>
      <div className="w-28">
        <label htmlFor="lf-top-n" className="upper-label mb-1 block text-2xs text-ink-lo">
          Top N in league
        </label>
        <input id="lf-top-n" type="number" inputMode="numeric" min={1} value={topN} onChange={(e) => setTopN(e.target.value)} placeholder="500" className={`${inputCls} num-tabular`} disabled={disabled} />
      </div>
      <button type="submit" className="skewed inline-flex h-9 items-center rounded-md bg-volt px-4 text-sm uppercase-label font-semibold text-on-accent transition-transform dur-instant hover:-translate-y-px" disabled={disabled}>
        Filter
      </button>
      <button
        type="button"
        onClick={() => {
          setQ("");
          setMinGw("");
          setTopN("");
          setOpen(false);
          const next = new URLSearchParams(params);
          next.delete("page");
          ["q", "minGw", "topN"].forEach((k) => next.delete(k));
          router.push(`${basePath}?${next.toString()}`, { scroll: false });
        }}
        className="inline-flex h-9 items-center rounded-md px-3 text-sm text-ink-mid transition-colors dur-instant hover:text-ink-hi"
      >
        Clear
      </button>
    </form>
  );
}
