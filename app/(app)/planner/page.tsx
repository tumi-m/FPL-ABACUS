import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TransferPlanner } from "@/components/gaffer/planner/TransferPlanner";
import { buildPlanner } from "@/lib/server/buildPlanner";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Transfer Planner",
  description:
    "Plan your transfers over the next six gameweeks: projected points per player per week, the full player market, the fixture ticker and price watch.",
};

export default async function PlannerPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/?next=/planner");

  const data = await buildPlanner(teamId);
  const window = data.gws.length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="fig-num text-[22px] leading-none">Transfer Planner</h1>
          <p className="mt-1 max-w-[70ch] text-2xs uppercase-label text-ink-lo">
            {window > 0
              ? `GW${data.gws[0].id}–${data.gws[window - 1].id} · projected points, the market, the ticker`
              : "Projected points, the market, the ticker"}
          </p>
        </div>
        {/* The planner stages one move at a time; the combination board is
            where you work out whether the move is the right shape at all.
            This is the only way in on a phone — Combinations sits in the
            desktop nav but has no thumb slot — so it is an accent fill and it
            says its own name, rather than the muted riddle it used to be. */}
        <Link
          href="/field/combos"
          role="button"
          className="skewed inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-volt px-4 text-xs uppercase-label text-on-accent btn-glow transition-transform dur-instant active:scale-[0.98] sm:h-9 sm:w-auto"
        >
          <span>Combinations</span>
          <span aria-hidden>→</span>
        </Link>
      </header>

      <TransferPlanner data={data} />
    </div>
  );
}
