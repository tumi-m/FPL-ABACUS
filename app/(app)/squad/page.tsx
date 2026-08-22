import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getEntry, getPicks } from "@/lib/fpl/endpoints";
import { formatPrice, POSITION_SHORT, crest } from "@/lib/ui/format";
import { Badge } from "@/components/primitives/Badge";
import { KitWeave } from "@/components/generative/KitWeave";

export const dynamic = "force-dynamic";
export const metadata = { title: "Squad" };

const STATUS_TONE = {
  a: "default",
  d: "warning",
  i: "critical",
  s: "critical",
  u: "critical",
  n: "default",
} as const;

export default async function SquadPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/");

  const boot = await getBootstrapLite();
  const currentGw = boot.events.find((e) => e.is_current)?.id ?? 1;
  const currentEvent = boot.events.find((e) => e.id === currentGw);
  const deadlinePassed =
    currentEvent != null ? new Date(currentEvent.deadline_time).getTime() < Date.now() : true;

  let picks;
  try {
    picks = await getPicks(teamId, currentGw, deadlinePassed);
  } catch {
    return (
      <div className="mx-auto max-w-md rounded-lg bg-surface-1 card-ring p-10 text-center">
        <h1 className="text-lg font-medium">No squad yet</h1>
        <p className="mt-2 text-sm text-ink-2">Picks appear once FPL has them for this gameweek.</p>
      </div>
    );
  }

  const [entry] = await Promise.all([getEntry(teamId)]);
  const bank = entry.last_deadline_bank ?? 0;
  const value = entry.last_deadline_value ?? 0;
  const totalTransfers = entry.last_deadline_total_transfers ?? 0;

  const squadTeamIds = [
    ...new Set(
      picks.picks
        .map((p) => boot.elements[p.element]?.team)
        .filter((t): t is number => t != null),
    ),
  ].slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-lg has-gloss card-lift bg-raised px-5 py-4">
        <KitWeave teamIds={squadTeamIds} />
        <header className="relative flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Your 15</h1>
          <p className="text-sm text-ink-2 num-tabular">
            Value £{(value / 10).toFixed(1)}m · Bank £{(bank / 10).toFixed(1)}m · Transfers {totalTransfers}
          </p>
        </header>
      </div>

      <ul className="grid gap-1.5 md:grid-cols-2">
        {picks.picks.map((p) => {
          const el = boot.elements[p.element];
          if (!el) return null;
          const team = boot.teams.find((t) => t.id === el.team);
          const statusTone = STATUS_TONE[el.status] ?? "default";
          return (
            <li key={p.element}>
              <Link
                href={`/players/${p.element}`}
                className="flex items-center gap-3 rounded-md bg-surface-1 px-3 py-2.5 card-ring transition-colors dur-instant hover:bg-surface-3"
              >
                <span className="w-6 text-right text-xs text-ink-3 num-tabular">{p.position}</span>
                <Image src={crest(el.team_code)} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-1">{el.web_name}</span>
                  <span className="block text-xs text-ink-3">
                    {POSITION_SHORT[el.element_type]} · {team?.short_name} · {formatPrice(el.now_cost)} · {el.selected_by_percent}% owned
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-medium text-ink-1 num-tabular">{el.total_points} pts</span>
                  {el.status !== "a" ? (
                    <Badge variant={statusTone}>{el.status === "d" ? "Doubt" : "Out"}</Badge>
                  ) : (
                    <span className="block text-xs text-ink-3 num-tabular">form {el.form}</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-ink-3">
        Season view deep-dive (price pressure per player, xP horizon) arrives with the projection wiring on the Deadline Desk.
      </p>
    </div>
  );
}
