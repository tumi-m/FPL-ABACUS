"use client";

import * as React from "react";
import useSWR from "swr";
import { cn } from "@/lib/ui/cn";
import { clubOf } from "@/config/clubs";
import { EOScatter } from "@/components/charts/EOScatter";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

const POLL_LIVE_MS = 20_000;
const POLL_IDLE_MS = 300_000;

type Mode = "points" | "ownership" | "swing" | "leverage";
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "points", label: "Points", hint: "Live points per player" },
  { id: "ownership", label: "Ownership", hint: "Effective ownership in the selected cohort — template fades, differentials burn" },
  { id: "swing", label: "Swing", hint: "Ranks gained or lost so far, per player" },
  { id: "leverage", label: "Leverage", hint: "Expected rank swing still available" },
];

interface RivalPick { element: number; position: number; is_captain: boolean; multiplier: number }

export function FieldClient({ initialModel }: { initialModel: MatchdayModel }) {
  const [mode, setMode] = React.useState<Mode>("points");
  const [rivalIdRaw, setRivalIdRaw] = React.useState("");
  const entry = initialModel.entry.id;
  const gw = initialModel.event.id;

  const { data } = useSWR<MatchdayModel>(
    ["gaffer-live", entry],
    async ([, e]: [string, number]) => {
      const res = await fetch(`/api/gaffer/live?entry=${e}`);
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as MatchdayModel;
    },
    {
      fallbackData: initialModel,
      refreshInterval: (latest?: MatchdayModel) => {
        if (typeof document !== "undefined" && document.hidden) return 0;
        const p = latest?.phase ?? initialModel.phase;
        return p === "live" || p === "provisional" ? POLL_LIVE_MS : POLL_IDLE_MS;
      },
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );
  const model = (data as MatchdayModel | undefined) ?? initialModel;

  // swing + leverage keyed by element for token lookups
  const swingByElement = React.useMemo(
    () => new Map(model.swings.map((s) => [s.element, s])),
    [model.swings],
  );
  const leverageByElement = React.useMemo(
    () => new Map(model.leverage.yours.map((l) => [l.element, l])),
    [model.leverage.yours],
  );

  // ── compare mode ──────────────────────────────────────────────────────
  const [rivalPicks, setRivalPicks] = React.useState<RivalPick[] | null>(null);
  const [rivalError, setRivalError] = React.useState<string | null>(null);
  const loadRival = async () => {
    const id = Number(rivalIdRaw);
    setRivalError(null);
    if (!Number.isFinite(id) || id <= 0) return;
    try {
      const res = await fetch(`/api/fpl/entry/${id}/event/${gw}/picks`);
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { picks: RivalPick[] };
      setRivalPicks(json.picks);
    } catch {
      setRivalPicks(null);
      setRivalError("Couldn't load that entry's picks.");
    }
  };

  const starters = model.squad.filter((s) => !s.onBench);
  const rows = [1, 2, 3, 4].map((pos) =>
    starters.filter((s) => s.pos === pos).sort((a, b) => b.multiplier - a.multiplier),
  );
  const bench = model.squad.filter((s) => s.onBench);

  const rivalSet = React.useMemo(() => new Set(rivalPicks?.map((p) => p.element) ?? []), [rivalPicks]);

  return (
    <div className="space-y-4">
      {/* lower-third header */}
      <div className="lower3">
        <div className="lower3-flag bg-volt" />
        <div className="lower3-body">
          <h1 className="fig-num text-[22px] leading-none">The Field</h1>
          <span className="text-2xs uppercase-label text-ink-lo">GW{gw} · {model.phase}</span>
          <span className="ml-auto hidden text-2xs text-ink-lo sm:inline">
            {MODES.find((m) => m.id === mode)?.hint}
          </span>
        </div>
      </div>

      {/* mode segmented control — skewed chrome */}
      <div role="group" aria-label="Field mode" className="flex flex-wrap gap-1 rounded-md card-ring p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            className={cn("skewed rounded-sm px-3 py-1.5 text-xs uppercase-label transition-colors dur-instant",
              mode === m.id ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi")}
          >
            <span>{m.label}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 pr-1">
          <input
            value={rivalIdRaw}
            onChange={(e) => setRivalIdRaw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadRival()}
            placeholder="Compare entry id"
            inputMode="numeric"
            className="h-7 w-36 rounded-sm border border-line bg-sunk px-2 text-xs text-ink-hi placeholder:text-ink-lo focus:outline-none focus-visible:outline focus-visible:outline-volt"
            aria-label="Rival entry id"
          />
          <button onClick={loadRival} className="skewed rounded-sm bg-raised px-2.5 py-1 text-xs uppercase-label text-ink-mid hover:text-ink-hi">
            <span>{rivalPicks ? "Clear" : "Compare"}</span>
          </button>
        </div>
      </div>

      {rivalError && <p role="alert" className="text-sm text-flare">{rivalError}</p>}
      {rivalPicks && (
        <p className="text-xs text-ink-mid num-tabular">
          Compare mode — shared players sit on the halfway line, dimmed. Yours near, theirs far.
        </p>
      )}

      {/* the pitch — night-lit, not a green rectangle */}
      <section aria-label={`Your team on the pitch, ${mode} mode`} className="rounded-lg has-gloss card-lift overflow-hidden bg-raised p-3 md:p-5">
        <div
          className="relative overflow-hidden rounded-lg px-2 py-4 md:px-6"
          style={{
            background:
              "radial-gradient(120% 90% at 50% -10%, rgba(157,240,255,.13), transparent 55%), repeating-linear-gradient(90deg, rgba(157,240,255,.03) 0 64px, transparent 64px 128px), var(--bg-sunk)",
          }}
        >
          {/* 1px markings at 40% */}
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-40" preserveAspectRatio="none" viewBox="0 0 100 100">
            <g fill="none" stroke="var(--line-hi)" strokeWidth="0.25">
              <rect x="4" y="4" width="92" height="92" />
              <line x1="4" y1="50" x2="96" y2="50" />
              <circle cx="50" cy="50" r="9" />
              <rect x="26" y="4" width="48" height="14" />
              <rect x="26" y="82" width="48" height="14" />
            </g>
          </svg>

          {rivalPicks ? (
            <ComparePitch
              rows={rows} model={model} mode={mode} rivalPicks={rivalPicks}
              swingByElement={swingByElement} leverageByElement={leverageByElement} rivalSet={rivalSet}
            />
          ) : (
            <div className="relative space-y-2.5">
              {rows.map((row, i) => (
                <ul key={i} className="flex flex-wrap items-start justify-center gap-2">
                  {row.map((p) => (
                    <li key={p.element}>
                      <ShirtToken row={p} mode={mode} swing={swingByElement.get(p.element)} lev={leverageByElement.get(p.element)} />
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          )}
        </div>

        <h3 className="mb-2 mt-4 upper-label text-ink-lo">Bench</h3>
        <ul className="flex flex-wrap gap-2 opacity-70">
          {bench.map((p) => (
            <li key={p.element}>
              <ShirtToken row={p} mode={mode} swing={swingByElement.get(p.element)} lev={leverageByElement.get(p.element)} />
            </li>
          ))}
        </ul>
      </section>

      <EOScatter rows={model.squad} />
    </div>
  );
}

type SquadRow = MatchdayModel["squad"][number];
type SwingRow = MatchdayModel["swings"][number];
type LevRow = MatchdayModel["leverage"]["yours"][number];

function modeValue(row: SquadRow, mode: Mode, swing?: SwingRow, lev?: LevRow): { text: string; tone: "volt" | "surge" | "flare" | "ultra" | "plain" } {
  switch (mode) {
    case "points": {
      const live = row.fixtureState === "live";
      return { text: String(row.livePoints), tone: live ? "volt" : "plain" };
    }
    case "ownership":
      return { text: `${Math.round(row.eo)}%`, tone: row.eo >= 50 ? "plain" : row.eo <= 10 ? "ultra" : "plain" };
    case "swing": {
      const g = swing?.ranksGained ?? 0;
      if (!swing || g === 0) return { text: "—", tone: "plain" };
      const k = Math.abs(g) >= 1000 ? `${(g / 1000).toFixed(1)}k` : String(Math.abs(g));
      return g > 0
        ? { text: `▲${k}`, tone: "surge" }
        : { text: `▼${k}`, tone: "flare" };
    }
    case "leverage": {
      if (!lev) return { text: "—", tone: "plain" };
      return { text: `~${(lev.expected / 1000).toFixed(1)}k`, tone: "ultra" };
    }
  }
}

/** Club-coloured SVG shirt with sleeve shade, armband, arcs and state rings. */
export function ShirtToken({
  row, mode, swing, lev,
}: { row: SquadRow; mode: Mode; swing?: SwingRow; lev?: LevRow }) {
  const club = clubOf(row.teamId);
  const done = row.fixtureState === "done";
  const live = row.fixtureState === "live";
  const val = modeValue(row, mode, swing, lev);
  const defconPct = row.defconThreshold < 99 ? Math.min(1, row.defconCount / row.defconThreshold) : 0;

  return (
    <div className={cn("relative w-[76px] text-center", done && "opacity-55")} title={`${row.webName} · ${club.name}`}>
      {/* yet-to-play soft ring / live pulse */}
      {!done && (
        <span
          aria-hidden
          className={cn("absolute -inset-1 rounded-lg", live && "animate-[gaffer-live-ring_2s_infinite]")}
          style={{ boxShadow: live ? undefined : "inset 0 0 0 1.5px color-mix(in oklab, var(--volt) 45%, transparent)" }}
        />
      )}
      {/* DEFCON progress arc */}
      {defconPct > 0 && (
        <svg aria-hidden viewBox="0 0 40 40" className="absolute -left-1.5 -top-1.5 h-6 w-6 -rotate-90">
          <circle cx="20" cy="20" r="17" fill="none" stroke="var(--bg-overlay)" strokeWidth="5" />
          <circle cx="20" cy="20" r="17" fill="none" stroke="var(--surge)" strokeWidth="5" strokeDasharray={`${defconPct * 106.8} 106.8`} strokeLinecap="round" />
        </svg>
      )}
      {/* provisional bonus dots */}
      {row.provisionalBonus > 0 && (
        <span className="absolute right-0 top-0 flex gap-0.5" aria-label={`${row.provisionalBonus} provisional bonus`}>
          {Array.from({ length: Math.min(3, row.provisionalBonus) }).map((_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-amber" />
          ))}
        </span>
      )}

      {/* shirt */}
      <svg viewBox="0 0 64 56" className="mx-auto h-11 w-12 drop-shadow-[0_4px_10px_rgba(0,0,0,.45)]" aria-hidden>
        <path d="M20 4 L27 1 Q32 4 37 1 L44 4 L58 12 L52 24 L46 21 L46 54 L18 54 L18 21 L12 24 L6 12 Z"
          fill={club.rail} stroke="rgba(0,0,0,.35)" strokeWidth="1" />
        <path d="M44 4 L58 12 L52 24 L46 21 L46 12 Z" fill="color-mix(in oklab, currentColor 100%, black)" style={{ color: club.rail }} opacity="0.22" />
        {row.isCaptain && <path d="M25 15 Q32 20 39 15" fill="none" stroke="var(--volt)" strokeWidth="3.5" strokeLinecap="round" />}
      </svg>

      {row.subbedInFor !== null && (
        <span aria-label="Projected auto-substitute" title="Projected auto-sub in" className="absolute right-0 top-7 text-xs font-bold text-ultra">⇅</span>
      )}

      <span className="mt-0.5 block truncate text-2xs font-semibold text-ink-hi">{row.webName}</span>

      {/* value pill on the shoulder */}
      <span
        className={cn(
          "mt-0.5 inline-block min-w-7 skewed rounded-sm px-1 py-px text-2xs font-extrabold num-tabular",
          val.tone === "volt" && "bg-volt text-on-accent",
          val.tone === "surge" && "bg-transparent text-surge",
          val.tone === "flare" && "bg-transparent text-flare",
          val.tone === "ultra" && "bg-transparent text-ultra",
          val.tone === "plain" && "bg-overlay text-ink-mid card-ring",
        )}
      >
        <span>{val.text}</span>
      </span>
    </div>
  );
}

/** Two XIs on one pitch — yours near half, rival far half, shared dimmed on halfway. */
function ComparePitch({
  rows, model, mode, rivalPicks, swingByElement, leverageByElement, rivalSet,
}: {
  rows: SquadRow[][]; model: MatchdayModel; mode: Mode; rivalPicks: RivalPick[];
  swingByElement: Map<number, SwingRow>; leverageByElement: Map<number, LevRow>; rivalSet: Set<number>;
}) {
  const rivalStarters = rivalPicks.filter((p) => p.position <= 11).map((p) => p.element);
  const rivalRows = [1, 2, 3, 4].map((pos) =>
    rivalPicks.filter((p) => p.position <= 11 && posBand(p.element, model) === pos).map((p) => p.element),
  );
  void rows;
  return (
    <div className="relative space-y-2.5">
      {/* far half — rival (reversed order so GK sits at the far end) */}
      {[...rivalRows].reverse().map((row, i) => (
        <ul key={`rv${i}`} className="flex flex-wrap items-start justify-center gap-2 opacity-80">
          {row.map((el) => (
            <li key={el} className={cn(rivalSet.has(el) && "opacity-40 blur-[0.4px]")}>
              <GhostToken element={el} model={model} isShared={false} />
            </li>
          ))}
        </ul>
      ))}
      {/* halfway line */}
      <div className="relative my-1 h-px bg-line-hi/60" />
      {/* near half — you, shared players pulled to the line and dimmed */}
      {rows.map((row, i) => (
        <ul key={`me${i}`} className="flex flex-wrap items-start justify-center gap-2">
          {row.map((p) => (
            <li key={p.element} className={rivalSet.has(p.element) ? "opacity-40" : ""}>
              {rivalSet.has(p.element)
                ? <GhostToken element={p.element} model={model} isShared />
                : <ShirtToken row={p} mode={mode} swing={swingByElement.get(p.element)} lev={leverageByElement.get(p.element)} />}
            </li>
          ))}
        </ul>
      ))}
      <p className="pt-1 text-center text-2xs text-ink-lo num-tabular">
        {rivalStarters.filter((e) => rivalSet.has(e)).length ? "" : ""}
        Shared: {[...rivalSet].length} of 15 overlap · rival shown flat until picks load live data
      </p>
    </div>
  );
}

function posBand(element: number, model: MatchdayModel): number {
  return model.squad.find((s) => s.element === element)?.pos ?? 4;
}

/** Minimal token for rival players we don't hold live data for. */
function GhostToken({ element, model, isShared }: { element: number; model: MatchdayModel; isShared: boolean }) {
  const meta = model.squad.find((s) => s.element === element);
  const club = clubOf(meta?.teamId);
  return (
    <div className="w-[76px] text-center" title={meta?.webName ?? `#${element}`}>
      <svg viewBox="0 0 64 56" className="mx-auto h-11 w-12 opacity-90" aria-hidden>
        <path d="M20 4 L27 1 Q32 4 37 1 L44 4 L58 12 L52 24 L46 21 L46 54 L18 54 L18 21 L12 24 L6 12 Z"
          fill={isShared ? "var(--line)" : club.rail} stroke="rgba(0,0,0,.35)" strokeWidth="1" />
      </svg>
      <span className="mt-0.5 block truncate text-2xs font-medium text-ink-mid">{meta?.webName ?? `#${element}`}</span>
    </div>
  );
}
