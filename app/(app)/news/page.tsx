import { cookies } from "next/headers";
import Link from "next/link";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getPicks } from "@/lib/fpl/endpoints";
import { recentItems, type StoredNewsRow } from "@/lib/news/store";
import { Est } from "@/components/gaffer/Est";

export const dynamic = "force-dynamic";
export const metadata = { title: "Newsdesk" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "squad", label: "My squad" },
  { key: "clubs", label: "My clubs" },
  { key: "general", label: "General" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function parseFilter(f: string | undefined): FilterKey {
  return (FILTERS.some((x) => x.key === f) ? f : "all") as FilterKey;
}

/**
 * Newsdesk — external news ranked by squad relevance, plus FPL's own
 * elements[].news surfaced inline. Ingest runs hourly via /api/cron/news.
 */
export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  const params = await searchParams;
  const filter = parseFilter(params.f);

  const boot = await getBootstrapLite();
  let squadIds: number[] = [];
  if (teamId) {
    try {
      const currentGw =
        boot.events.find((e) => e.is_current)?.id ??
        Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);
      squadIds = (await getPicks(teamId, currentGw, true)).picks.map((p) => p.element);
    } catch {
      squadIds = [];
    }
  }
  const squadSet = new Set(squadIds);
  const squadTeamIds = new Set(squadIds.map((id) => boot.elements[id]?.team).filter((t): t is number => t != null));

  let items: StoredNewsRow[] = [];
  try {
    items = await recentItems(120);
  } catch {
    items = [];
  }

  // Squad-specific ranking on top of ingest-time relevance.
  const scored = items.map((i) => {
    let score = i.relevance;
    const inSquad = i.elementIds.some((el) => squadSet.has(el));
    const inClubs = !inSquad && i.teamIds.some((t) => squadTeamIds.has(t));
    if (inSquad) score += 3;
    else if (inClubs) score += 1;
    return { ...i, score, inSquad, inClubs };
  });

  const filtered = scored.filter((i) => {
    if (filter === "squad") return i.inSquad;
    if (filter === "clubs") return i.inClubs || i.inSquad;
    if (filter === "general") return !i.inSquad && !i.inClubs;
    return true;
  });
  filtered.sort((a, b) => b.score - a.score);

  // FPL's own injury/availability notes for your squad.
  const fplNews = squadIds
    .map((id) => boot.elements[id])
    .filter((e): e is NonNullable<typeof e> => e != null)
    .filter((e) => e.news.trim().length > 0)
    .sort((a, b) => (a.chance_of_playing_this_round ?? 100) - (b.chance_of_playing_this_round ?? 100));

  const qs = (f: FilterKey) => `/news?f=${f}`;
  const sourceLabel: Record<string, string> = {
    bbc: "BBC",
    guardian: "Guardian",
    ffscout: "FFScout",
    reddit: "r/FantasyPL",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="fig-num text-[22px] leading-none">Newsdesk</h1>
          <p className="mt-1 text-2xs uppercase-label text-ink-lo">
            Ranked by squad relevance · refreshed hourly
          </p>
        </div>
      </div>

      <div role="group" aria-label="Filter" className="flex gap-1 rounded-md card-ring p-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={qs(f.key)}
            aria-pressed={filter === f.key}
            role="button"
            className={`skewed rounded-sm px-3 py-1.5 text-xs uppercase-label transition-colors dur-instant ${
              filter === f.key ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi"
            }`}
          >
            <span>{f.label}</span>
          </Link>
        ))}
      </div>

      {fplNews.length > 0 && (
        <section aria-label="FPL availability notes" className="rounded-lg has-gloss card-lift bg-raised p-4">
          <h2 className="upper-label text-2xs text-ink-lo">From FPL directly — your squad</h2>
          <ul className="mt-2 space-y-1.5">
            {fplNews.map((e) => {
              const chance =
                e.chance_of_playing_this_round != null
                  ? `${e.chance_of_playing_this_round}% to play`
                  : null;
              return (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium text-ink-hi">{e.web_name}</span>
                  <span className="text-xs text-flare">{e.news}</span>
                  {chance && <Est method="FPL's own chance-of-playing figure">{chance}</Est>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-lg bg-surface-1 card-ring p-8 text-center text-sm text-ink-lo">
          Nothing yet — the hourly ingest hasn&apos;t filled the desk. Check back soon.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.slice(0, 40).map((i) => (
            <li key={i.urlHash} className="rounded-lg bg-surface-1 card-ring px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="rounded-full card-ring px-2 py-0.5 text-2xs uppercase-label text-ink-lo">
                  {sourceLabel[i.source] ?? i.source}
                </span>
                {i.inSquad && (
                  <span className="rounded-full bg-brand-wash px-2 py-0.5 text-2xs uppercase-label text-volt">
                    your squad
                  </span>
                )}
                <time className="ml-auto text-2xs num-tabular text-ink-lo" dateTime={new Date(i.publishedAt).toISOString()}>
                  {new Date(i.publishedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </time>
              </div>
              <a
                href={i.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm font-medium leading-snug text-ink-hi hover:text-volt"
              >
                {i.title}
              </a>
              {i.summary && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-lo">{i.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
