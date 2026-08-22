import Link from "next/link";
import { getStandings } from "@/lib/fpl/endpoints";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/primitives/Table";

export const dynamic = "force-dynamic";

export default async function LeagueDetail({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const id = Number(leagueId);
  if (!Number.isFinite(id)) {
    return <p className="rounded-lg bg-surface-1 card-ring p-8 text-sm text-ink-2">Unknown league.</p>;
  }

  const [standings, boot] = await Promise.all([getStandings(id, 1), getBootstrapLite()]);
  const currentGw = boot.events.find((e) => e.is_current)?.id ?? 1;
  const rows = standings.standings.results.slice(0, 50);

  return (
    <div className="space-y-4">
      <header>
        <Link href="/leagues" className="text-xs text-ink-3 hover:text-ink-1">
          ← All leagues
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{standings.league.name}</h1>
        <p className="text-sm text-ink-3 num-tabular">GW{currentGw} · page 1 of live standings</p>
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
                <TableCell className="text-ink-3">{r.rank}</TableCell>
                <TableCell className="font-medium text-ink-1">{r.entry_name}</TableCell>
                <TableCell className="text-right text-ink-2 num-tabular">{r.event_total}</TableCell>
                <TableCell className="text-right font-medium num-tabular">{r.total.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-ink-3">
        Rival Radar (live win probability per rival), captain grid and differentials land with the Monte Carlo wiring.
      </p>
    </div>
  );
}
