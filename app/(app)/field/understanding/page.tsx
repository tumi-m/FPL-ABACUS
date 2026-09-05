import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { buildUnderstanding, type UnderstandingData } from "@/lib/server/buildUnderstanding";
import { COPY } from "@/lib/copy/deck";
import { PageHeader } from "@/components/gaffer/PageHeader";
import { BackLink } from "@/components/gaffer/BackLink";
import {
  UnderstandingLedger,
  SeasonLuck,
  FormRibbon,
} from "@/components/gaffer/field/Understanding";
import { Est } from "@/components/gaffer/Est";

export const dynamic = "force-dynamic";

export const metadata = { title: "Season understanding",
  description: "What each kind of decision paid, how much of the season was luck, and each player's form against noise." };

/**
 * Season understanding (v10 D1) — the three quant engines that only the ask
 * desk could reach, on a screen of their own.
 *
 * The Field's decision board asks what this week did to your rank. This page
 * asks the season question in three moves: what each KIND of decision paid
 * (the Shapley ledger), how much of the score was the team rather than the
 * luck (process vs outcome), and which players are carrying a real level
 * rather than a hot run (the true-form ribbon).
 *
 * Sub-page of the Field: same model wave, none of the pitch.
 */
export default async function UnderstandingPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/?next=/field/understanding");

  let data: UnderstandingData;
  try {
    data = await buildUnderstanding(teamId);
  } catch {
    return (
      <div className="mx-auto max-w-md rounded-lg bg-surface-1 card-ring p-10 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{COPY.upstreamDown.title}</h1>
        <p className="mt-2 text-sm text-ink-2">
          The season read needs your entry history and the settled weeks&apos; feeds —
          neither answered. {COPY.upstreamDown.body}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackLink href="/field" label="Back to the Field" />

      <PageHeader
        title="Season understanding"
        meta={`GW${data.currentGw} · ${data.gws.length} settled week${data.gws.length === 1 ? "" : "s"} read`}
      />

      <div className="rounded-lg has-gloss card-lift bg-raised px-5 py-4">
        <p className="max-w-[68ch] text-sm leading-relaxed text-ink-mid">
          The decision board under the pitch asks what a week did to your rank.
          This asks the slower questions: what each <em>kind</em> of decision has
          paid all season, how much of your score was the team rather than the
          luck, and who is carrying a real level rather than a hot run.
        </p>
        <p className="mt-2 max-w-[68ch] text-2xs leading-relaxed text-ink-lo">
          Weeks read: {data.gws.length > 0 ? data.gws.map((g) => `GW${g}`).join(", ") : "none yet"}
          {data.missedWeeks.length > 0 && (
            <>
              {" · "}weeks a feed did not answer, dropped rather than zeroed:{" "}
              {data.missedWeeks.map((g) => `GW${g}`).join(", ")}
            </>
          )}
        </p>
      </div>

      {data.gws.length === 0 ? (
        <div className="rounded-lg bg-surface-1 card-ring p-10 text-center">
          <h2 className="text-lg font-medium">{COPY.nothingToAttribute.title}</h2>
          <p className="mt-2 text-sm text-ink-2">
            The ledger and the luck channels fill in from your first settled
            gameweek — the ribbon below works as soon as a player has four
            appearances.
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <UnderstandingLedger ledger={data.ledger} />
          <SeasonLuck luck={data.luck} />
        </div>
      )}

      {data.ribbons.length > 0 ? (
        <section aria-label="True-form ribbons" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="upper-label text-2xs text-ink-lo">True form — the squad</h2>
            <p className="text-2xs text-ink-lo">
              The band is{" "}
              <Est method="±1.96 standard deviations of the filtered level — a 95% credible interval under the local-level model.">
                ±1.96√P
              </Est>{" "}
              — wide means the season says little, tight means the level is real.
            </p>
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {data.ribbons.map((r) => (
              <FormRibbon key={r.element} ribbon={r} />
            ))}
          </div>
        </section>
      ) : (
        <p className="rounded-lg bg-surface-1 card-ring p-6 text-center text-sm text-ink-lo">
          The ribbons need four appearances per player — the season is too young
          for the filter to say anything honest yet.
        </p>
      )}

      <p className="text-2xs leading-relaxed text-ink-lo">
        Nothing here invents a number: the ledger replays the weeks FPL has
        settled, the luck channels price goals against the chances at FPL&apos;s
        own scoring values, and the ribbon is a filter, not a forecast — it
        says what the season has shown, at the confidence the season has earned.
      </p>
    </div>
  );
}