import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getEntry, getPicks } from "@/lib/fpl/endpoints";
import { formatPrice, POSITION_SHORT } from "@/lib/ui/format";
import { SelfAvatar } from "@/components/gaffer/PlayerAvatarClient";
import { CrestBadge } from "@/components/gaffer/CrestBadge";
import { Badge } from "@/components/primitives/Badge";
import { KitWeave } from "@/components/generative/KitWeave";
import { COPY } from "@/lib/copy/deck";
import { fmtDeltaM, fmtM, STARTING_BUDGET_TENTHS } from "@/lib/engines/teamValue";

export const dynamic = "force-dynamic";
export const metadata = { title: "My team" };

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
        <h1 className="text-lg font-medium">{COPY.noSquadYet.title}</h1>
        <p className="mt-2 text-sm text-ink-2">{COPY.noSquadYet.body}</p>
      </div>
    );
  }

  const entry = await getEntry(teamId).catch(() => null);
  const bank = entry?.last_deadline_bank ?? 0;
  const value = entry?.last_deadline_value ?? 0;
  const totalTransfers = entry?.last_deadline_total_transfers ?? 0;

  const squadTeamIds = [
    ...new Set(
      picks.picks
        .map((p) => boot.elements[p.element]?.team)
        .filter((t): t is number => t != null),
    ),
  ].slice(0, 8);

  // E2 — the weave weighted by the minutes each club has actually played,
  // so the cloth re-balances when the fifteen change.
  const minutesByClub = new Map<number, number>();
  for (const p of picks.picks) {
    const el = boot.elements[p.element];
    if (!el) continue;
    minutesByClub.set(el.team, (minutesByClub.get(el.team) ?? 0) + el.minutes);
  }
  const weaveClubs = [...minutesByClub].map(([teamId, minutes]) => ({ teamId, minutes }));

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-lg has-gloss card-lift bg-raised px-5 py-4">
        <KitWeave teamIds={squadTeamIds} clubs={weaveClubs} />
        <header className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <h1 className="fig-num text-[22px] leading-none">My team</h1>
          {/*
           * Team value, spelled out.
           *
           * This was "Value £100.4m · Bank £0.5m", two figures that read as if
           * they add up — and FPL's `value` already includes the bank, so a
           * reader doing the obvious sum was half a million out. The total is
           * the headline now, its two halves sit underneath it, and the change
           * against the hundred everyone opened on is the part that actually
           * tells you whether the season's transfers have paid.
           */}
          <dl className="flex flex-wrap items-end gap-x-5 gap-y-2">
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Team value</dt>
              <dd className="fig-num mt-0.5 text-xl leading-none text-ink-hi">{fmtM(value)}</dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Since GW1</dt>
              <dd
                className={`fig-num mt-0.5 text-xl leading-none ${
                  value === STARTING_BUDGET_TENTHS
                    ? "text-ink-mid"
                    : value > STARTING_BUDGET_TENTHS
                      ? "text-surge"
                      : "text-flare"
                }`}
              >
                {fmtDeltaM(value - STARTING_BUDGET_TENTHS)}
              </dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Squad · bank</dt>
              <dd className="mt-0.5 text-sm leading-none text-ink-mid num-tabular">
                {fmtM(value - bank)} · {fmtM(bank)}
              </dd>
            </div>
            <div>
              <dt className="upper-label text-2xs text-ink-lo">Transfers</dt>
              <dd className="mt-0.5 text-sm leading-none text-ink-mid num-tabular">{totalTransfers}</dd>
            </div>
          </dl>
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
                {/* the face, with the crest badged on it — the same identity
                    block the Field and the boards use */}
                <span className="relative inline-block h-10 w-10 shrink-0">
                  <span className="block h-10 w-10 overflow-hidden rounded-md bg-surface-3">
                    <SelfAvatar
                      photo={el.photo}
                      teamId={el.team}
                      className="h-10 w-10 object-cover object-top"
                    />
                  </span>
                  <CrestBadge
                    teamId={el.team}
                    size={14}
                    className="absolute -bottom-1 -right-1 rounded-[2px] bg-surface-1"
                  />
                </span>
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

      <div className="flex flex-wrap gap-2">
        <Link
          href="/field"
          className="skewed inline-flex h-10 items-center rounded-md card-ring px-4 text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
        >
          <span>See them on the pitch</span>
        </Link>
        <Link
          href="/planner"
          className="skewed inline-flex h-10 items-center rounded-md card-ring px-4 text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
        >
          <span>Plan a transfer</span>
        </Link>
      </div>
    </div>
  );
}
