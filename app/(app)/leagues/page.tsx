import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getEntry } from "@/lib/fpl/endpoints";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leagues",
  description: "Your leagues and the cohort: standings, month form and the gw view." };

export default async function LeaguesPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/");

  const entry = await getEntry(teamId);
  const leagues = entry.leagues.classic ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Mini-leagues</h1>
      {leagues.length === 0 && (
        <p className="rounded-lg bg-surface-1 card-ring p-8 text-center text-sm text-ink-2">
          No classic leagues found for this entry.
        </p>
      )}
      <ul className="grid gap-2 md:grid-cols-2">
        {leagues.map((l) => (
          <li key={l.id}>
            <Link
              href={`/leagues/${l.id}`}
              className="block rounded-lg bg-surface-1 p-4 card-ring transition-colors dur-instant hover:bg-surface-3"
            >
              <span className="block truncate font-medium text-ink-1">{l.name}</span>
              <span className="mt-1 block text-sm text-ink-3 num-tabular">
                {l.entry_rank !== null ? `You are #${l.entry_rank.toLocaleString()}` : "Unranked"} · {l.league_type}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
