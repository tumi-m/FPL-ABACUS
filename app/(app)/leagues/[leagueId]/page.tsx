import Link from "next/link";
import { cookies } from "next/headers";
import { getStandings, getHistory } from "@/lib/fpl/endpoints";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { ClubFlag } from "@/components/gaffer/ClubCrest";
import { COPY } from "@/lib/copy/deck";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/primitives/Table";
import { LeagueFilters } from "./LeagueFilters";

export const dynamic = "force-dynamic";
export const metadata = { title: "League" };

const PAGE_SIZE = 50;

type StandingRow = {
  event_total: number;
  player_name: string;
  rank: number;
  last_rank: number;
  total: number;
  entry: number;
  entry_name: string;
};

function movementOf(r: StandingRow): { delta: number; moved: boolean } {
  // last_rank is 0 before the season starts; equal ranks mean held position.
  if (!r.last_rank || r.last_rank <= 0 || r.last_rank === r.rank) return { delta: 0, moved: false };
  return { delta: r.last_rank - r.rank, moved: true };
}

const MOVEMENT_TONE: Record<string, { rail: string; text: string }> = {
  up: { rail: "var(--surge)", text: "text-surge" },
  down: { rail: "var(--flare)", text: "text-flare" },
  same: { rail: "var(--line)", text: "text-ink-lo" },
};

type View = "season" | "gw" | "month";
const VIEWS: readonly View[] = ["season", "gw", "month"];

export default async function LeagueDetail({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ page?: string; view?: string; q?: string; minGw?: string; topN?: string }>;
}) {
  const { leagueId } = await params;
  const sp = await searchParams;
  const { page: pageParam } = sp;
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "season";
  const qFilter = (sp.q ?? "").trim().toLowerCase();
  const minGwFilter = Math.max(0, Number(sp.minGw) || 0);
  const topNFilter = Number(sp.topN) > 0 ? Number(sp.topN) : null;
  const id = Number(leagueId);
  if (!Number.isFinite(id)) {
    return <p className="rounded-lg bg-surface-1 card-ring p-8 text-sm text-ink-2">Unknown league.</p>;
  }

  const store = await cookies();
  const teamId = Number(store.get("gaffer_team")?.value ?? "") || null;

  // How many upstream pages the user has asked to see (cumulative render).
  // Month view clamps to page 1 — per-entry history fetches are capped at 50.
  const requested = view === "month" ? 1 : Math.max(1, Math.min(20, Number(pageParam) || 1));

  const bootPromise = getBootstrapLite();
  // Page 1 carries the league meta AND the authoritative has_next flag.
  const firstPromise = getStandings(id, 1)
    .then((s) => s)
    .catch(() => null);
  const restPromises = Array.from({ length: requested - 1 }, (_, i) =>
    getStandings(id, i + 2)
      .then((s) => ({ results: s.standings.results as StandingRow[], hasMore: s.standings.has_next }))
      .catch(() => ({ results: [] as StandingRow[], hasMore: false })),
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
          {COPY.standingsDown.title} — {COPY.standingsDown.body}
        </p>
      </div>
    );
  }
  const rest = await Promise.all(restPromises);

  const leagueName = first.league.name;
  const memberCount = first.league.max_entries;

  const seen = new Set<number>();
  const allRows = ([first.standings.results, ...rest.map((r) => r.results)] as StandingRow[][])
    .flat()
    .filter((r) => (seen.has(r.entry) ? false : (seen.add(r.entry), true)));

  // Prize-condition filters — applied over the loaded page set.
  let rows = allRows.filter((r) => {
    if (qFilter && !`${r.entry_name} ${r.player_name}`.toLowerCase().includes(qFilter)) return false;
    if (minGwFilter > 0 && r.event_total < minGwFilter) return false;
    if (topNFilter != null && r.rank > topNFilter) return false;
    return true;
  });

  // Month view — calendar-month points per manager from cached entry histories.
  let monthLabel = "";
  const monthPts = new Map<number, number>();
  if (view === "month") {
    const now = new Date();
    monthLabel = now.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthGwIds = new Set(
      boot.events.filter((e) => e.deadline_time?.startsWith(ym) && (e.finished || e.is_current)).map((e) => e.id),
    );
    const histories = await Promise.all(
      rows.map((r) =>
        getHistory(r.entry)
          .then((h) => h.current.filter((g) => monthGwIds.has(g.event)).reduce((s, g) => s + g.points, 0))
          .catch(() => null),
      ),
    );
    rows.forEach((r, i) => {
      if (histories[i] != null) monthPts.set(r.entry, histories[i]);
    });
  }

  // View ordering — season keeps FPL rank order; gw/month re-sort by the metric.
  if (view === "gw") rows = [...rows].sort((a, b) => b.event_total - a.event_total || b.total - a.total);
  if (view === "month") rows = [...rows].sort((a, b) => (monthPts.get(b.entry) ?? -1) - (monthPts.get(a.entry) ?? -1) || b.total - a.total);
  const displayPos = (r: StandingRow, i: number) => (view === "season" ? r.rank : i + 1);
  const metricOf = (r: StandingRow) => (view === "season" || view === "gw" ? r.event_total : monthPts.get(r.entry));
  const metricName = view === "month" ? `Month${monthLabel ? ` · ${monthLabel}` : ""}` : view === "gw" ? "Gameweek" : "Season";

  // Toggle hrefs carry every active filter forward.
  const viewHref = (v: View, page?: number) => {
    const p = new URLSearchParams();
    if (v !== "season") p.set("view", v);
    if (page != null && page > 1) p.set("page", String(page));
    for (const k of ["q", "minGw", "topN"] as const) {
      const val = sp[k];
      if (val) p.set(k, val);
    }
    const s = p.toString();
    return `/leagues/${id}${s ? `?${s}` : ""}`;
  };

  // Upstream is the source of truth for whether another page exists.
  const lastPageHasMore = rest.length > 0 ? rest[rest.length - 1].hasMore : first.standings.has_next;
  const hasNext = lastPageHasMore && rows.length >= PAGE_SIZE;

  // Summary strip — facts over the rows actually shown, never the whole league.
  const metricVals = rows.map((r) => metricOf(r)).filter((v): v is number => v != null);
  const avgMetric = metricVals.length ? metricVals.reduce((s, v) => s + v, 0) / metricVals.length : 0;
  const spreadMetric = metricVals.length ? Math.max(...metricVals) - Math.min(...metricVals) : 0;
  const bestMetric = metricVals.length ? Math.max(...metricVals) : 0;

  return (
    <div className="space-y-4">
      <Link
        href="/leagues"
        className="inline-flex h-11 items-center rounded-md px-2 -ml-2 text-sm font-medium text-ink-mid transition-colors dur-instant hover:text-ink-hi"
      >
        ← All leagues
      </Link>

      {/* broadcast lower-third — match-graphic header per style guide §7 */}
      <header className="flex overflow-hidden rounded-[4px] card-lift" aria-label={`${leagueName} standings`}>
        <span aria-hidden className="skewed w-[12px] shrink-0 scale-x-[1.4]" style={{ background: "var(--volt)" }} />
        <div className="flex flex-1 flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 md:px-5" style={{ background: "linear-gradient(180deg,var(--bg-overlay),var(--bg-raised))" }}>
          <div className="min-w-0">
            <h1 className="fig-num truncate text-[22px] leading-none">{leagueName}</h1>
            <p className="upper-label mt-1.5 text-2xs text-ink-lo">
              GW{currentGw}
              {memberCount != null && memberCount > 0 ? ` · ${memberCount.toLocaleString("en-GB")} managers` : ""} ·
              showing {rows.length} · tap a manager to compare
            </p>
          </div>
          {/* summary strip — reflects the active view's metric */}
          <dl className="flex items-end gap-6 md:gap-8">
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Avg {metricName === "Gameweek" ? "GW" : metricName.split(" · ")[0]}</dt>
              <dd className="hero-figure fig-num mt-0.5 leading-none" aria-label={`Average ${metricName} score ${avgMetric.toFixed(1)} across the managers shown`}>
                {avgMetric.toFixed(1)}
              </dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Spread</dt>
              <dd className="fig-num mt-0.5 text-xl leading-none text-ink-2" aria-label={`Spread ${spreadMetric} points between best and worst ${metricName} shown`}>
                {spreadMetric}
              </dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Best</dt>
              <dd className="fig-num mt-0.5 text-xl leading-none text-ink-2" aria-label={`Best ${metricName} score ${bestMetric}`}>
                {bestMetric}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      {/* view toggle — season / gameweek / month; prize filters ride along */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <nav aria-label="Standings view" className="flex flex-wrap gap-2">
          {VIEWS.map((v) => {
            const label = v === "season" ? "Season" : v === "gw" ? "Gameweek" : `Month${monthLabel ? ` · ${monthLabel}` : ""}`;
            const active = view === v;
            return (
              <Link
                key={v}
                href={viewHref(v)}
                scroll={false}
                role="button"
                aria-current={active ? "true" : undefined}
                className={`skewed inline-flex h-9 items-center rounded-md px-4 text-sm uppercase-label font-semibold transition-colors dur-instant ${
                  active ? "bg-volt text-on-accent" : "bg-raised text-ink-mid card-ring hover:text-ink-hi"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        {view === "month" && rows.length > 0 && (
          <p className="text-2xs text-ink-lo">Month totals computed for the first 50 managers</p>
        )}
      </div>
      <LeagueFilters basePath={`/leagues/${id}`} />

      <div className="rounded-lg bg-surface-1 card-ring p-2 md:p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-right">{view === "month" ? "Month" : "GW"}</TableHead>
              {view === "season" && <TableHead className="text-right">Move</TableHead>}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, idx) => {
              const move = movementOf(r);
              const tone = !move.moved ? MOVEMENT_TONE.same : move.delta > 0 ? MOVEMENT_TONE.up : MOVEMENT_TONE.down;
              const you = teamId != null && r.entry === teamId;
              return (
                <TableRow
                  key={r.entry}
                  className={you ? "bg-surface-3 [box-shadow:inset_2px_0_0_var(--volt)] hover:bg-surface-3" : undefined}
                  aria-label={you ? `${r.entry_name}, position ${r.rank}, this is you` : undefined}
                >
                  <TableCell className="relative text-ink-3 num-tabular">
                    <ClubFlag teamId={null} colorVar={tone.rail} className="absolute left-0 top-1/2 h-6 -translate-y-1/2" />
                    <span className="pl-2">{displayPos(r, idx)}</span>
                  </TableCell>
                  <TableCell className="font-medium text-ink-hi">
                    {you ? (
                      <>
                        {r.entry_name}
                        <span className="upper-label ml-2 inline-block rounded-[3px] bg-volt px-1.5 py-0.5 align-middle text-[9px] font-bold text-on-accent">
                          You
                        </span>
                      </>
                    ) : (
                      <Link
                        href={`/field?mode=points&compare=${r.entry}`}
                        title="Compare head-to-head on the Field"
                        className="transition-colors dur-instant hover:text-volt"
                      >
                        {r.entry_name}
                      </Link>
                    )}
                    <span className="block text-xs font-normal text-ink-lo">{r.player_name}</span>
                  </TableCell>
                  <TableCell className="text-right text-ink-2 num-tabular">{metricOf(r) ?? "—"}</TableCell>
                  {view === "season" && (
                    <TableCell className="text-right num-tabular">
                      {move.moved ? (
                        <span
                          aria-label={move.delta > 0 ? `moved up ${move.delta}` : `moved down ${Math.abs(move.delta)}`}
                          className={`inline-flex items-center justify-end gap-1 ${tone.text}`}
                        >
                          <span aria-hidden className="text-[13px] leading-none">{move.delta > 0 ? "▲" : "▼"}</span>
                          <span className="text-[15px] font-bold leading-none">{Math.abs(move.delta)}</span>
                        </span>
                      ) : (
                        <span aria-label="no movement" title="Held position" className="inline-flex items-center align-middle">
                          <span className="inline-block h-1.5 w-10 rounded-full bg-line-hi" />
                        </span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-medium num-tabular">{r.total.toLocaleString("en-GB")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* centred pagination — appends the next 50 without losing position */}
      <div className="flex justify-center">
        {rows.length >= PAGE_SIZE && hasNext && view !== "month" ? (
          <Link
            href={viewHref(view, requested + 1)}
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
