"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/primitives/Table";
import { Input } from "@/components/primitives/Input";
import { formatPrice, POSITION_SHORT } from "@/lib/ui/format";
import { Star } from "@/components/primitives/icons";
import { cn } from "@/lib/ui/cn";
import { WatchStar } from "@/components/gaffer/watch/WatchStar";
import { useWatchlist } from "@/components/gaffer/watch/useWatchlist";

export interface ExplorerRow {
  id: number;
  webName: string;
  pos: number;
  teamId: number;
  teamShort: string;
  price: number;
  status: string;
  sbp: number;
  form: number;
  ppg: number;
  points: number;
  goals: number;
  assists: number;
  minutes: number;
}

type SortKey = "webName" | "price" | "sbp" | "form" | "ppg" | "points" | "goals" | "assists" | "minutes";

/**
 * The sorts, as things you can press.
 *
 * These existed as a lookup table that nothing looked anything up in: the
 * only use of `PRESETS` was printing its own key names in a sentence at the
 * foot of the page — "presets: Attack / Form / Value / Points / Minutes" —
 * under a hundred and twenty rows. The page advertised five controls it had
 * never built, and the sort that did exist lived in the table header, where
 * on a phone eight of the eleven columns are off the right-hand edge.
 */
const PRESETS: { label: string; key: SortKey }[] = [
  { label: "Form", key: "form" },
  { label: "Points", key: "points" },
  { label: "Value", key: "ppg" },
  { label: "Goals", key: "goals" },
  { label: "Assists", key: "assists" },
  { label: "Minutes", key: "minutes" },
  { label: "Price", key: "price" },
  { label: "Owned", key: "sbp" },
];

export function PlayerExplorer({ rows }: { rows: ExplorerRow[] }) {
  const params = useSearchParams();
  const [q, setQ] = React.useState("");
  const [posFilter, setPosFilter] = React.useState<number | null>(null);
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "form", dir: -1 });
  const [watchedOnly, setWatchedOnly] = React.useState(false);
  const { ids: watched } = useWatchlist();

  // ?club=<id> — where the fixture ticker sends you. A club with a run worth
  // buying into is only useful if you can see who plays for it, so the ticker's
  // row headings land here with the club already picked.
  const clubParam = Number(params.get("club"));
  const [club, setClub] = React.useState<number | null>(
    Number.isFinite(clubParam) && clubParam > 0 ? clubParam : null,
  );
  React.useEffect(() => {
    const n = Number(params.get("club"));
    setClub(Number.isFinite(n) && n > 0 ? n : null);
  }, [params]);

  const filtered = rows
    .filter((r) => r.status !== "n")
    .filter((r) => (posFilter ? r.pos === posFilter : true))
    .filter((r) => (club ? r.teamId === club : true))
    .filter((r) => (watchedOnly ? watched.includes(r.id) : true))
    .filter((r) => {
      const needle = q.toLowerCase().trim();
      if (!needle) return true;
      // Searching "ars" should find Arsenal's players, not nobody.
      return r.webName.toLowerCase().includes(needle) || r.teamShort.toLowerCase().includes(needle);
    })
    .sort((a, b) => {
      const av: string | number = a[sort.key];
      const bv: string | number = b[sort.key];
      if (typeof av === "string" && typeof bv === "string") return sort.dir * av.localeCompare(bv);
      return sort.dir * (Number(av) - Number(bv));
    })
    .slice(0, 120);

  const th = (key: SortKey, label: string, right = true) => (
    <TableHead className={right ? "text-right" : ""}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }))}
        aria-label={`Sort by ${label}`}
        className={cn(
          "inline-flex h-9 items-center rounded-sm px-1 transition-colors dur-instant hover:text-ink-1",
          sort.key === key && "text-ink-hi",
        )}
      >
        {label}
        {sort.key === key && (sort.dir === 1 ? " ↑" : " ↓")}
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold tracking-tight">
          Players
          {club && (
            <span className="ml-2 align-middle text-sm font-normal text-ink-3">
              {rows.find((r) => r.teamId === club)?.teamShort ?? `club ${club}`}
              {" · "}
              <button
                type="button"
                onClick={() => setClub(null)}
                className="underline decoration-dotted transition-colors dur-instant hover:text-ink-1"
              >
                show all clubs
              </button>
            </span>
          )}
        </h1>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          aria-label="Search players"
          className="h-9 w-44 text-sm"
        />
        <div role="group" aria-label="Position filter" className="inline-flex rounded-full glass-edge p-0.5">
          {[null, 1, 2, 3, 4].map((p) => (
            <button
              key={String(p)}
              onClick={() => setPosFilter(p)}
              aria-pressed={posFilter === p}
              className={cn(
                "h-9 rounded-full px-3 text-xs font-medium transition-colors dur-instant",
                posFilter === p ? "bg-surface-3 text-ink-1" : "text-ink-3 hover:text-ink-1",
              )}
            >
              {p === null ? "All" : POSITION_SHORT[p]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setWatchedOnly((v) => !v)}
          aria-pressed={watchedOnly}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full glass-edge px-3 text-xs font-medium transition-colors dur-instant",
            watchedOnly ? "text-amber" : "text-ink-3 hover:text-ink-1",
          )}
        >
          <Star filled={watchedOnly} width={13} height={13} />
          Watching
          <span className="tabular-nums text-ink-3">{watched.length}</span>
        </button>
      </div>

      {/* The sort, where you can reach it. Pressing the live one turns it
          round, which is the same gesture the column headings use. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="upper-label text-2xs text-ink-lo">Sort by</span>
        <div role="group" aria-label="Sort players by" className="flex flex-wrap gap-1">
          {PRESETS.map(({ label, key }) => {
            const live = sort.key === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setSort((prev) => ({ key, dir: prev.key === key ? ((-prev.dir) as 1 | -1) : -1 }))
                }
                aria-pressed={live}
                className={cn(
                  "skewed inline-flex h-9 items-center gap-1 rounded-md px-3 text-2xs upper-label-tight transition-colors dur-instant",
                  live
                    ? "bg-volt font-semibold text-on-accent"
                    : "bg-raised text-ink-mid card-ring hover:text-ink-hi",
                )}
              >
                <span>
                  {label}
                  {live && <span aria-hidden>{sort.dir === 1 ? " ↑" : " ↓"}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg bg-surface-1 card-ring p-2 md:p-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-11">
                <span className="sr-only">Watchlist</span>
              </TableHead>
              {th("webName", "Player", false)}
              <TableHead>Team</TableHead>
              {th("price", "Price")}
              {th("form", "Form")}
              {th("ppg", "PPG")}
              {th("points", "Pts")}
              {th("goals", "G")}
              {th("assists", "A")}
              {th("minutes", "Min")}
              {th("sbp", "Owned%")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="py-0 pr-0">
                  <WatchStar id={r.id} name={r.webName} />
                </TableCell>
                <TableCell>
                  <Link href={`/players/${r.id}`} className="font-medium text-ink-1 hover:text-brand">
                    {r.webName}
                  </Link>
                  <span className="ml-1.5 text-xs text-ink-3">{POSITION_SHORT[r.pos]}</span>
                  {r.status === "d" && <span title="Doubtful" className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-warning align-middle" />}
                  {(r.status === "i" || r.status === "s" || r.status === "u") && (
                    <span title="Unavailable" className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-critical align-middle" />
                  )}
                </TableCell>
                <TableCell className="text-ink-3">{r.teamShort}</TableCell>
                <TableCell className="text-right text-ink-2">{formatPrice(r.price)}</TableCell>
                <TableCell className="text-right font-medium text-ink-1">{r.form}</TableCell>
                <TableCell className="text-right text-ink-2">{r.ppg}</TableCell>
                <TableCell className="text-right text-ink-2">{r.points}</TableCell>
                <TableCell className="text-right text-ink-2">{r.goals}</TableCell>
                <TableCell className="text-right text-ink-2">{r.assists}</TableCell>
                <TableCell className="text-right text-ink-2">{r.minutes}</TableCell>
                <TableCell className="text-right text-ink-3">{r.sbp}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {watchedOnly && watched.length === 0 ? (
        <p className="text-xs text-ink-3">
          Nothing starred yet. Tap a star to keep a player in view — the list lives in this browser, so it
          stays private and does not follow you to another device.
        </p>
      ) : (
        <p className="text-xs text-ink-3">
          Showing {filtered.length} of {rows.length.toLocaleString()} players, sorted by{" "}
          {PRESETS.find((preset) => preset.key === sort.key)?.label ?? sort.key}.
        </p>
      )}
    </div>
  );
}
