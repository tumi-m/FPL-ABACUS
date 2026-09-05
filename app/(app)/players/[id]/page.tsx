import { notFound } from "next/navigation";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getElementSummary } from "@/lib/fpl/endpoints";
import { describeFailure } from "@/lib/engines/rivalFailure";
import { parseScoring } from "@/lib/engines/scoring";
import { pointsByGameweek, readDefcon, splitPoints } from "@/lib/engines/playerSeason";
import { estimateMinutes, MINUTES_METHOD, MINUTES_THIN_LABEL } from "@/lib/engines/minutes";
import { Est } from "@/components/gaffer/Est";
import { Unavailable } from "@/components/gaffer/Provenance";
import { UNAVAILABLE_STATS } from "@/lib/provenance";
import { PointsByGameweek, PointsSources, DefconByMatch } from "@/components/gaffer/player/PlayerCharts";
import { StatPercentiles } from "@/components/gaffer/player/StatPercentiles";
import { buildPercentiles } from "@/lib/engines/playerPercentiles";
import { defaultMinutesFloor } from "@/lib/engines/performance";
import type { Pos } from "@/lib/engines/types";
import { Badge } from "@/components/primitives/Badge";
import { Meter } from "@/components/charts/Meter";
import { SelfAvatar } from "@/components/gaffer/PlayerAvatarClient";
import { formatPrice, POSITION_SHORT } from "@/lib/ui/format";
import { COPY } from "@/lib/copy/deck";
import { PageHeader } from "@/components/gaffer/PageHeader";
import { WatchStar } from "@/components/gaffer/watch/WatchStar";
import { BackLink } from "@/components/gaffer/BackLink";

export const dynamic = "force-dynamic";

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** The most-shared page in the app gets a real title and description. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) return { title: "Player" };
  try {
    const boot = await getBootstrapLite();
    const el = boot.elements[id];
    if (!el) return { title: "Player" };
    const club = boot.teams.find((t) => t.id === el.team)?.short_name ?? "";
    return {
      title: `${el.web_name} (${club}) — season, form and fixtures`,
      description: `${el.web_name}, ${POSITION_SHORT[el.element_type]} for ${club}: ${el.total_points} points, form ${el.form}, £${(el.now_cost / 10).toFixed(1)}m — match-by-match, defensive work and what is next.`,
    };
  } catch {
    return { title: "Player" };
  }
}

export default async function PlayerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();
  // Bootstrap and element summary share nothing — one wave, not two trips.
  const [boot, summaryRes] = await Promise.allSettled([getBootstrapLite(), getElementSummary(id)]);
  if (boot.status !== "fulfilled") {
    console.error(`[player] bootstrap failed for ${id}`);
    notFound();
  }
  const el = boot.value.elements[id];
  if (!el) notFound();

  /*
   * "No match history yet this season" used to be printed for two different
   * things: a player who genuinely has not played, and a fetch of ours that
   * failed. The second is far commoner and the sentence is a statement about
   * the player, so a fault entirely on our side was reported as a fact about
   * him — on a page whose own header said he had points and a form figure,
   * which is the reader's proof it is wrong. The failure is now its own state
   * and says whose it is.
   */
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
  if (summaryRes.status === "fulfilled") {
    const summary = summaryRes.value;
    history = [...summary.history].sort((a, b) => a.round - b.round);
    fixtures = summary.fixtures.filter((f) => !f.finished && f.event != null).slice(0, 5);
  } else {
    summaryError = describeFailure(summaryRes.reason);
  }

  const team = boot.value.teams.find((t) => t.id === el.team);
  const teamName = (tid: number) => boot.value.teams.find((t) => t.id === tid)?.short_name ?? "—";

  const recent = history.slice(-12).reverse();
  const per90 = el.minutes >= 90 ? (v: number) => round2((v / el.minutes) * 90) : () => null;

  const pos = el.element_type as Pos;
  /*
   * Everything below is read from the per-match series rather than the season
   * totals, because the two answer different questions. The defensive lane in
   * particular pays per match against a threshold, so a season total of nine
   * can be worth nought or four depending entirely on how it was distributed —
   * see readDefcon.
   */
  const defcon = readDefcon(history, pos);
  const gwSeries = pointsByGameweek(history);
  const defconSeries = history
    .slice()
    .sort((a, b) => a.round - b.round)
    .map((h) => ({ gw: h.round, defcon: h.defensive_contribution, minutes: h.minutes }));

  /*
   * Every figure ranked against the same position. The bootstrap already holds
   * every player in the game, so the cohort costs nothing — no extra request,
   * no per-player summary fetches.
   */
  const allPlayers = Object.values(boot.value.elements);
  const percentiles = buildPercentiles({
    player: el,
    all: allPlayers,
    /* Scales with how much football has been played, so gameweek one is not
       blank and a late-season page is not ranking against one-cameo names. */
    minMinutes: defaultMinutesFloor(allPlayers),
  });

  /* FPL's own values, not ours: the defensive lane did not exist two seasons
     ago and clean sheets have moved, so a hardcoded table would rot. */
  let split: ReturnType<typeof splitPoints> | null = null;
  try {
    split = splitPoints(history, pos, parseScoring(boot.value.scoring));
  } catch {
    split = null;
  }

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
            <WatchStar id={el.id} name={el.web_name} className="-mr-2" />
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
            value={<Est method="Season points divided by his price today — an arithmetic read of two published figures.">{round1(el.total_points / Math.max(1, el.now_cost / 10)).toFixed(1)}</Est>}
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
            {/*
             * The count was the headline and it is the less useful half: the
             * lane pays per match, so what matters is how many times he
             * actually crossed the line. Points first, the raw total under.
             *
             * Keepers have no defensive lane at all — a threshold of 99 is the
             * engine's way of saying so — and "DEFCON pts 0, 0 of 7 matches"
             * reads as a player failing at something rather than one who was
             * never eligible. They get the figure they are actually read by.
             */}
            {defcon.threshold < 99 ? (
              <Stat
                label="DEFCON pts"
                value={`${defcon.points}`}
                sub={`${defcon.hits}/${defcon.played} matches · ${defcon.total} total`}
                hint={`Two points each time he reaches ${defcon.threshold} defensive contributions in a match. Contributions below that line in a match score nothing, which is why the season total on its own does not tell you what the lane paid.`}
              />
            ) : (
              <Stat
                label="Conceded"
                value={`${el.goalsConceded}`}
                sub={`${per90(el.goalsConceded) ?? "—"} per 90`}
                hint="Goals conceded this season — a keeper loses a point for every two"
              />
            )}
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

      </section>

      {/* D8 — what this app deliberately does not show a number for. Where a
          competitor prints Opta-derived figures, this names the stats, the
          dash, and the reason. The absence is the trustworthiness, and it is
          stated rather than left to be inferred from a smaller table. */}
      <UnavailableBlock />

      {/* A number is only readable beside the players it should be judged
          against — see StatPercentiles. */}
      <StatPercentiles read={percentiles} pos={el.element_type} />

      {/* The three reads the season totals cannot give: the shape of his
          returns, what they were made of, and whether the defensive lane is
          actually paying him. */}
      {gwSeries.length > 0 && (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <PointsByGameweek series={gwSeries} />
          {split && <PointsSources sources={split.sources} total={split.total} />}
          <DefconByMatch series={defconSeries} threshold={defcon.threshold} />
        </div>
      )}

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
                    {/* FPL's defensive_contribution is already the
                        position-appropriate figure — recoveries are inside it
                        for a midfielder and outside it for a defender. Adding
                        them on top, as this did, double-counted them for
                        exactly the positions where they already counted, and
                        showed the line cleared when it had not. */}
                    <Meter
                      value={Math.min(1, h.defensive_contribution / defcon.threshold)}
                      hint={`${h.defensive_contribution}/${defcon.threshold}${h.defensive_contribution >= defcon.threshold ? " — cleared" : ""}`}
                      tone="defcon"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>

      {/* Will he start? (v10 D2) — the probabilities the whole app is asked
          for most, estimated from the same history the table above shows. */}
      <MinutesCertainty
        history={history}
        status={el.status}
        chanceOfPlaying={el.chance_of_playing_this_round}
      />

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
function Stat({ label, value, sub, hint }: { label: string | React.ReactNode; value: React.ReactNode; sub?: string; hint?: string }) {
  return (
    <div title={hint}>
      <dt className="upper-label text-2xs text-ink-lo">{label}</dt>
      <dd className="fig-num mt-0.5 text-lg leading-none text-ink-hi">{value}</dd>
      {sub && <dd className="mt-1 text-2xs text-ink-lo num-tabular">{sub}</dd>}
    </div>
  );
}

/**
 * The stats this page deliberately does not show a number for (v10 D8).
 *
 * A competitor's player page carries columns for big chances, pass
 * completion, crosses and touches in the box, and those figures do exist —
 * in Opta's licensed feed, which FPL does not publish and GAFFER does not
 * buy. Deriving a lookalike from the fields FPL does give would produce
 * authoritative-looking numbers that are inventions, so this page says what
 * it is missing and why instead. Every row is an Unavailable affordance:
 * the stat's name, a dash, and the reason one tap away.
 */
function UnavailableBlock() {
  return (
    <section aria-label="Stats not published by FPL" className="rounded-lg bg-surface-1 card-ring p-4 md:p-5">
      <h2 className="mb-1 text-2xs font-semibold uppercase tracking-wide text-ink-3">
        Not published by FPL
      </h2>
      <p className="mb-3 max-w-[62ch] text-2xs leading-relaxed text-ink-lo">
        The stats below exist in Opta&rsquo;s licensed event feed, which FPL does not publish.
        Every site showing a number for these is either buying that feed or inventing its own —
        GAFFER does neither, so they are named here as absences rather than shown as guesses.
      </p>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {UNAVAILABLE_STATS.map((s) => (
          <li key={s.label}>
            <Unavailable label={s.label} why={s.why} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Minutes certainty (v10 D2) — P(start) and P(60+) from the per-match
 * history, with the interval that widens as history thins. Below three
 * appearances the model refuses and the panel says so: a greyed
 * "Not enough history", never a number dressed up as one. FPL's published
 * chance-of-playing, when there is one, sits beside the model as its words.
 */
function MinutesCertainty({
  history,
  status,
  chanceOfPlaying,
}: {
  history: Awaited<ReturnType<typeof getElementSummary>>["history"];
  status: string;
  chanceOfPlaying: number | null;
}) {
  const observations = history.map((h) => ({
    gw: h.round,
    minutes: h.minutes,
    started: h.starts > 0,
  }));
  const est = estimateMinutes(observations);

  return (
    <section aria-label="Minutes certainty" className="rounded-lg bg-surface-1 card-ring p-4 md:p-5">
      <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wide text-ink-3">Will he start?</h2>
      {est.reliable ? (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="upper-label text-2xs text-ink-lo">P(start)</dt>
            <dd className="fig-num mt-0.5 text-xl leading-none text-ink-hi">
              <Est method={MINUTES_METHOD}>{`${Math.round(est.pStart * 100)}%`}</Est>
            </dd>
            <dd className="mt-1 text-2xs text-ink-lo num-tabular">
              95% interval {Math.round(est.pStartInterval[0] * 100)}–{Math.round(est.pStartInterval[1] * 100)}%
            </dd>
          </div>
          <div>
            <dt className="upper-label text-2xs text-ink-lo">P(60+)</dt>
            <dd className="fig-num mt-0.5 text-xl leading-none text-ink-hi">
              <Est method={`${MINUTES_METHOD} Conditioned on starting.`}>{`${Math.round(est.p60 * 100)}%`}</Est>
            </dd>
          </div>
          <div>
            <dt className="upper-label text-2xs text-ink-lo">Expected minutes</dt>
            <dd className="fig-num mt-0.5 text-xl leading-none text-ink-hi">
              <Est method={`${MINUTES_METHOD} Blended over the chance he comes off the bench.`}>
                {`${est.expectedMinutes}`}
              </Est>
            </dd>
          </div>
          <div>
            <dt className="upper-label text-2xs text-ink-lo">FPL says</dt>
            <dd className="mt-0.5 text-sm leading-snug text-ink-1">
              {status === "a" && chanceOfPlaying == null
                ? "Fully fit — no flag."
                : status === "a"
                  ? `${chanceOfPlaying}% chance of playing`
                  : el_news_label(status, chanceOfPlaying)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-ink-3">
          <span className="fig-num text-lg text-ink-lo">—</span>{" "}
          {MINUTES_THIN_LABEL} · {est.note}
          {chanceOfPlaying != null && ` FPL's own flag: ${chanceOfPlaying}% chance of playing.`}
        </p>
      )}
    </section>
  );
}

/** FPL's words for a flagged player, without re-deriving availability here. */
function el_news_label(status: string, chance: number | null): string {
  if (status === "u" || status === "n") return "Left the league.";
  if (status === "s") return "Suspended.";
  if (chance != null) return `${chance}% chance of playing`;
  return "Flagged as a doubt.";
}
