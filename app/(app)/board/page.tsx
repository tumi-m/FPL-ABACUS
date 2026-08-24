import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixturesAll, getHistory, getPicks } from "@/lib/fpl/endpoints";
import { HeatGrid } from "@/components/charts/HeatGrid";
import {
  bucket,
  buildFixtureModel,
  cellCode,
  easiness,
  fdrHeat,
  oddsStubHeat,
  projectFixture,
  quantileCuts,
  type ColourModel,
} from "@/lib/engines/fixtureModel";
import type { Pos } from "@/lib/engines/types";
import { BoardDesk, type DeskCandidate, type DeskSquadRow } from "@/components/gaffer/board/BoardDesk";
import {
  buildSolverContext,
  computeFreeTransfers,
  computeGwProfiles,
  fixtureRun,
  markerMap,
  rankPrice,
} from "@/lib/server/buildBoardDesk";

export const dynamic = "force-dynamic";
export const metadata = { title: "The Board" };

const HORIZONS = ["6", "8", "10", "eos"] as const;
type HorizonKey = (typeof HORIZONS)[number];
const MODELS: { key: ColourModel; label: string }[] = [
  { key: "xg", label: "xG" },
  { key: "fdr", label: "FDR" },
  { key: "odds", label: "Odds*" },
];

function parseHorizon(h: string | undefined): HorizonKey {
  return (HORIZONS as readonly string[]).includes(h ?? "") ? (h as HorizonKey) : "8";
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ h?: string; c?: string }>;
}) {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/?next=/board");

  const params = await searchParams;
  const horizonKey = parseHorizon(params.h);
  const colourModel: ColourModel =
    params.c === "fdr" || params.c === "odds" ? params.c : "xg";

  const boot = await getBootstrapLite();
  const currentGw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);

  let squadIds: number[] = [];
  const sellPrices = new Map<number, number>();
  try {
    const picks = await getPicks(teamId, currentGw, true);
    squadIds = picks.picks.map((p) => p.element);
    for (const p of picks.picks) {
      if (p.selling_price != null) sellPrices.set(p.element, p.selling_price);
    }
  } catch {
    squadIds = [];
  }

  let allFixtures: Awaited<ReturnType<typeof getFixturesAll>> = [];
  try {
    allFixtures = await getFixturesAll();
  } catch {
    allFixtures = [];
  }

  const teamById = new Map(boot.teams.map((t) => [t.id, t]));
  const lastGw = boot.events[boot.events.length - 1]?.id ?? 38;
  const horizonLen = horizonKey === "eos" ? Math.min(38, lastGw - currentGw + 1) : Number(horizonKey);
  const horizonGws = boot.events.filter((e) => e.id >= currentGw).slice(0, horizonLen);

  // Rolling-window opponent rates — completed matches only.
  const model = buildFixtureModel(allFixtures, { upToGw: currentGw });

  interface WorkCell {
    value: number;
    text: string;
    title?: string;
    /** null → excluded from the grid's quantile cut points. */
    ease: number | null;
  }

  const workRows = squadIds
    .map((id) => boot.elements[id])
    .filter((el): el is NonNullable<typeof el> => el != null)
    .map((el) => ({ el, pos: el.element_type as Pos }));

  // Pass one — raw easiness per player-gw.
  const passOne: WorkCell[][] = workRows.map(({ el, pos }) =>
    horizonGws.map((gw) => {
      const fxs = allFixtures.filter(
        (f) => f.event === gw.id && (f.team_h === el.team || f.team_a === el.team),
      );
      if (fxs.length === 0) {
        return { value: 1, text: "—", title: `GW${gw.id} · ${el.web_name} · no fixture — a sunk hole`, ease: null };
      }
      if (fxs.length > 1 && colourModel !== "xg") {
        return { value: 4, text: "2×", title: `GW${gw.id} · ${el.web_name} · double gameweek`, ease: null };
      }
      if (colourModel === "fdr") {
        const f = fxs[0];
        const home = f.team_h === el.team;
        const opp = teamById.get(home ? f.team_a : f.team_h);
        const diff = home ? f.team_a_difficulty : f.team_h_difficulty;
        return {
          value: fdrHeat(diff),
          text: cellCode(opp?.short_name ?? "?", home),
          title: `GW${gw.id} · ${el.web_name} · official FDR ${diff}`,
          ease: null,
        };
      }
      if (colourModel === "odds") {
        const f = fxs[0];
        const home = f.team_h === el.team;
        const opp = teamById.get(home ? f.team_a : f.team_h);
        return {
          value: oddsStubHeat(teamById.get(el.team)?.strength ?? 3, opp?.strength ?? 3),
          text: cellCode(opp?.short_name ?? "?", home),
          title: `GW${gw.id} · ${el.web_name} · odds stub from overall strength ratings`,
          ease: null,
        };
      }
      // xG model — position aware, doubles averaged.
      const proj = fxs.map((f) => {
        const home = f.team_h === el.team;
        const oppId = home ? f.team_a : f.team_h;
        return { p: projectFixture(model, el.team, oppId, home), oppId, home };
      });
      const ease = proj.reduce((s, x) => s + easiness(x.p, pos), 0) / proj.length;
      return {
        value: 3,
        text: proj.map((x) => cellCode(teamById.get(x.oppId)?.short_name ?? "?", x.home)).join("/"),
        title: `GW${gw.id} · ${el.web_name} · xG ~${proj.map((x) => x.p.xgFor.toFixed(2)).join("/")} · conceded ~${proj.map((x) => x.p.xgAgainst.toFixed(2)).join("/")}`,
        ease,
      };
    }),
  );

  const cuts = quantileCuts(
    passOne.flat().map((c) => c.ease).filter((v): v is number => v != null),
    6,
  );

  // Pass two — bucket onto the six-step heat.
  const rows = workRows.map(({ el }, i) => ({
    label: el.web_name,
    cells: passOne[i].map((c) => ({ ...c, value: c.ease == null ? c.value : bucket(c.ease, cuts) })),
  }));

  const gwProfiles = computeGwProfiles(allFixtures, horizonGws.map((g) => g.id));

  // Desk props — staging + chip lane.
  const squadSet = new Set(squadIds);
  const shortOf = (tid: number) => boot.teams.find((t) => t.id === tid)?.short_name ?? "?";
  const runFor = (clubId: number) =>
    fixtureRun(clubId, allFixtures, horizonGws.map((g) => g.id), shortOf);
  const solver = buildSolverContext(allFixtures, horizonGws.map((g) => g.id), currentGw);
  const project = (el: (typeof boot.elements)[number]) =>
    solver.project({
      pos: el.element_type,
      teamId: el.team,
      epNext: el.ep_next,
      form: el.form,
      status: el.status,
      chanceOfPlaying: el.chance_of_playing_this_round,
    });
  const deskSquad: DeskSquadRow[] = workRows.map(({ el }) => ({
    element: el.id,
    webName: el.web_name,
    pos: el.element_type,
    nowCost: el.now_cost,
    sellPrice: sellPrices.get(el.id) ?? null,
    epNext: el.ep_next,
    photo: el.photo,
    runLabel: runFor(el.team),
    horizon: project(el),
  }));
  const deskCandidates: DeskCandidate[] = Object.values(boot.elements)
    .filter((e) => !squadSet.has(e.id))
    .sort((a, b) => b.total_points - a.total_points)
    .slice(0, 50)
    .map((e) => ({
      id: e.id,
      webName: e.web_name,
      pos: e.element_type,
      nowCost: e.now_cost,
      epNext: e.ep_next,
      photo: e.photo,
      runLabel: runFor(e.team),
      horizon: project(e),
    }));

  let bankTenths = 0;
  let freeTransfers = 1;
  try {
    const history = await getHistory(teamId);
    bankTenths = history.current[history.current.length - 1]?.bank ?? 0;
    freeTransfers = computeFreeTransfers(history.current, history.chips, currentGw);
  } catch {
    bankTenths = 0;
  }
  const wallGw = boot.chips.length ? Math.min(...boot.chips.map((ch) => ch.stop_event)) : null;
  const chipKeys = boot.chips
    .map((ch) => ({ key: chipKey(ch.name, ch.number), label: chipLabel(ch.name), stopEvent: ch.stop_event }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const qs = (over: { h?: string; c?: string }) => {
    const p = new URLSearchParams({ h: horizonKey, c: colourModel });
    for (const [k, v] of Object.entries(over)) p.set(k, v);
    return `/board?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="fig-num text-[22px] leading-none">The Board</h1>
          <p className="mt-1 text-2xs uppercase-label text-ink-lo">
            Fixture reality · rolling window shrunk to league mean (k=6)
          </p>
        </div>
      </div>

      {/* controls — skewed chrome, state in the URL */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Horizon" className="flex gap-1 rounded-md card-ring p-1">
          {HORIZONS.map((key) => (
            <Link
              key={key}
              href={qs({ h: key })}
              aria-pressed={horizonKey === key}
              role="button"
              className={`skewed rounded-sm px-3 py-1.5 text-xs uppercase-label transition-colors dur-instant ${
                horizonKey === key ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi"
              }`}
            >
              <span>{key === "eos" ? "EoS" : key}</span>
            </Link>
          ))}
        </div>
        <div role="group" aria-label="Colour model" className="flex gap-1 rounded-md card-ring p-1">
          {MODELS.map((m) => (
            <Link
              key={m.key}
              href={qs({ c: m.key })}
              aria-pressed={colourModel === m.key}
              role="button"
              className={`skewed rounded-sm px-3 py-1.5 text-xs uppercase-label transition-colors dur-instant ${
                colourModel === m.key ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi"
              }`}
            >
              <span>{m.label}</span>
            </Link>
          ))}
        </div>
        <p className="ml-auto max-w-[46ch] text-2xs leading-relaxed text-ink-lo">
          UPPERCASE home, lowercase away. Attackers colour by what your side should score; keepers
          and defenders by what it should concede.
        </p>
      </div>

      {/* fixture grid — the screen's hero */}
      <section aria-label="Fixture difficulty grid" className="space-y-2">
        <h2 className="upper-label text-2xs text-ink-lo">Fixture grid</h2>
        <HeatGrid
          ariaLabel={`Fixture difficulty grid across the ${horizonKey === "eos" ? "rest of the season" : `next ${horizonLen} gameweeks`}`}
          rows={rows}
        />
      </section>

      <section aria-label="Blanks and doubles in the horizon" className="space-y-2">
        <h2 className="upper-label text-2xs text-ink-lo">Blanks &amp; doubles</h2>
        <ul className="flex flex-wrap gap-2 text-xs text-ink-3 num-tabular">
          {gwProfiles.map((p) => {
            const parts: string[] = [];
            if (p.doubles > 0) parts.push(`${p.doubles} double${p.doubles === 1 ? "" : "s"}`);
            if (p.byes > 0) parts.push(`${p.byes} blank`);
            return (
              <li key={p.id} className="rounded-full card-ring px-2.5 py-1">
                GW{p.id}: {parts.length > 0 ? parts.join(" · ") : "full slate"}
              </li>
            );
          })}
        </ul>
      </section>

      <BoardDesk
        teamId={teamId}
        squad={deskSquad}
        candidates={deskCandidates}
        gws={horizonGws.map((g) => g.id)}
        currentGw={currentGw}
        wallGw={wallGw}
        chips={chipKeys}
        bankTenths={bankTenths}
        freeTransfers={freeTransfers}
        markers={markerMap(gwProfiles)}
        ranksPerPoint={await rankPrice(teamId, currentGw)}
      />
    </div>
  );
}

function chipKey(name: string, number: number): string {
  if (name === "wildcard") return number === 1 ? "wc1" : "wc2";
  if (name === "freehit") return "fh";
  if (name === "bboost") return "bb";
  return `chip-${number}`;
}

function chipLabel(name: string): string {
  switch (name) {
    case "wildcard":
      return "Wildcard";
    case "freehit":
      return "Free Hit";
    case "bboost":
      return "Bench Boost";
    default:
      return name;
  }
}
