import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixturesAll, getPicks } from "@/lib/fpl/endpoints";
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
import { computeGwProfiles } from "@/lib/server/buildBoardDesk";

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

  // Bootstrap gates the gameweek number, so it goes first; everything after it
  // is independent and runs as one wave instead of four serial round trips.
  const boot = await getBootstrapLite();
  const currentGw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);

  const [picksRes, fixturesRes] = await Promise.allSettled([
    getPicks(teamId, currentGw, true),
    getFixturesAll(),
  ]);

  const squadIds: number[] =
    picksRes.status === "fulfilled" ? picksRes.value.picks.map((p) => p.element) : [];

  const allFixtures: Awaited<ReturnType<typeof getFixturesAll>> =
    fixturesRes.status === "fulfilled" ? fixturesRes.value : [];

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

      {/* Transfers live on the Planner now — one desk, not two. */}
      <Link
        href="/planner"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg has-gloss card-lift bg-raised p-4 transition-colors dur-instant hover:bg-surface-3 md:p-5"
      >
        <span>
          <span className="block fig-num text-lg leading-none text-ink-hi">
            Take a run at the transfers
          </span>
          <span className="mt-1 block max-w-[58ch] text-xs leading-relaxed text-ink-mid">
            The Planner stages moves against this grid: your pitch, the full market ranked by
            projected points, the chip lane and the price watch.
          </span>
        </span>
        <span className="skewed inline-flex h-11 items-center rounded-md bg-volt px-4 text-2xs uppercase-label text-on-accent">
          <span>Open the Planner</span>
        </span>
      </Link>
    </div>
  );
}
