import { notFound } from "next/navigation";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getElementSummary } from "@/lib/fpl/endpoints";
import { describeFailure } from "@/lib/engines/rivalFailure";
import { Badge } from "@/components/primitives/Badge";
import { Meter } from "@/components/charts/Meter";
import { Sparkline } from "@/components/charts/Sparkline";
import { SelfAvatar } from "@/components/gaffer/PlayerAvatarClient";
import { formatPrice, POSITION_SHORT } from "@/lib/ui/format";
import { COPY } from "@/lib/copy/deck";
import { PageHeader } from "@/components/gaffer/PageHeader";
import { BackLink } from "@/components/gaffer/BackLink";

export const dynamic = "force-dynamic";

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

export default async function PlayerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  const boot = await getBootstrapLite();
  const el = boot.elements[id];
  if (!el || !Number.isFinite(id)) notFound();

  /*
   * "No match history yet this season" used to be printed for two different
   * things: a player who genuinely has not played, and a fetch of ours that
   * failed. The second is far commoner and the sentence is a statement about
   * the player, so a fault entirely on our side was reported as a fact about
   * him — on a page whose own header said he had points and a form figure,
   * which is the reader's proof it is wrong. The failure is now its own state
   * and says whose it is.
   */
  let history: Awaited<ReturnType<typeof getElementSummary>>["history"] = [];
  let fixtures: Awaited<ReturnType<typeof getElementSummary>>["fixtures"] = [];
  let summaryError: string | null = null;
  try {
    const summary = await getElementSummary(id);
    history = [...summary.history].sort((a, b) => a.round - b.round);
    fixtures = summary.fixtures.filter((f) => !f.finished && f.event != null).slice(0, 5);
  } catch (err) {
    summaryError = describeFailure(err);
  }

  const team = boot.teams.find((t) => t.id === el.team);
  const teamName = (tid: number) => boot.teams.find((t) => t.id === tid)?.short_name ?? "—";
  const defconThreshold = el.element_type === 2 ? 10 : 12;

  const recent = history.slice(-12).reverse();
  const pointsByGw = history.map((h) => h.total_points);
  const per90 = el.minutes >= 90 ? (v: number) => round2((v / el.minutes) * 90) : () => null;

  return (
    <div className="space-y-4">
      <BackLink href="/players" label="All players" />

      <PageHeader
        title={el.web_name}
        meta={`${team?.name ?? ""} · ${POSITION_SHORT[el.element_type]} · ${formatPrice(el.now_cost)}`}
        media={
          <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-3">
            <SelfAvatar photo={el.photo} teamId={el.team} className="h-14 w-14 object-cover object-top" eager />
          </span>
        }
        action={
          <div className="flex items-center gap-4 text-right num-tabular sm:gap-6">
            <div>
              <div className="upper-label text-2xs text-ink-lo">Points</div>
              <div className="fig-num text-xl">{el.total_points}</div>
            </div>
            <div>
              <div className="upper-label text-2xs text-ink-lo">Form</div>
              <div className="fig-num text-xl">{el.form}</div>
            </div>
            <div>
              <div className="upper-label text-2xs text-ink-lo">Owned</div>
              <div className="fig-num text-xl">{el.selected_by_percent}%</div>
            </div>
          </div>
        }
      />

      {el.status !== "a" && (
        <div className="rounded-lg bg-warning/10 p-4 text-sm text-warning">
          <Badge variant="warning">{POSITION_SHORT[el.element_type]} · {el.status === "d" ? "Doubtful" : "Unavailable"}</Badge>{" "}
          {el.news || "No news."}
        </div>
      )}

      {/*
       * The season, from the bootstrap.
       *
       * This page was a header and one table, and when the table came back
       * empty it was a header over half a screen of nothing — on a player the
       * app already knew a great deal about. Every figure here was loaded
       * before the page rendered; none of it costs a request.
       */}
      <section aria-label="This season" className="rounded-lg bg-surface-1 card-ring p-4 md:p-5">
        <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wide text-ink-3">This season</h2>
        <dl className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Starts" value={`${el.starts}`} hint={`${el.minutes} minutes played`} />
          <Stat label="Minutes" value={`${el.minutes}`} />
          <Stat
            label="Goals"
            value={`${el.goals_scored}`}
            sub={`${round2(el.xgTotal)} xG`}
            hint="Goals scored against expected goals — above means he is finishing better than the chances deserve"
          />
          <Stat
            label="Assists"
            value={`${el.assists}`}
            sub={`${round2(el.xaTotal)} xA`}
            hint="Assists against expected assists"
          />
          <Stat label="Bonus" value={`${el.bonus}`} sub={`${el.bps} bps`} />
          <Stat
            label="Per £m"
            value={round1(el.total_points / Math.max(1, el.now_cost / 10)).toFixed(1)}
            hint="Season points divided by his price today"
          />
        </dl>

        {/* Per-90 only once there is a full match behind it — a rate off
            twenty minutes is arithmetic, not information. */}
        {el.minutes >= 90 && (
          <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3 border-t border-hairline pt-3 sm:grid-cols-4 lg:grid-cols-6">
            <Stat label="xG / 90" value={`${per90(el.xgTotal) ?? "—"}`} />
            <Stat label="xA / 90" value={`${per90(el.xaTotal) ?? "—"}`} />
            <Stat label="Pts / 90" value={`${per90(el.total_points) ?? "—"}`} />
            <Stat
              label="DEFCON"
              value={`${el.defcon}`}
              sub={`${defconThreshold} for 2 pts`}
              hint="Defensive contributions this season, and how many are needed in a match to score"
            />
            {/* Letters inside the display face read as digits — "0Y 0R" comes
                out looking like "OY OR" — so the units go on the second line. */}
            <Stat label="Cards" value={`${el.yellowCards} / ${el.redCards}`} sub="yellow / red" />
            {el.element_type === 1 ? (
              <Stat label="Saves" value={`${el.saves}`} sub={`${el.pensSaved} pens`} />
            ) : (
              <Stat label="Clean sheets" value={`${el.cleanSheets}`} />
            )}
          </dl>
        )}

        {pointsByGw.length >= 2 && (
          <div className="mt-3 flex items-center gap-3 border-t border-hairline pt-3">
            <span className="upper-label shrink-0 text-2xs text-ink-lo">Points by gameweek</span>
            <Sparkline values={pointsByGw} ariaLabel={`Points by gameweek, GW${history[0].round} to GW${history[history.length - 1].round}`} />
            <span className="shrink-0 text-2xs text-ink-lo num-tabular">
              best {Math.max(...pointsByGw)}
            </span>
          </div>
        )}
      </section>

      <section aria-label="Recent matches" className="rounded-lg bg-surface-1 card-ring p-5">
        <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wide text-ink-3">Last matches</h2>
        {/*
         * The empty and failed states live outside the table.
         * They were a <td> inside it, and the table carries min-w-[520px] so
         * that it can scroll sideways on a phone — which meant the sentence
         * explaining what went wrong was itself cut off at the edge of the
         * screen, with the half that named the fault on the far side of a
         * scroll nobody knew was there.
         */}
        {recent.length === 0 ? (
          summaryError ? (
            <div className="rounded-md bg-surface-2 px-4 py-5 text-center">
              <p className="text-sm text-ink-2">Couldn&rsquo;t load his match history.</p>
              <p className="mx-auto mt-1 max-w-[46ch] text-2xs leading-relaxed text-ink-lo">
                {summaryError}. The season figures above come from a different request and are current.
              </p>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-3">{COPY.noMatchHistory}</p>
          )
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm num-tabular">
            <thead>
              <tr className="border-b border-hairline text-left text-2xs uppercase tracking-wide text-ink-3">
                <th className="py-1.5 pr-2 font-semibold">GW</th>
                <th className="py-1.5 px-2 font-semibold">Opp</th>
                <th className="py-1.5 px-2 font-semibold text-right">Min</th>
                <th className="py-1.5 px-2 font-semibold text-right">Pts</th>
                <th className="py-1.5 px-2 font-semibold text-right">xG</th>
                <th className="py-1.5 px-2 font-semibold text-right">xA</th>
                <th className="py-1.5 px-2 font-semibold text-right">BPS</th>
                <th className="w-32 py-1.5 pl-2 font-semibold">DEFCON</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((h) => (
                <tr key={`${h.element}-${h.fixture}`} className="border-b border-hairline last:border-0">
                  <td className="py-1.5 pr-2 text-ink-2">{h.round}</td>
                  <td className="px-2 text-ink-3">
                    {h.was_home ? "" : "@"}{teamName(h.opponent_team)}
                  </td>
                  <td className="px-2 text-right text-ink-2">{h.minutes}</td>
                  <td className="px-2 text-right font-medium text-ink-1">{h.total_points}</td>
                  <td className="px-2 text-right text-ink-3">{round2(h.expected_goals)}</td>
                  <td className="px-2 text-right text-ink-3">{round2(h.expected_assists)}</td>
                  <td className="px-2 text-right text-ink-3">{h.bps}</td>
                  <td className="pl-2">
                    {defconThreshold === 10 ? (
                      <Meter value={Math.min(1, h.defensive_contribution / defconThreshold)} hint={`${h.defensive_contribution}/${defconThreshold}`} />
                    ) : (
                      <Meter value={Math.min(1, (h.defensive_contribution + h.recoveries) / defconThreshold)} hint={`${h.defensive_contribution + h.recoveries}/${defconThreshold}`} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>

      {/* The fixtures were already in the response and thrown away. */}
      {fixtures.length > 0 && (
        <section aria-label="Next fixtures" className="rounded-lg bg-surface-1 card-ring p-5">
          <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wide text-ink-3">Next fixtures</h2>
          <ul className="flex flex-wrap gap-2">
            {fixtures.map((f) => {
              const opp = teamName(f.is_home ? f.team_a : f.team_h);
              return (
                <li
                  key={f.id}
                  className="flex min-w-[92px] flex-col gap-1 rounded-md bg-surface-2 px-3 py-2"
                  title={`Difficulty ${f.difficulty} of 5`}
                >
                  <span className="text-2xs text-ink-lo num-tabular">GW{f.event}</span>
                  <span className="text-sm font-medium text-ink-1">
                    {f.is_home ? "" : "@"}{opp}
                  </span>
                  <Meter value={1 - (f.difficulty - 1) / 4} hint={`FDR ${f.difficulty}`} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/** One figure with its label, and an optional second line for its context. */
function Stat({ label, value, sub, hint }: { label: string; value: string; sub?: string; hint?: string }) {
  return (
    <div title={hint}>
      <dt className="upper-label text-2xs text-ink-lo">{label}</dt>
      <dd className="fig-num mt-0.5 text-lg leading-none text-ink-hi">{value}</dd>
      {sub && <dd className="mt-1 text-2xs text-ink-lo num-tabular">{sub}</dd>}
    </div>
  );
}
