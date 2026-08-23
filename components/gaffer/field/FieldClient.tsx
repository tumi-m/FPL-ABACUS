"use client";
import Link from "next/link";

import * as React from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/ui/cn";
import { clubOf } from "@/config/clubs";
import { EOScatter } from "@/components/charts/EOScatter";
import { BoardDesk, type DeskCandidate, type DeskSquadRow } from "@/components/gaffer/board/BoardDesk";
import { PeekSheet } from "@/components/gaffer/field/PeekSheet";
import { PositionContribution, Availability, BpsLeaders, CaptainShare } from "@/components/gaffer/field/FieldCharts";
import { AnimatedNumber } from "@/components/gaffer/useAnimatedNumber";
import { Est } from "@/components/gaffer/Est";
import { COPY } from "@/lib/copy/deck";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

const POLL_LIVE_MS = 20_000;
const POLL_IDLE_MS = 300_000;

type Mode = "points" | "ownership" | "swing" | "leverage" | "planner" | "correlation" | "risk";
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "points", label: "Points", hint: "Live points per player" },
  { id: "ownership", label: "Ownership", hint: "Effective ownership in the selected cohort — template fades, differentials burn" },
  { id: "swing", label: "Swing", hint: "Ranks gained or lost so far, per player" },
  { id: "leverage", label: "Leverage", hint: "Expected rank swing still available" },
  { id: "planner", label: "Planner", hint: "Stage transfers and chips against your team" },
  { id: "correlation", label: "Correlation", hint: "Arcs join players whose GW outcomes move together — stacking shrinks your effective bets" },
  { id: "risk", label: "Risk", hint: "Token size is each player's share of your XI's variance" },
];

/** Keys 1–6 select the six pitch modes (the Planner desk stays click-only). */
const KEY_MODES: Mode[] = ["points", "ownership", "swing", "leverage", "correlation", "risk"];

interface WebPayload {
  players: { elementId: number; webName: string }[];
  pairs: { a: number; b: number; rho: number }[];
  meanPoints: Record<number, number>;
  riskShare: Record<number, number>;
  portfolioSd: number;
  effectiveBets: number;
  draws: number;
}

export interface FieldDeskProps {
  teamId: number;
  squad: DeskSquadRow[];
  candidates: DeskCandidate[];
  gws: number[];
  currentGw: number;
  wallGw: number | null;
  chips: { key: string; label: string; stopEvent: number }[];
  bankTenths: number;
}

type RivalRow = SquadRow;
interface RivalPayload {
  ok: boolean;
  reason?: string;
  entry: number;
  gw: number;
  teamName: string | null;
  rows: RivalRow[];
  totals: { gw: number; bench: number };
  subs: { out: number; in: number }[];
}

export function FieldClient({
  initialModel,
  desk,
}: {
  initialModel: MatchdayModel;
  desk?: FieldDeskProps | null;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const urlMode = MODES.find((m) => m.id === params.get("mode"))?.id ?? "points";
  const [mode, setModeState] = React.useState<Mode>(urlMode);
  // keep URL in sync so a mode is shareable; never re-layouts tokens
  React.useEffect(() => {
    if (urlMode !== mode) setModeState(urlMode);
  }, [urlMode, mode]);
  const setMode = (m: Mode) => {
    setModeState(m);
    router.replace(`/field?mode=${m}`, { scroll: false });
  };
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

  // compare state (declared early — the web layer below depends on it)
  const [rival, setRival] = React.useState<RivalPayload | null>(null);
  const [rivalError, setRivalError] = React.useState<string | null>(null);
  const [rivalView, setRivalView] = React.useState<"field" | "table">("field");
  const rivalLoadedRef = React.useRef(false);

  // peek — ONE shared sheet for token taps (v4 spec)
  const [peekElement, setPeekElement] = React.useState<number | null>(null);

  // ── correlation web (modes 5+6) — fetched only when a mode needs it ─────
  const wantsWeb = mode === "correlation" || mode === "risk";
  const { data: web, isLoading: webLoading } = useSWR<WebPayload | null>(
    wantsWeb ? ["gaffer-web", entry] : null,
    async ([, e]: [string, number]) => {
      const res = await fetch(`/api/gaffer/web?entry=${e}`);
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as WebPayload | null;
    },
    { revalidateOnFocus: false, dedupingInterval: 300_000, keepPreviousData: true },
  );
  const webByElement = React.useMemo(() => {
    if (!web) return null;
    return {
      mean: new Map(Object.entries(web.meanPoints).map(([k, v]) => [Number(k), v] as const)),
      risk: new Map(Object.entries(web.riskShare).map(([k, v]) => [Number(k), v] as const)),
    };
  }, [web]);

  // token DOM positions for the arc layer — measured, never re-laid-out
  const pitchRef = React.useRef<HTMLDivElement | null>(null);
  const tokenRefs = React.useRef(new Map<number, HTMLLIElement>());
  const [positions, setPositions] = React.useState<Map<number, { x: number; y: number }>>(new Map());
  const measure = React.useCallback(() => {
    const pitch = pitchRef.current;
    if (!pitch) return;
    const pr = pitch.getBoundingClientRect();
    const next = new Map<number, { x: number; y: number }>();
    for (const [el, node] of tokenRefs.current) {
      const r = node.getBoundingClientRect();
      if (r.width === 0) continue;
      next.set(el, { x: r.left + r.width / 2 - pr.left, y: r.top + r.height / 2 - pr.top });
    }
    setPositions(next);
  }, []);
  React.useEffect(() => {
    if (mode !== "correlation" || rival) {
      setPositions(new Map());
      return;
    }
    measure();
    const ro = new ResizeObserver(() => measure());
    if (pitchRef.current) ro.observe(pitchRef.current);
    return () => ro.disconnect();
  }, [mode, rival, measure, web, model.squad]);

  // keys 1–6 select modes; never while typing in an input
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < KEY_MODES.length) setMode(KEY_MODES[idx]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // swing + leverage keyed by element for token lookups
  const swingByElement = React.useMemo(
    () => new Map(model.swings.map((s) => [s.element, s])),
    [model.swings],
  );
  const leverageByElement = React.useMemo(
    () => new Map(model.leverage.yours.map((l) => [l.element, l])),
    [model.leverage.yours],
  );

  // ── compare mode — the rival's gameweek through the same engine ───────
  const loadRival = async (raw?: string | number) => {
    const id = Number(raw ?? rivalIdRaw);
    setRivalError(null);
    if (!Number.isFinite(id) || id <= 0) return;
    try {
      const res = await fetch(`/api/gaffer/rival?entry=${id}&gw=${gw}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as RivalPayload;
      if (!json.ok) {
        setRival(null);
        setRivalError("No picks visible for that entry this gameweek yet.");
        return;
      }
      setRival(json);
    } catch {
      setRival(null);
      setRivalError(COPY.picksUnavailable);
    }
  };
  const clearRival = () => {
    setRival(null);
    setRivalError(null);
    setRivalIdRaw("");
    router.replace(`/field?mode=${mode}`, { scroll: false });
  };

  // deep-link ?compare={entryId} — league rows land here
  const urlCompare = params.get("compare");
  React.useEffect(() => {
    const id = Number(urlCompare);
    if (rivalLoadedRef.current) return;
    if (Number.isFinite(id) && id > 0) {
      rivalLoadedRef.current = true;
      setRivalIdRaw(String(id));
      void loadRival(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCompare]);

  const starters = model.squad.filter((s) => !s.onBench);
  const rows = [1, 2, 3, 4].map((pos) =>
    starters.filter((s) => s.pos === pos).sort((a, b) => b.multiplier - a.multiplier),
  );
  const bench = model.squad.filter((s) => s.onBench);

  const rivalSet = React.useMemo(() => new Set(rival?.rows.map((p) => p.element) ?? []), [rival]);
  const yourTotal = model.squad.filter((s) => !s.onBench).reduce((sum, s) => sum + s.livePoints, 0);

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

      {/* hero — the gameweek total, FIFA-oblique but not oversized */}
      {(() => {
        const gwTotal = model.squad.filter((s) => !s.onBench).reduce((sum, s) => sum + s.livePoints, 0);
        return (
          <div className="flex items-end justify-between rounded-lg has-gloss card-lift bg-raised px-5 py-4">
            <div>
              <p className="upper-label text-2xs text-ink-lo">GW{gw} points</p>
              <p className="hero-figure mt-1 text-[clamp(44px,6vw,64px)] leading-none">
                {Math.round(gwTotal).toLocaleString("en-GB")}
              </p>
            </div>
            <Link
              href="/field/points"
              role="button"
              className="skewed inline-flex h-11 shrink-0 items-center rounded-md bg-volt px-4 text-xs uppercase-label text-on-accent btn-glow transition-transform dur-instant active:scale-[0.97]"
            >
              <span>Points contribution</span>
            </Link>
          </div>
        );
      })()}

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
          <button
            onClick={() => (rival ? clearRival() : loadRival())}
            className="skewed rounded-sm bg-raised px-2.5 py-1 text-xs uppercase-label text-ink-mid hover:text-ink-hi"
          >
            <span>{rival ? "Clear" : "Compare"}</span>
          </button>
        </div>
      </div>

      {rivalError && <p role="alert" className="text-sm text-flare">{rivalError}</p>}

      {/* head-to-head header — two totals, one gap, both engine-sourced */}
      {rival && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg bg-surface-1 card-ring px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="upper-label text-2xs text-ink-lo">You</span>
            <span className="fig-num text-2xl leading-none">{Math.round(yourTotal)}</span>
          </div>
          <div
            className={`fig-num text-sm ${yourTotal >= rival.totals.gw ? "text-surge" : "text-flare"}`}
            aria-label={`You are ${Math.abs(Math.round(yourTotal - rival.totals.gw))} points ${
              yourTotal >= rival.totals.gw ? "ahead" : "behind"
            }`}
          >
            {yourTotal === rival.totals.gw ? "level" : `${yourTotal > rival.totals.gw ? "+" : "−"}${Math.abs(Math.round(yourTotal - rival.totals.gw))}`}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="fig-num text-2xl leading-none">{rival.totals.gw}</span>
            <span className="upper-label text-2xs text-ink-lo">{rival.teamName ?? `Entry ${rival.entry}`}</span>
          </div>
          <div role="group" aria-label="Compare view" className="flex gap-1 rounded-md card-ring p-1">
            {(["field", "table"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setRivalView(v)}
                aria-pressed={rivalView === v}
                className={cn(
                  "skewed rounded-sm px-3 py-1.5 text-xs uppercase-label transition-colors dur-instant",
                  rivalView === v ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
                )}
              >
                <span>{v}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* modes 5+6 — the web's headline stats with their honesty wraps */}
      {wantsWeb && (
        <p className="text-xs text-ink-mid num-tabular" role="status">
          {webLoading && !web ? (
            "Simulating the gameweek — 800 Monte Carlo draws…"
          ) : web ? (
            <>
              <Est method={`${web.draws} Monte Carlo draws · Dixon–Coles copula · seed-fixed`}>
                {mode === "correlation"
                  ? `${web.effectiveBets.toFixed(1)} effective bets / ${web.players.length}`
                  : `portfolio sd ~${web.portfolioSd.toFixed(1)} pts`}
              </Est>
              {mode === "correlation" ? " · surge arcs move together · flare arcs offset · thickness is |ρ|" : " · token size is each player's share of that variance"}
            </>
          ) : (
            "The web needs your picks and finished fixtures to lean on — nothing to correlate yet."
          )}
        </p>
      )}

      {/* the pitch — broadcast turf: tournament green under the floodlights,
          striped and marked; never a flat rectangle */}
      <section aria-label={`Your team on the pitch, ${mode} mode`} className="rounded-lg has-gloss card-lift overflow-hidden bg-raised p-3 md:p-5">
        <div
          ref={pitchRef}
          className="relative overflow-hidden rounded-lg px-2 py-4 md:px-6"
          style={{
            background:
              "radial-gradient(120% 90% at 50% -10%, rgba(210,255,235,.16), transparent 55%), repeating-linear-gradient(90deg, rgba(6,32,20,.35) 0 64px, rgba(12,52,32,.18) 64px 128px), linear-gradient(178deg, #0B3B24, #062415 82%)",
            boxShadow: "inset 0 -48px 80px -48px rgba(0,0,0,.75), inset 0 1px 0 rgba(230,248,255,.10)",
          }}
        >
          {/* 1px chalk markings at 40% — white on green, like the real thing */}
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-40" preserveAspectRatio="none" viewBox="0 0 100 100">
            <g fill="none" stroke="rgba(240,250,245,.85)" strokeWidth="0.25">
              <rect x="4" y="4" width="92" height="92" />
              <line x1="4" y1="50" x2="96" y2="50" />
              <circle cx="50" cy="50" r="9" />
              <rect x="26" y="4" width="48" height="14" />
              <rect x="26" y="82" width="48" height="14" />
            </g>
          </svg>

          {/* mode 5 — correlation arcs, measured from the live token layout */}
          {mode === "correlation" && !rival && web && positions.size > 0 && (
            <svg aria-hidden className="pointer-events-none absolute inset-0 z-0 h-full w-full">
              {web.pairs.slice(0, 24).map(({ a, b, rho }) => {
                const pa = positions.get(a);
                const pb = positions.get(b);
                if (!pa || !pb) return null;
                const lift = Math.min(70, Math.hypot(pb.x - pa.x, pb.y - pa.y) * 0.22);
                const mx = (pa.x + pb.x) / 2;
                const my = (pa.y + pb.y) / 2 - lift;
                return (
                  <path
                    key={`${a}-${b}`}
                    d={`M${pa.x} ${pa.y} Q${mx} ${my} ${pb.x} ${pb.y}`}
                    fill="none"
                    stroke={rho > 0 ? "var(--surge)" : "var(--flare)"}
                    strokeWidth={1 + Math.min(6, Math.abs(rho) * 8)}
                    strokeOpacity={0.25 + Math.min(0.5, Math.abs(rho) * 0.8)}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
          )}

          {rival && rivalView === "field" ? (
            <ComparePitch
              rows={rows} mode={mode} rival={rival}
              swingByElement={swingByElement} leverageByElement={leverageByElement} rivalSet={rivalSet}
            />
          ) : rival && rivalView === "table" ? (
            <CompareTable rows={model.squad} rival={rival} />
          ) : (
            <div className="relative space-y-2.5">
              {rows.map((row, i) => (
                <ul key={i} className="flex flex-wrap items-start justify-center gap-2">
                  {row.map((p) => (
                    <li
                      key={p.element}
                      ref={(el) => {
                        if (el) tokenRefs.current.set(p.element, el);
                        else tokenRefs.current.delete(p.element);
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setPeekElement(p.element)}
                        aria-label={`${p.webName}, open details`}
                        className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt"
                      >
                        <ShirtToken
                          row={p}
                          mode={mode}
                          swing={swingByElement.get(p.element)}
                          lev={leverageByElement.get(p.element)}
                          webMean={webByElement?.mean.get(p.element)}
                          riskShare={webByElement?.risk.get(p.element)}
                        />
                      </button>
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
              <button
                type="button"
                onClick={() => setPeekElement(p.element)}
                aria-label={`${p.webName}, open details`}
                className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt"
              >
                <ShirtToken
                  row={p}
                  mode={mode}
                  swing={swingByElement.get(p.element)}
                  lev={leverageByElement.get(p.element)}
                />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Planner mode — staging ledger + chip lane, same component as the Board */}
      {mode === "planner" && (
        desk ? (
          <BoardDesk
            teamId={desk.teamId}
            squad={desk.squad}
            candidates={desk.candidates}
            gws={desk.gws}
            currentGw={desk.currentGw}
            wallGw={desk.wallGw}
            chips={desk.chips}
            bankTenths={desk.bankTenths}
          />
        ) : (
          <p className="rounded-lg bg-surface-1 card-ring p-6 text-center text-sm text-ink-lo">
            The planner needs your picks for this gameweek.
          </p>
        )
      )}

      {mode !== "planner" && (
        <>
          <EOScatter rows={model.squad} onSelect={(el) => setPeekElement(el)} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PositionContribution rows={model.squad} />
            <Availability rows={model.squad} />
            <BpsLeaders rows={model.squad} />
            <CaptainShare rows={model.squad} />
          </div>
        </>
      )}

      <PeekSheet
        element={peekElement}
        model={model}
        swingByElement={swingByElement}
        leverageByElement={leverageByElement}
        onOpenChange={(o) => {
          if (!o) setPeekElement(null);
        }}
      />
    </div>
  );
}

type SquadRow = MatchdayModel["squad"][number];
type SwingRow = MatchdayModel["swings"][number];
type LevRow = MatchdayModel["leverage"]["yours"][number];

function modeValue(
  row: SquadRow,
  mode: Mode,
  swing?: SwingRow,
  lev?: LevRow,
  webMean?: number,
  riskShare?: number,
): { text: string; tone: "volt" | "surge" | "flare" | "ultra" | "plain" } {
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
    case "planner":
      // The planner encodes nothing on the pitch — the desk below carries it.
      return { text: String(row.livePoints), tone: "plain" };
    case "correlation":
      // mean simulated points — the prose carries the honesty wrap above
      return { text: webMean != null ? `~${webMean.toFixed(1)}` : "—", tone: "plain" };
    case "risk":
      // neutral colour by spec — size carries the encoding, the pill just states it
      return { text: riskShare != null ? `${Math.round(riskShare * 100)}%` : "—", tone: "plain" };
  }
}

/** Club-coloured SVG shirt with sleeve shade, armband, arcs and state rings. */
export function ShirtToken({
  row, mode, swing, lev, webMean, riskShare,
}: {
  row: SquadRow; mode: Mode; swing?: SwingRow; lev?: LevRow;
  webMean?: number; riskShare?: number;
}) {
  const club = clubOf(row.teamId);
  const done = row.fixtureState === "done";
  const live = row.fixtureState === "live";
  const val = modeValue(row, mode, swing, lev, webMean, riskShare);
  const defconPct = row.defconThreshold < 99 ? Math.min(1, row.defconCount / row.defconThreshold) : 0;
  // risk mode — token SIZE encodes the marginal variance share (neutral colour)
  const riskScale = mode === "risk" && riskShare != null ? 0.78 + Math.min(0.65, riskShare * 5.5) : 1;

  return (
    <div
      className={cn(
        "relative w-[76px] text-center transition-opacity duration-[600ms] focus-visible:outline-none",
        done && "opacity-55",
      )}
      title={`${row.webName} · ${club.name}`}
    >
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

      {/* shirt — scaled by variance share in risk mode (never hue) */}
      <svg
        viewBox="0 0 64 56"
        className="mx-auto h-11 w-12 drop-shadow-[0_4px_10px_rgba(0,0,0,.45)] transition-transform dur-base"
        style={{ transform: `scale(${riskScale.toFixed(2)})`, transformOrigin: "center bottom" }}
        aria-hidden
      >
        <path d="M20 4 L27 1 Q32 4 37 1 L44 4 L58 12 L52 24 L46 21 L46 54 L18 54 L18 21 L12 24 L6 12 Z"
          fill={club.rail} stroke="rgba(0,0,0,.35)" strokeWidth="1" />
        <path d="M44 4 L58 12 L52 24 L46 21 L46 12 Z" fill="color-mix(in oklab, currentColor 100%, black)" style={{ color: club.rail }} opacity="0.22" />
        {row.isCaptain && <path d="M25 15 Q32 20 39 15" fill="none" stroke="var(--volt)" strokeWidth="3.5" strokeLinecap="round" />}
      </svg>

      {row.subbedInFor !== null && (
        <span aria-label="Projected auto-substitute" title="Projected auto-sub in" className="absolute right-0 top-7 text-xs font-bold text-ultra">⇅</span>
      )}

      <span className="mt-0.5 block truncate text-2xs font-semibold text-ink-hi">{row.webName}</span>

      {/* value pill on the shoulder — points count up + wash on poll diffs */}
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
        {mode === "points" ? (
          <AnimatedNumber value={row.livePoints} format={(v) => String(Math.round(v))} />
        ) : (
          <span>{val.text}</span>
        )}
      </span>
    </div>
  );
}

/** Two XIs on one pitch — yours near half, theirs far, shared dimmed on halfway. */
function ComparePitch({
  rows, mode, rival, swingByElement, leverageByElement, rivalSet,
}: {
  rows: SquadRow[][]; mode: Mode; rival: RivalPayload;
  swingByElement: Map<number, SwingRow>; leverageByElement: Map<number, LevRow>; rivalSet: Set<number>;
}) {
  const rivalStarters = rival.rows.filter((r) => !r.onBench);
  const rivalBands = [1, 2, 3, 4].map((pos) => rivalStarters.filter((r) => r.pos === pos));
  return (
    <div className="relative space-y-2.5">
      {/* far half — the rival's XI with real live data (reversed so GK sits far) */}
      {[...rivalBands].reverse().map((band, i) => (
        <ul key={`rv${i}`} className="flex flex-wrap items-start justify-center gap-2 opacity-90">
          {band.map((r) => (
            <li key={r.element} className={cn(rivalSet.has(r.element) && "opacity-40 blur-[0.4px]")}>
              <ShirtToken row={r} mode="points" />
            </li>
          ))}
        </ul>
      ))}
      {/* halfway line */}
      <div className="relative my-1 h-px bg-line-hi/60" />
      {/* near half — you, shared players dimmed to the line */}
      {rows.map((row, i) => (
        <ul key={`me${i}`} className="flex flex-wrap items-start justify-center gap-2">
          {row.map((p) => (
            <li key={p.element} className={rivalSet.has(p.element) ? "opacity-40" : ""}>
              <ShirtToken row={p} mode={mode} swing={swingByElement.get(p.element)} lev={leverageByElement.get(p.element)} />
            </li>
          ))}
        </ul>
      ))}
      <p className="pt-1 text-center text-2xs text-ink-lo num-tabular">
        Shared: {[...rivalSet].length} of 15 overlap · auto-subs and provisional bonus included
      </p>
    </div>
  );
}

/** Compare, table view — You | Them with live points, subs and bonus. */
function CompareTable({ rows, rival }: { rows: SquadRow[]; rival: RivalPayload }) {
  const order = (a: SquadRow, b: SquadRow) =>
    Number(a.onBench) - Number(b.onBench) || a.pos - b.pos || b.livePoints - a.livePoints;
  const yours = [...rows].sort(order);
  const theirs = [...rival.rows].sort(order);
  return (
    <div className="relative grid gap-4 md:grid-cols-2">
      <CompareColumn title="You" rows={yours} tone="volt" />
      <CompareColumn title={rival.teamName ?? `Entry ${rival.entry}`} rows={theirs} tone="ultra" />
    </div>
  );
}

function CompareColumn({ title, rows, tone }: { title: string; rows: SquadRow[]; tone: "volt" | "ultra" }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h4 className="upper-label text-2xs text-ink-lo">{title}</h4>
        <span className={`text-2xs uppercase-label ${tone === "volt" ? "text-volt" : "text-ultra"}`}>live</span>
      </div>
      <table className="w-full text-xs num-tabular">
        <thead>
          <tr className="border-b border-hairline text-left">
            {["Player", "Fx", "Pts", ""].map((h) => (
              <th key={h} className="px-1.5 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.element}
              className={`border-b border-hairline last:border-0 ${r.onBench ? "opacity-55" : ""}`}
            >
              <td className="px-1.5 py-1.5 font-medium text-ink-hi">
                {r.webName}
                {r.isCaptain && r.multiplier >= 2 && (
                  <span className={`ml-1 inline-grid h-4 w-4 place-items-center rounded-full align-[1px] text-[9px] font-bold ${
                    tone === "volt" ? "bg-volt text-on-accent" : "bg-ultra text-on-accent"
                  }`}>
                    C
                  </span>
                )}
                {r.onBench && <span className="ml-1 text-2xs uppercase tracking-wide text-ink-lo">bench</span>}
              </td>
              <td className="px-1.5 py-1.5 text-ink-2">
                {r.opponentShort}
                {r.fixtureState !== "pre" && ` · ${Math.min(r.fixtureMinute, 90)}′`}
              </td>
              <td className="px-1.5 py-1.5 text-right font-semibold text-ink-hi">
                {r.livePoints}
                {r.provisionalBonus > 0 && <sup className="text-amber">*</sup>}
              </td>
              <td className="px-1.5 py-1.5 text-right text-ultra">{r.subbedInFor !== null ? "⇅" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-2xs text-ink-3">* provisional bonus · ⇅ projected auto-sub</p>
    </div>
  );
}
