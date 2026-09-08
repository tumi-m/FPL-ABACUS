import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getEntry } from "@/lib/fpl/endpoints";
import { PageHeader } from "@/components/gaffer/PageHeader";
import { cn } from "@/lib/ui/cn";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leagues",
  description: "Your leagues and the cohort: standings, month form and the gw view." };

/**
 * The leagues page.
 *
 * It used to be ten identical cards carrying a name and the line
 * "You are #1 · s" — where the "s" was FPL's own `league_type` enum, printed
 * raw at a manager who has no idea it means "one of the leagues FPL put you
 * in". Two numbers the API already sends with every league, the size and
 * last week's rank, were fetched and thrown away.
 *
 * So: your rank against the size of the field it was won in, which way it
 * moved since last week, and a track showing where in that field you sit.
 * The leagues your friends made come first, because those are the ones
 * anybody actually cares about; the eight FPL enrols you in automatically
 * follow.
 */

/** FPL's own words for its enum: `x` is a league somebody made and invited you to. */
const INVITE = "x";

/** Below this, "first of five" says everything a percentage would obscure. */
const PERCENTILE_FLOOR = 100;

function ordinalPercent(rank: number, size: number): string | null {
  if (!Number.isFinite(rank) || !Number.isFinite(size) || size <= 0 || rank <= 0) return null;
  // A percentile of a league of five is arithmetic, not information: winning
  // it reads back as "top 20%", which sounds like a worse result than it is.
  // The rank and the size are already on the card and say it better.
  if (size < PERCENTILE_FLOOR) return null;
  const pct = (rank / size) * 100;
  // Rounding 0.0001% to "0%" claims a perfection nobody has; below a tenth
  // the honest statement is the bound, not the number.
  if (pct < 0.1) return "top 0.1%";
  return `top ${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

export default async function LeaguesPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/");

  const entry = await getEntry(teamId);
  const leagues = entry.leagues.classic ?? [];
  const invite = leagues.filter((l) => l.league_type === INVITE);
  const global = leagues.filter((l) => l.league_type !== INVITE);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mini-leagues"
        meta={`${leagues.length} league${leagues.length === 1 ? "" : "s"} · rank, movement and the size of the field`}
      />

      {leagues.length === 0 && (
        <p className="rounded-lg bg-surface-1 card-ring p-8 text-center text-sm text-ink-2">
          No classic leagues found for this entry.
        </p>
      )}

      {invite.length > 0 && <Group title="Leagues you were invited to" leagues={invite} />}
      {global.length > 0 && (
        <Group
          title="Leagues FPL puts everyone in"
          hint="Your club, your country, your start week and the overall table — nobody chose these."
          leagues={global}
        />
      )}
    </div>
  );
}

type League = Awaited<ReturnType<typeof getEntry>>["leagues"]["classic"][number];

function Group({ title, hint, leagues }: { title: string; hint?: string; leagues: League[] }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-ink-hi">
          <span aria-hidden className="skewed h-3.5 w-1 rounded-[1px] bg-volt" />
          <span className="upper-label text-xs">{title}</span>
        </h2>
        <span aria-hidden className="hidden h-px min-w-6 flex-1 bg-line sm:block" />
      </div>
      {hint && <p className="text-2xs text-ink-lo">{hint}</p>}
      <ul className="grid gap-2 md:grid-cols-2">
        {leagues.map((l) => (
          <li key={l.id}>
            <LeagueCard league={l} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LeagueCard({ league: l }: { league: League }) {
  const size = l.rank_count ?? null;
  const rank = l.entry_rank;
  // A last rank of 0 is FPL's "there wasn't one" — a first week, or a league
  // you joined after it started. It is not a rank of zero, and it must never
  // be subtracted as though it were.
  const last = l.entry_last_rank && l.entry_last_rank > 0 ? l.entry_last_rank : null;
  const moved = rank != null && last != null ? last - rank : null;
  const percent = rank != null && size != null ? ordinalPercent(rank, size) : null;
  // How much of the field is behind you, 0 to 1.
  //
  // The obvious expression is rank/size, and it is backwards: first of
  // 688,131 would draw an empty bar and last place a full one, so the best
  // rank in the app would look like the worst thing on the card. Fuller has
  // to mean better.
  const ahead = rank != null && size != null && size > 1 ? Math.min(1, (size - rank) / (size - 1)) : null;

  return (
    <Link
      href={`/leagues/${l.id}`}
      className="block rounded-lg has-gloss bg-surface-1 p-4 card-ring transition-colors dur-instant hover:bg-surface-3"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 flex-1 truncate font-medium text-ink-1">{l.name}</span>
        {moved != null && moved !== 0 && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold num-tabular",
              moved > 0 ? "bg-surge/15 text-surge" : "bg-flare/15 text-flare",
            )}
          >
            {moved > 0 ? "▲" : "▼"} {Math.abs(moved).toLocaleString("en-GB")}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="fig-num text-[26px] leading-none text-ink-hi">
          {rank != null ? `#${rank.toLocaleString("en-GB")}` : "—"}
        </span>
        {size != null && (
          <span className="text-2xs text-ink-lo num-tabular">
            of {size.toLocaleString("en-GB")}
          </span>
        )}
        {percent && <span className="ml-auto text-2xs text-ink-mid">{percent}</span>}
      </div>

      {ahead != null && (
        // The share of the league you are ahead of. Scale-free, so a table of
        // nine million and a table of twelve read the same way.
        <div className="mt-2.5">
          <div aria-hidden className="h-1 rounded-full bg-sunk">
            <div
              className="h-full rounded-full bg-volt"
              style={{ width: `${Math.max(1.5, ahead * 100)}%` }}
            />
          </div>
          <p className="sr-only">
            Ahead of {Math.round(ahead * 100)}% of this league.
          </p>
        </div>
      )}

      {rank == null && (
        <p className="mt-2 text-2xs text-ink-lo">
          No rank yet — this league has not scored a gameweek.
        </p>
      )}
    </Link>
  );
}
