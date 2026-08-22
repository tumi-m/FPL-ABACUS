import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getEntry, getPicks } from "@/lib/fpl/endpoints";
import { Countdown } from "@/components/gaffer/Countdown";
import { Badge } from "@/components/primitives/Badge";
import { formatPrice, POSITION_SHORT } from "@/lib/ui/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deadline Desk" };

export default async function DeadlinePage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/");

  const boot = await getBootstrapLite();
  const nextEvent = boot.events.find((e) => e.is_next) ?? boot.events.find((e) => e.is_current);
  const currentGw = boot.events.find((e) => e.is_current)?.id ?? 1;

  let squadIds: number[] = [];
  try {
    const picks = await getPicks(teamId, currentGw, true);
    squadIds = picks.picks.map((p) => p.element);
  } catch {
    squadIds = [];
  }
  void getEntry;

  const actNow = [];
  const watch = [];
  const settled = [];
  for (const id of squadIds) {
    const el = boot.elements[id];
    if (!el) continue;
    if (el.status === "i" || el.status === "s" || el.status === "u") actNow.push(el);
    else if (el.status === "d" || el.chance_of_playing_this_round !== null || el.news) watch.push(el);
    else settled.push(el);
  }

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Deadline Desk</h1>
      <div className="grid gap-4 md:grid-cols-[minmax(280px,360px)_1fr]">
        <Countdown deadlineTime={nextEvent?.deadline_time ?? boot.events[boot.events.length - 1].deadline_time} />
        <div className="rounded-lg bg-surface-1 card-ring p-5">
          <h2 className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Triage</h2>
          <div className="mt-3 space-y-4">
            <Lane title="Act now" tone="critical" players={actNow} />
            <Lane title="Watch" tone="warning" players={watch} />
            <Lane title="Settled" tone="default" players={settled.slice(0, 6)} collapsed />
          </div>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-ink-3">
        Transfer simulator with xP + variance deltas, template drift ring and price-pressure gauges land with the
        projection engine wiring. Squad statuses above are live from FPL.
      </p>
    </div>
  );
}

function Lane({
  title,
  tone,
  players,
  collapsed = false,
}: {
  title: string;
  tone: "critical" | "warning" | "default";
  players: import("@/lib/fpl/bootstrapLite").ElementLite[];
  collapsed?: boolean;
}) {
  return (
    <section aria-label={title}>
      <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-2">
        {title}
        <Badge variant={tone === "critical" ? "critical" : tone === "warning" ? "warning" : "default"}>
          {players.length}
        </Badge>
      </h3>
      {players.length === 0 ? (
        <p className="py-1 text-sm text-ink-3">Nothing here.</p>
      ) : (
        <ul className={`divide-y divide-hairline rounded-md card-ring px-3 ${collapsed ? "opacity-70" : ""}`}>
          {(collapsed ? players.slice(0, 4) : players).map((el) => (
            <li key={el.id} className="flex items-center justify-between py-1.5">
              <Link href={`/players/${el.id}`} className="text-sm text-ink-1 hover:text-brand">
                {el.web_name}
                <span className="ml-1.5 text-xs text-ink-3">{POSITION_SHORT[el.element_type]}</span>
              </Link>
              <span className="max-w-[50%] truncate text-xs text-ink-3">{el.news || formatPrice(el.now_cost)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
