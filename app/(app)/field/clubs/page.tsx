import Link from "next/link";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/gaffer/PageHeader";
import { TeamBoards } from "@/components/gaffer/field/TeamBoards";
import { buildTeamStatsPage } from "@/lib/server/buildTeamStats";

export const dynamic = "force-dynamic";

export const metadata = { title: "Club numbers" };

/**
 * Sub-page of the Field: the twenty clubs, six ways.
 *
 * The Field is your fifteen. This is the league they were picked out of, which
 * is the question that comes first and gets asked least — a player is a bet on
 * his club's chances as much as on his own finishing, and the club numbers move
 * slower and lie less than a player's do.
 *
 * It does not need your team. Without one it is still the whole league; with
 * one, the clubs you already hold are marked so you can see your exposure
 * against the table rather than in a separate column.
 */
export default async function FieldClubsPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  const { gw, rows, owned, played } = await buildTeamStatsPage(teamId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Club numbers"
        meta={`GW${gw} · twenty clubs, ${played} ${played === 1 ? "match" : "matches"} in`}
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
        <p className="max-w-[68ch] text-sm leading-relaxed text-ink-mid">
          Every column here is either something FPL publishes or something read off a scoreline.
          Shots, touches and chances created belong to Opta, not to FPL, so they are not here —
          a decimal point invented from what FPL <em>does</em> give would look like data and behave
          like a guess.
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-lo">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-volt" />
            a club you own a player from
          </span>
          <span>tap any column heading to sort by it</span>
        </p>
      </div>

      <TeamBoards rows={rows} owned={owned} />
    </div>
  );
}
