import Link from "next/link";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixturesAll } from "@/lib/fpl/endpoints";
import { buildPercentiles, bandOf, BAND_FILL } from "@/lib/engines/playerPercentiles";
import { defaultMinutesFloor } from "@/lib/engines/performance";
import { buildSolverContext } from "@/lib/server/buildBoardDesk";
import { PROJECTION_METHOD } from "@/lib/engines/planner";
import { Est } from "@/components/gaffer/Est";
import { Published } from "@/components/gaffer/Provenance";
import { Meter } from "@/components/charts/Meter";
import { ChartFrame, ChartLegend, type ChartTable } from "@/components/charts/ChartFrame";
import { SLOT_VAR } from "@/lib/charts/series";
import { SelfAvatar } from "@/components/gaffer/PlayerAvatarClient";
import { formatPrice, POSITION_SHORT } from "@/lib/ui/format";
import { PageHeader } from "@/components/gaffer/PageHeader";
import { BackLink } from "@/components/gaffer/BackLink";
import { CompareControls } from "@/components/gaffer/compare/CompareControls";
import { CompareMinutes } from "@/components/gaffer/compare/CompareMinutes";
import { cn } from "@/lib/ui/cn";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Player compare",
  description: "Up to five players side by side: percentiles, fixtures, projected points, minutes certainty and price.",
};

/** Five — Fantasy Football Fix ships five, so four reads as the worse version. */
const MAX_COMPARE = 5;

/**
 * The metrics every compared player is ranked on. All exist for every
 * position, so a keeper against a forward still fills every row — the bars
 * rank within position, which the footnote says out loud rather than letting
 * a 90th-percentile keeper look like a 90th-percentile forward.
 */
const METRIC_KEYS = ["points", "goals", "assists", "xgi", "bonus", "defcon", "perMillion"] as const;

interface ComparePlayer {
  id: number;
  name: string;
  pos: number;
  team: number;
  club: string;
  photo: string;
  price: number;
  owned: number;
  form: number;
  minutes: number;
  startPrice: number;
  gwMove: number;
  metrics: { key: string; label: string; display: string; percentile: number | null; hint: string }[];
  fixtures: { gw: number; opp: string; home: boolean; difficulty: number }[];
  xpts: number[];
}

function parseIds(raw: string | undefined, valid: Set<number>): { ids: number[]; dropped: number } {
  if (!raw) return { ids: [], dropped: 0 };
  const seen = new Set<number>();
  let dropped = 0;
  for (const part of raw.split(",")) {
    const id = Number(part.trim());
    if (!Number.isInteger(id) || !valid.has(id) || seen.has(id)) {
      if (part.trim() !== "") dropped++;
      continue;
    }
    if (seen.size >= MAX_COMPARE) {
      dropped++;
      continue;
    }
    seen.add(id);
  }
  return { ids: [...seen], dropped };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const boot = await getBootstrapLite();
  const params = await searchParams;
  const allPlayers = Object.values(boot.elements).filter((el) => el.status !== "u");
  const valid = new Set(allPlayers.map((el) => el.id));
  const { ids, dropped } = parseIds(params.ids, valid);

  const currentGw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);
  const gwIds = boot.events.filter((e) => e.id >= currentGw).slice(0, 6).map((e) => e.id);

  const floor = defaultMinutesFloor(allPlayers);
  const fixtures = await getFixturesAll().catch(() => []);
  const solver =
    ids.length > 0 ? buildSolverContext(fixtures, gwIds, currentGw) : null;

  const teamOf = (tid: number) => boot.teams.find((t) => t.id === tid);
  const codeOf = (tid: number) => teamOf(tid)?.short_name ?? "?";

  const players: ComparePlayer[] = ids.map((id) => {
    const el = boot.elements[id]!;
    const read = buildPercentiles({ player: el, all: allPlayers, minMinutes: floor });
    const byKey = new Map(read.groups.flatMap((g) => g.rows).map((r) => [r.key, r]));
    const metrics = METRIC_KEYS.map((key) => {
      const r = byKey.get(key);
      return {
        key,
        label: r?.label ?? key,
        display: r?.display ?? "—",
        percentile: r?.percentile ?? null,
        hint: r?.hint ?? "",
      };
    });
    const upcoming = fixtures
      .filter((f) => f.event != null && f.event >= currentGw && !f.finished && (f.team_h === el.team || f.team_a === el.team))
      .sort((a, b) => (a.event ?? 0) - (b.event ?? 0) || String(a.kickoff_time ?? "").localeCompare(String(b.kickoff_time ?? "")))
      .slice(0, 5)
      .map((f) => {
        const home = f.team_h === el.team;
        return {
          gw: f.event ?? currentGw,
          opp: codeOf(home ? f.team_a : f.team_h),
          home,
          difficulty: home ? f.team_h_difficulty : f.team_a_difficulty,
        };
      });
    const xpts = solver
      ? solver.project({
          pos: el.element_type,
          teamId: el.team,
          epNext: el.ep_next,
          form: el.form,
          status: el.status,
          chanceOfPlaying: el.chance_of_playing_next_round ?? el.chance_of_playing_this_round,
        })
      : [];
    return {
      id: el.id,
      name: el.web_name,
      pos: el.element_type,
      team: el.team,
      club: codeOf(el.team),
      photo: el.photo,
      price: el.now_cost,
      owned: el.selected_by_percent,
      form: el.form,
      minutes: el.minutes,
      startPrice: el.now_cost - el.costChangeStart,
      gwMove: el.costChangeEvent,
      metrics,
      fixtures: upcoming,
      xpts,
    };
  });

  return (
    <div className="space-y-4">
      <BackLink href="/players" label="All players" />
      <PageHeader
        title="Player compare"
        meta={players.length > 0 ? `${players.length} player${players.length === 1 ? "" : "s"} · percentiles against same-position peers` : "Pick up to five players"}
        action={<CompareControls ids={ids} />}
      />

      {dropped > 0 && (
        <p className="rounded-md bg-surface-1 card-ring px-4 py-2.5 text-xs text-ink-lo">
          {dropped} id{dropped === 1 ? " was" : "s were"} not comparable players — dropped, not guessed at.
        </p>
      )}

      {players.length === 0 ? (
        <div className="rounded-lg bg-surface-1 card-ring p-10 text-center">
          <h2 className="text-lg font-medium">Nobody on the comparison table yet</h2>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm text-ink-2">
            Search above to add up to five players. The table — and this page&rsquo;s address —
            updates with each pick, so a mini-league argument ends with a link.
          </p>
        </div>
      ) : (
        <>
          <IdentityRow players={players} ids={ids} />
          <PercentileGrid players={players} floor={floor} />
          <XpChart players={players} gwIds={gwIds} />
          <FixtureGrid players={players} />
          <CompareMinutes ids={ids} names={new Map(players.map((p) => [p.id, p.name]))} />
          <PriceGrid players={players} />
        </>
      )}
    </div>
  );
}

/** Faces, names, prices — and the remove links that keep the URL honest. */
function IdentityRow({ players, ids }: { players: ComparePlayer[]; ids: number[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[560px] gap-3" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
        {players.map((p) => {
          const rest = ids.filter((id) => id !== p.id);
          return (
            <div key={p.id} className="rounded-lg bg-surface-1 card-ring p-3 text-center">
              <span className="mx-auto block h-14 w-14 overflow-hidden rounded-md bg-surface-3">
                <SelfAvatar photo={p.photo} teamId={p.team} className="h-14 w-14 object-cover object-top" eager />
              </span>
              <p className="mt-2 truncate text-sm font-semibold text-ink-hi">
                <Link href={`/players/${p.id}`} className="hover:text-brand">{p.name}</Link>
              </p>
              <p className="text-2xs uppercase-label text-ink-lo">
                {POSITION_SHORT[p.pos]} · {p.club}
              </p>
              <p className="mt-1 text-xs text-ink-2 num-tabular">
                <Published>{`${formatPrice(p.price)} · ${p.owned.toFixed(1)}% owned · form ${p.form}`}</Published>
              </p>
              <Link
                href={rest.length > 0 ? `/compare?ids=${rest.join(",")}` : "/compare"}
                aria-label={`Remove ${p.name} from comparison`}
                className="mt-1.5 inline-block text-2xs uppercase-label text-ink-lo transition-colors hover:text-flare"
              >
                Remove
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One metric per row, one bar per player — bars rank within position. */
function PercentileGrid({ players, floor }: { players: ComparePlayer[]; floor: number }) {
  return (
    <section aria-label="Percentile comparison" className="overflow-x-auto rounded-lg bg-surface-1 card-ring p-4 md:p-5">
      <h2 className="mb-1 text-2xs font-semibold uppercase tracking-wide text-ink-3">Against their own position</h2>
      <table className="w-full min-w-[560px] text-sm num-tabular">
        <thead>
          <tr className="border-b border-hairline text-left text-2xs uppercase tracking-wide text-ink-3">
            <th className="py-1.5 pr-2 font-semibold">Stat · per 90 unless named</th>
            {players.map((p) => (
              <th key={p.id} className="px-2 py-1.5 text-right font-semibold">{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_KEYS.map((key) => (
            <tr key={key} className="border-b border-hairline last:border-0">
              <td className="py-2 pr-2 text-xs text-ink-2" title={players[0]?.metrics.find((m) => m.key === key)?.hint}>
                {players[0]?.metrics.find((m) => m.key === key)?.label ?? key}
              </td>
              {players.map((p) => {
                const m = p.metrics.find((mm) => mm.key === key);
                const band = m?.percentile != null ? bandOf(m.percentile) : null;
                return (
                  <td key={p.id} className="px-2 py-2 text-right">
                    <span className="block text-xs font-semibold text-ink-hi">{m?.display ?? "—"}</span>
                    {m?.percentile != null && band ? (
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${p.name}: ${m.percentile}th percentile`}>
                        <span className="block h-full rounded-full" style={{ width: `${m.percentile}%`, background: BAND_FILL[band] }} />
                      </span>
                    ) : (
                      <span className="mt-1 block text-right text-2xs text-ink-lo">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-b border-hairline last:border-0">
            <td className="py-2 pr-2 text-xs text-ink-2">Minutes played</td>
            {players.map((p) => (
              <td key={p.id} className="px-2 py-2 text-right text-xs text-ink-mid">
                <Published>{p.minutes.toLocaleString("en-GB")}</Published>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-2xs leading-relaxed text-ink-lo">
        Bars rank each player against same-position peers with at least {floor} minutes — a bar
        compares standing, not output, across positions. Values come from FPL&rsquo;s published
        season figures.
      </p>
    </section>
  );
}

/** Projected points over the next six — one line per player, slots in order. */
function XpChart({ players, gwIds }: { players: ComparePlayer[]; gwIds: number[] }) {
  const W = 560;
  const H = 220;
  const M = { top: 14, right: 14, bottom: 28, left: 40 };
  const max = Math.max(2, ...players.flatMap((p) => p.xpts));
  const x = (i: number) => M.left + ((W - M.left - M.right) * i) / Math.max(1, gwIds.length - 1);
  const y = (v: number) => H - M.bottom - ((v / max) * (H - M.top - M.bottom));
  const table: ChartTable = {
    headers: ["GW", ...players.map((p) => p.name)],
    rows: gwIds.map((gw, i) => [`GW${gw}`, ...players.map((p) => (p.xpts[i] ?? 0).toFixed(1))]),
  };
  return (
    <ChartFrame
      eyebrow="Projection"
      title="Expected points over the run"
      ariaLabel={`Projected points over the next ${gwIds.length} gameweeks for ${players.map((p) => p.name).join(", ")}`}
      caption="FPL's own next-gameweek expectation blended with form, scaled per fixture by the opponent model. A projection, not a promise."
      legend={<ChartLegend items={players.map((p, i) => ({ name: p.name, colorVar: SLOT_VAR[(i % 8) + 1]! }))} />}
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={M.left} x2={W - M.right} y1={y(max * f)} y2={y(max * f)} stroke="var(--grid)" strokeWidth="1" />
        ))}
        {players.map((p, i) => {
          const color = SLOT_VAR[(i % 8) + 1]!;
          const d = p.xpts.map((v, j) => `${j === 0 ? "M" : "L"}${x(j).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          return (
            <g key={p.id}>
              <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
                <title>{`${p.name}: ${p.xpts.map((v) => v.toFixed(1)).join(" · ")}`}</title>
              </path>
              {p.xpts.map((v, j) => (
                <circle key={j} cx={x(j)} cy={y(v)} r="3" fill={color} />
              ))}
            </g>
          );
        })}
        {gwIds.map((gw, i) => (
          <text key={gw} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" className="fill-(--ink-lo) num-tabular">
            {gw}
          </text>
        ))}
      </svg>
      <p className="mt-2 text-2xs text-ink-lo">
        Six-week totals:{" "}
        {players.map((p, i) => (
          <span key={p.id} className={cn(i > 0 && "ml-3")}>
            {p.name}{" "}
            <Est method={PROJECTION_METHOD}>{p.xpts.reduce((s, v) => s + v, 0).toFixed(1)}</Est>
          </span>
        ))}
      </p>
    </ChartFrame>
  );
}

/** The next five fixtures each — difficulty is FPL's own 1–5. */
function FixtureGrid({ players }: { players: ComparePlayer[] }) {
  return (
    <section aria-label="Coming fixtures" className="overflow-x-auto rounded-lg bg-surface-1 card-ring p-4 md:p-5">
      <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wide text-ink-3">Next five each</h2>
      <div className="grid min-w-[560px] gap-3" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
        {players.map((p) => (
          <div key={p.id}>
            <p className="mb-1.5 text-xs font-semibold text-ink-hi">{p.name}</p>
            {p.fixtures.length === 0 ? (
              <p className="text-2xs text-ink-lo">No fixtures scheduled.</p>
            ) : (
              <ul className="space-y-1.5">
                {p.fixtures.map((f, i) => (
                  <li key={`${f.gw}-${i}`} className="flex items-center gap-2">
                    <span className="w-9 shrink-0 text-2xs text-ink-lo num-tabular">GW{f.gw}</span>
                    <span className="w-10 shrink-0 text-xs text-ink-1">
                      {f.home ? "" : "@"}{f.opp}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Meter value={1 - (f.difficulty - 1) / 4} hint={`FDR ${f.difficulty}`} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Season price move — published figures, no curve invented between them. */
function PriceGrid({ players }: { players: ComparePlayer[] }) {
  return (
    <section aria-label="Price moves" className="overflow-x-auto rounded-lg bg-surface-1 card-ring p-4 md:p-5">
      <h2 className="mb-1 text-2xs font-semibold uppercase tracking-wide text-ink-3">What they cost</h2>
      <table className="w-full min-w-[560px] text-sm num-tabular">
        <tbody>
          <tr className="border-b border-hairline last:border-0">
            <td className="py-2 pr-2 text-xs text-ink-2">Now</td>
            {players.map((p) => (
              <td key={p.id} className="px-2 py-2 text-right font-semibold text-ink-hi">
                <Published>{formatPrice(p.price)}</Published>
              </td>
            ))}
          </tr>
          <tr className="border-b border-hairline last:border-0">
            <td className="py-2 pr-2 text-xs text-ink-2">Since the opener</td>
            {players.map((p) => (
              <td key={p.id} className="px-2 py-2 text-right text-xs text-ink-mid">
                <Published>{`${formatPrice(p.startPrice)} → ${formatPrice(p.price)}`}</Published>
              </td>
            ))}
          </tr>
          <tr className="border-b border-hairline last:border-0">
            <td className="py-2 pr-2 text-xs text-ink-2">This gameweek</td>
            {players.map((p) => (
              <td key={p.id} className={cn("px-2 py-2 text-right text-xs", p.gwMove > 0 ? "text-surge" : p.gwMove < 0 ? "text-flare" : "text-ink-lo")}>
                <Published>{p.gwMove === 0 ? "—" : `${p.gwMove > 0 ? "▲" : "▼"} £${Math.abs(p.gwMove / 10).toFixed(1)}m`}</Published>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}
