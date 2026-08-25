"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/primitives/Table";
import { Input } from "@/components/primitives/Input";
import { formatPrice, POSITION_SHORT } from "@/lib/ui/format";
import { cn } from "@/lib/ui/cn";

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

const PRESETS: Record<string, SortKey> = {
  Attack: "goals",
  Form: "form",
  Value: "ppg",
  Points: "points",
  Minutes: "minutes",
};

export function PlayerExplorer({ rows }: { rows: ExplorerRow[] }) {
  const params = useSearchParams();
  const [q, setQ] = React.useState("");
  const [posFilter, setPosFilter] = React.useState<number | null>(null);
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "form", dir: -1 });

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
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }))} className="hover:text-ink-1">
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
                "h-7 rounded-full px-2.5 text-xs font-medium transition-colors dur-instant",
                posFilter === p ? "bg-surface-3 text-ink-1" : "text-ink-3 hover:text-ink-1",
              )}
            >
              {p === null ? "All" : POSITION_SHORT[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-surface-1 card-ring p-2 md:p-3">
        <Table>
          <TableHeader>
            <TableRow>
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
      <p className="text-xs text-ink-3">Showing top {filtered.length} of {rows.length.toLocaleString()} · presets: {Object.keys(PRESETS).join(" / ")}</p>
    </div>
  );
}
