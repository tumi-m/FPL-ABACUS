import Link from "next/link";
import { getStandings } from "@/lib/fpl/endpoints";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/primitives/Table";

export const dynamic = "force-dynamic";
export const metadata = { title: "League" };

const PAGE_SIZE = 50;

export default async function LeagueDetail({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { leagueId } = await params;
  const { page: pageParam } = await searchParams;
  const id = Number(leagueId);
  if (!Number.isFinite(id)) {
    return <p className="rounded-lg bg-surface-1 card-ring p-8 text-sm text-ink-2">Unknown league.</p>;
  }

  // How many upstream pages the user has asked to see (cumulative render).
  const requested = Math.max(1, Math.min(20, Number(pageParam) || 1));

  const bootPromise = getBootstrapLite();
  // Page 1 carries the league meta AND the authoritative has_next flag.
  const firstPromise = getStandings(id, 1)
    .then((s) => s)
    .catch(() => null);
  const restPromises = Array.from({ length: requested - 1 }, (_, i) =>
    getStandings(id, i + 2)
      .then((s) => ({ results: s.standings.results, hasMore: s.standings.has_next }))
      .catch(() => ({ results: [], hasMore: false })),
  );

  const [boot, first] = await Promise.all([bootPromise, firstPromise]);
  const currentGw = boot.events.find((e) => e.is_current)?.id ?? 1;

  if (!first) {
    return (
      <div className="space-y-4">
        <Link
          href="/leagues"
          className="inline-flex h-10 items-center rounded-md px-2 -ml-2 text-sm text-ink-mid transition-colors dur-instant hover:text-ink-hi"
        >
          ← All leagues
        </Link>
        <p className="rounded-lg bg-surface-1 card-ring p-10 text-center text-sm text-ink-lo">
          Couldn&apos;t load standings for this league right now — FPL may be busy. Try again shortly.
        </p>
      </div>
    );
  }
  const rest = await Promise.all(restPromises);

  const leagueName = first.league.name;
  const memberCount = first.league.max_entries;

  const seen = new Set<number>();
  const rows = [first.standings.results, ...rest.map((r) => r.results)]
    .flat()
    .filter((r) => (seen.has(r.entry) ? false : (seen.add(r.entry), true)));

  // Upstream is the source of truth for whether another page exists.
  const lastPageHasMore = rest.length > 0 ? rest[rest.length - 1].hasMore : first.standings.has_next;
  const hasNext = lastPageHasMore && rows.length >= PAGE_SIZE;

  return (
    <div className="space-y-4">
      <header>
        <Link
          href="/leagues"
          className="inline-flex h-10 items-center rounded-md px-2 -ml-2 text-sm text-ink-mid transition-colors dur-instant hover:text-ink-hi"
        >
          ← All leagues
        </Link>
        <h1 className="fig-num mt-1 text-[22px] leading-none">{leagueName}</h1>
        <p className="mt-1 text-2xs uppercase-label text-ink-lo">
          GW{currentGw}
          {memberCount != null && memberCount > 0
            ? ` · ${memberCount.toLocaleString("en-GB")} managers`
            : ""}{" "}
          · showing {rows.length}
        </p>
      </header>

      <div className="rounded-lg bg-surface-1 card-ring p-2 md:p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-right">GW</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.entry}>
                <TableCell className="text-ink-3 num-tabular">{r.rank}</TableCell>
                <TableCell className="font-medium text-ink-hi">
                  {r.entry_name}
                  <span className="block text-xs font-normal text-ink-lo">{r.player_name}</span>
                </TableCell>
                <TableCell className="text-right text-ink-2 num-tabular">{r.event_total}</TableCell>
                <TableCell className="text-right font-medium num-tabular">
                  {r.total.toLocaleString("en-GB")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* centred pagination — appends the next 50 without losing position */}
      <div className="flex justify-center">
        {rows.length >= PAGE_SIZE && hasNext ? (
          <Link
            href={`/leagues/${id}?page=${requested + 1}`}
            role="button"
            className="skewed inline-flex h-11 items-center rounded-md bg-raised px-6 text-sm uppercase-label text-ink-hi card-ring transition-colors dur-instant hover:bg-surface-3"
          >
            <span>Load 50 more</span>
          </Link>
        ) : (
          <p className="text-xs text-ink-lo">
            {rows.length > 0 ? "End of standings." : "Standings publish after GW1 is final."}
          </p>
        )}
      </div>
    </div>
  );
}
