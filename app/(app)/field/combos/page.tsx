import Link from "next/link";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/gaffer/PageHeader";
import { ComboBoards } from "@/components/gaffer/combos/ComboBoards";
import { buildComboBoard } from "@/lib/server/buildCombos";

export const dynamic = "force-dynamic";

export const metadata = { title: "Combinations" };

/**
 * Sub-page of the Field: combinations — two players at once, priced against
 * somebody else's two.
 *
 * Every other board in the app ranks players. Almost no FPL decision is about
 * a player: it is about what a sum of money buys, and the same fifteen million
 * is two very good midfielders or one great forward and a defender who plays.
 * A leaderboard cannot answer that, because the leaders are the expensive ones
 * and it says so every week.
 *
 * It works without a team. With one, the players you already own are marked
 * through every board so the question reads as "should I swap" rather than
 * "who is good".
 */
export default async function CombosPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  const data = await buildComboBoard(teamId);

  if (data.pool.length < 2) {
    return (
      <div className="space-y-4">
        <PageHeader title="Combinations" meta="Nothing to pair yet" />
        <p className="rounded-lg bg-surface-1 card-ring p-10 text-center text-sm text-ink-lo">
          Not enough football has been played to say what a pair of players is worth. Come back a
          couple of gameweeks in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Combinations"
        meta={`GW${data.gw} · ${data.pool.length} players, ${((data.pool.length * (data.pool.length - 1)) / 2).toLocaleString("en-GB")} pairs`}
        /* One action, like the Field's other two sub-pages. Two buttons here
           squeezed the title into "Combinati…" on a phone — the header's h1
           truncates, and the actions take the width they ask for. The hop to
           the Planner is below, where the boards have already made the case
           for it. */
        action={
          <Link
            href="/field"
            role="button"
            className="skewed inline-flex h-9 items-center gap-2 rounded-md bg-raised px-4 text-xs uppercase-label text-ink-mid card-ring transition-colors dur-instant hover:text-ink-hi"
          >
            <span aria-hidden>←</span>
            <span>Back to the Field</span>
          </Link>
        }
      />

      <div className="rounded-lg has-gloss card-lift bg-raised px-5 py-4">
        <p className="max-w-[70ch] text-sm leading-relaxed text-ink-mid">
          Nobody buys a player; they spend money. Fifteen million is two very good midfielders or
          one great forward and somebody who plays, and the only honest way to compare those is at
          the same spend — so whichever side is cheaper is credited with what its spare buys at
          replacement level before the two totals are put beside each other.
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-lo">
          <span className="num-tabular">
            replacement level: {data.rate.toFixed(1)} points per £m
          </span>
          <span className="num-tabular">shortlist: {data.floor}+ minutes played</span>
          {data.owned.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-volt" />
              a player you already own
            </span>
          )}
        </p>
      </div>

      <ComboBoards data={data} />

      <div className="flex justify-center pb-4">
        <Link
          href="/planner"
          role="button"
          className="skewed inline-flex h-11 items-center gap-2 rounded-md bg-volt px-6 text-xs uppercase-label text-on-accent btn-glow transition-transform dur-instant active:scale-[0.98]"
        >
          <span>Take it to the Planner</span>
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
