"use client";
import Link from "next/link";

import * as React from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/ui/cn";
import { clubOf } from "@/config/clubs";
import { EOScatter } from "@/components/charts/EOScatter";
import { PositionContribution, Availability, BonusLeaders, CaptainShare } from "@/components/gaffer/field/FieldCharts";
import {
  ExpectedVsActual,
  MinutesSecurity,
  OverUnder,
  ValueForMoney,
} from "@/components/gaffer/field/SquadCharts";
import {
  Crossover,
  DecisionLedger,
  Delivery,
  ProcessVsOutcome,
  RankAtRisk,
} from "@/components/gaffer/field/DecisionCharts";

import { AnimatedNumber } from "@/components/gaffer/useAnimatedNumber";
import { Est } from "@/components/gaffer/Est";
import { CrestTile } from "@/components/gaffer/ClubCrest";
import { PlayerAvatar, AvatarToggle, useAvatarMode, type AvatarMode } from "@/components/gaffer/PlayerAvatar";
import { MatchEventLegend, MatchEventStrip, matchEvents } from "@/components/gaffer/field/MatchEvents";
import { InjuryReport } from "@/components/gaffer/field/InjuryReport";
import { availabilityLabel } from "@/lib/engines/availability";
import { GameweekPicker } from "@/components/gaffer/GameweekPicker";
import type { TopPerformersData } from "@/components/gaffer/field/TopPerformers";
import type { BonusBoardData } from "@/components/gaffer/boards/BonusBoard";
import type { DefconBoardData } from "@/components/gaffer/boards/DefconBoard";
import { COPY } from "@/lib/copy/deck";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

/**
 * The peek sheet opens on a token tap, so it cannot be on screen at first
 * paint and has no business in the chunk that produces it — it brings the
 * dialog primitive with it.
 */
const PeekSheet = dynamic(
  () => import("@/components/gaffer/field/PeekSheet").then((m) => m.PeekSheet),
  { ssr: false },
);

/**
 * The boards' code, like their data, arrives when a board is opened.
 *
 * Each is a few hundred lines of table, chart and ranking logic that most
 * Field views never render. Statically imported they rode in the Field's own
 * chunk and every visitor downloaded and parsed all three. Split out, the
 * chunk fetches alongside the board's data and the skeleton already on screen
 * covers the wait.
 */
const TopPerformers = dynamic(
  () => import("@/components/gaffer/field/TopPerformers").then((m) => m.TopPerformers),
  { loading: () => <BoardSkeleton /> },
);
const BonusBoard = dynamic(
  () => import("@/components/gaffer/boards/BonusBoard").then((m) => m.BonusBoard),
  { loading: () => <BoardSkeleton /> },
);
const DefconBoard = dynamic(
  () => import("@/components/gaffer/boards/DefconBoard").then((m) => m.DefconBoard),
  { loading: () => <BoardSkeleton /> },
);

const POLL_LIVE_MS = 20_000;
const POLL_IDLE_MS = 300_000;

type Mode =
  | "points" | "ownership" | "swing" | "leverage" | "correlation" | "risk"
  | "top" | "bonus" | "defcon";

/**
 * The stat boards — Top, Bonus and DEFCON — read the whole player market, so
 * they live behind their own fetch rather than in every Field payload. They sit
 * next to Risk in the same control because that is where you are when you want
 * them: the pitch answers "what is my team doing", the boards answer "who else
 * is doing it", and making you leave the page to ask broke the thought.
 */
const BOARD_MODES = ["top", "bonus", "defcon"] as const;
type BoardMode = (typeof BOARD_MODES)[number];
const isBoardMode = (m: Mode): m is BoardMode => (BOARD_MODES as readonly string[]).includes(m);

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "points", label: "Points", hint: "Live points per player" },
  { id: "ownership", label: "Ownership", hint: "Effective ownership in the selected cohort — template fades, differentials burn" },
  { id: "swing", label: "Swing", hint: "Ranks gained or lost so far, per player" },
  { id: "leverage", label: "Leverage", hint: "Expected rank swing still available" },
  { id: "correlation", label: "Correlation", hint: "Arcs join players whose GW outcomes move together — stacking shrinks your effective bets" },
  { id: "risk", label: "Risk", hint: "Token size is each player's share of your XI's variance — with the treatment table below it" },
  { id: "top", label: "Top", hint: "Top performers — highest xG, xA and fewest expected concessions, this GW or the season" },
  { id: "bonus", label: "Bonus", hint: "The 1·2·3 — who takes bonus, how, and what it cost them in BPS" },
  { id: "defcon", label: "DEFCON", hint: "Defensive contributions, per-90 rates, threshold hits and bookings" },
];

/** Keys 1–9 select the pitch modes and the boards. */
const KEY_MODES: Mode[] = [
  "points", "ownership", "swing", "leverage", "correlation", "risk",
  "top", "bonus", "defcon",
];

/** What each board's endpoint hands back. */
interface BoardPayloads {
  top: TopPerformersData;
  bonus: BonusBoardData;
  defcon: DefconBoardData;
}

/** Titles for the boards, which used to be pages with headings of their own. */
const BOARD_HEADS: Record<BoardMode, { title: string; blurb: string }> = {
  top: {
    title: "Top performers",
    blurb: "Season actuals, what the underlying numbers expected, and the gap between them",
  },
  bonus: {
    title: "Bonus",
    blurb: "The 1·2·3 · who takes it, how, and what it cost them in BPS",
  },
  defcon: {
    title: "DEFCON monsters",
    blurb: "Defensive contributions · rates against the line · bookings",
  },
};

interface WebPayload {
  players: { elementId: number; webName: string }[];
  pairs: { a: number; b: number; rho: number }[];
  meanPoints: Record<number, number>;
  riskShare: Record<number, number>;
  sdPoints: Record<number, number>;
  totals: number[];
  portfolioSd: number;
  effectiveBets: number;
  draws: number;
}


type RivalRow = SquadRow;
/**
 * What to say when a compare comes back empty.
 *
 * It used to say "No picks visible for that entry this gameweek yet" for every
 * failure — a typo'd id, a manager who joined late, and FPL being down all got
 * the same sentence, and only one of them was true. Each of these names the
 * actual problem and the actual fix.
 */
const RIVAL_TROUBLE_FALLBACK = () =>
  "FPL didn't answer just then. Give it a moment and press Compare again.";

const RIVAL_TROUBLE: Record<string, (entry: number, gw: number | null) => string> = {
  "no-such-entry": (entry) =>
    `No FPL team with id ${entry}. The id is the number in the URL of their points page.`,
  "picks-not-set": (entry, gw) =>
    `Team ${entry} has no side for GW${gw ?? "?"} — they joined the game after it, or never picked one.`,
  "no-gameweek": (_e, gw) => `GW${gw ?? "?"} hasn't been played yet.`,
  upstream: RIVAL_TROUBLE_FALLBACK,
};

const rivalTrouble = (reason: string, entry: number, gw: number | null) =>
  (RIVAL_TROUBLE[reason] ?? RIVAL_TROUBLE_FALLBACK)(entry, gw);

/**
 * A loaded rival. `ok` is the literal `true`, not `boolean`, so the failure
 * branch below actually discriminates — with a loose `boolean` and an optional
 * `reason`, every read of the failure went unchecked and a missing reason would
 * have reached the copy table as undefined.
 */
interface RivalPayload {
  ok: true;
  entry: number;
  gw: number;
  teamName: string | null;
  rows: RivalRow[];
  totals: { gw: number; bench: number };
  subs: { out: number; in: number }[];
}

/** What the endpoint says when it could not build one. */
interface RivalTrouble {
  ok: false;
  reason: string;
  entry: number;
  gw: number | null;
}

export function FieldClient({
  initialModel,
  expectedByElement = {},
}: {
  initialModel: MatchdayModel;
  /** FPL's published expectation for this gameweek, per element. */
  expectedByElement?: Record<number, number>;
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
    router.replace(historical ? `/field?gw=${gw}&mode=${m}` : `/field?mode=${m}`, { scroll: false });
  };
  const setGw = (n: number | null) => {
    router.replace(n == null ? `/field?mode=${mode}` : `/field?gw=${n}&mode=${mode}`, { scroll: false });
  };
  const [rivalIdRaw, setRivalIdRaw] = React.useState("");
  const entry = initialModel.entry.id;
  const gw = initialModel.event.id;
  const historical = params.get("gw") != null;

  // Keyed on the gameweek too: a historical view revalidating on the bare
  // entry key would quietly replace GW3's model with the current one.
  const { data } = useSWR<MatchdayModel>(
    ["gaffer-live", entry, gw],
    async ([, e, g]: [string, number, number]) => {
      const res = await fetch(
        historical ? `/api/gaffer/live?entry=${e}&gw=${g}` : `/api/gaffer/live?entry=${e}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as MatchdayModel;
    },
    {
      fallbackData: initialModel,
      refreshInterval: (latest?: MatchdayModel) => {
        // A settled past week has nothing left to poll for.
        if (historical) return 0;
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

  // peek — ONE shared sheet for token taps (v4 spec). Its chunk is fetched on
  // the first tap and then kept mounted, so the sheet can animate closed.
  const [peekElement, setPeekElement] = React.useState<number | null>(null);
  const peeked = React.useRef(false);
  if (peekElement != null) peeked.current = true;

  // faces or kits — a device-wide preference, shared with every other board.
  const [avatar, setAvatar] = useAvatarMode();

  // ── the stat boards — fetched when one is opened, never before ──────────
  // Each carries the whole selectable market, about seven hundred rows. Sent
  // with the page they were the single biggest thing on the wire and most
  // visits never looked at them, so the pitch renders first and a board
  // arrives on its own request. SWR caches per board, so flipping back to one
  // you have already seen is instant.
  const boardMode = isBoardMode(mode) ? mode : null;
  const { data: board, isLoading: boardLoading, error: boardError } = useSWR<
    BoardPayloads[BoardMode]
  >(
    boardMode ? ["gaffer-board", boardMode, historical ? gw : null] : null,
    async ([, b, g]: [string, BoardMode, number | null]) => {
      const qs = g == null ? `board=${b}` : `board=${b}&gw=${g}`;
      const res = await fetch(`/api/gaffer/boards?${qs}`);
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as BoardPayloads[BoardMode];
    },
    { revalidateOnFocus: false, dedupingInterval: 120_000 },
  );

  // ── correlation web (modes 5+6) — fetched only when a mode needs it ─────
  const wantsWeb = mode === "correlation" || mode === "risk";
  // Fetched on every Field view now: the correlation modes paint arcs with it
  // and the decision board below the pitch runs its rank band and captaincy
  // objective off the same draws. It is a client fetch after hydration, so it
  // never delays first paint, and SWR dedupes it for five minutes.
  const { data: web, isLoading: webLoading } = useSWR<WebPayload | null>(
    historical ? null : ["gaffer-web", entry],
    async ([, e]: [string, number]) => {
      const res = await fetch(`/api/gaffer/web?entry=${e}`);
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as WebPayload | null;
    },
    { revalidateOnFocus: false, dedupingInterval: 300_000, keepPreviousData: true },
  );
  // ── decision board feeds ────────────────────────────────────────────────
  // The simulation arrives with everything the rank band and the captaincy
  // objective need; until it does, those two charts say they are waiting.
  const decisionWeb = React.useMemo(
    () =>
      web && web.totals.length > 0
        ? {
            meanPoints: web.meanPoints,
            sdPoints: web.sdPoints,
            totals: web.totals,
            portfolioSd: web.portfolioSd,
            draws: web.draws,
          }
        : null,
    [web],
  );
  const decisionWebLoading = webLoading && !web;

  /**
   * How far you are chasing, which is what turns variance from a liability
   * into an asset in the captaincy objective. A loaded rival is the honest
   * target; without one, the live field average stands in.
   */
  const pointsBehind = React.useMemo(() => {
    if (rival) return Math.max(0, rival.totals.gw - model.hero.gwPoints);
    const avg = model.rankContext.fieldAvg;
    return avg > 0 ? Math.max(0, Math.round(avg - model.hero.gwPoints)) : 0;
  }, [rival, model.hero.gwPoints, model.rankContext.fieldAvg]);

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
      if (idx >= 0 && idx < KEY_MODES.length && !(historical && KEY_MODES[idx] !== "points")) setMode(KEY_MODES[idx]);
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
    const input = String(raw ?? rivalIdRaw).trim();
    setRivalError(null);
    if (!input) return;

    // numeric → entry id; otherwise resolve the manager name first
    const asId = Number(input);
    if (Number.isFinite(asId) && asId > 0 && /^\d+$/.test(input)) {
      await loadRivalById(asId);
      return;
    }
    try {
      const res = await fetch(`/api/gaffer/rival/resolve?q=${encodeURIComponent(input)}`);
      const json = (await res.json()) as { ok: boolean; matches?: { entry: number; entryName: string }[] };
      const matches = json.matches ?? [];
      if (matches.length === 0) {
        setRival(null);
        setRivalError(`No manager matching “${input}” in the cohort league — try an entry id.`);
        return;
      }
      if (matches.length > 1) {
        setRival(null);
        setRivalError(`Several match “${input}”: ${matches.slice(0, 3).map((m) => m.entryName).join(", ")}${matches.length > 3 ? "…" : ""} — be more specific.`);
        return;
      }
      await loadRivalById(matches[0].entry);
    } catch {
      setRival(null);
      setRivalError(COPY.picksUnavailable);
    }
  };

  const loadRivalById = async (id: number) => {
    setRivalIdRaw(String(id));
    try {
      const res = await fetch(`/api/gaffer/rival?entry=${id}&gw=${gw}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as RivalPayload | RivalTrouble;
      if (!json.ok) {
        setRival(null);
        setRivalError(rivalTrouble(json.reason, json.entry, json.gw));
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

  /**
   * The players you BOTH own.
   *
   * This used to be every player the rival owns, which made it useless on the
   * rival's own half — every one of their fifteen was trivially in it, so the
   * whole away XI faded out and the footer read "Shared: 15 of 15" whoever you
   * compared against. The overlap is the intersection, and it is the number
   * that matters: what you share cancels, what you don't decides the week.
   */
  const sharedSet = React.useMemo(() => {
    if (!rival) return new Set<number>();
    const mine = new Set(model.squad.map((p) => p.element));
    return new Set(rival.rows.filter((r) => mine.has(r.element)).map((r) => r.element));
  }, [rival, model.squad]);
  const yourTotal = model.squad.filter((s) => !s.onBench).reduce((sum, s) => sum + s.livePoints, 0);

  return (
    <div className="space-y-4">
      {/* The title said "The Field" on the Field. The bar keeps its job — pick
          a gameweek, read the state — and drops the word for it. */}
      <h1 className="sr-only">The Field</h1>
      <div className="lower3">
        <div className="lower3-flag bg-volt" />
        <div className="lower3-body">
          {/* Gameweek picker. Stepping through a season two arrow-taps at a
              time was a poor way to reach GW12; one control lists them all,
              and on a phone it opens the platform's own wheel. */}
          <GameweekPicker
            gw={gw}
            latest={model.event.latest}
            basePath="/field"
            keep={{ mode }}
          />
          {historical && (
            <button
              type="button"
              onClick={() => setGw(null)}
              className="skewed rounded-sm bg-volt px-2 py-1 text-2xs uppercase-label text-on-accent"
            >
              <span>Back to current</span>
            </button>
          )}
          <span className="text-2xs uppercase-label text-ink-lo">{model.phase}</span>
          <span className="ml-auto hidden text-2xs text-ink-lo sm:inline">
            {historical ? "Historical view — points mode only" : MODES.find((m) => m.id === mode)?.hint}
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
            {/* The two ways out of the pitch: down into your own score, or out
                to the league your fifteen were picked from. */}
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Link
                href="/field/clubs"
                role="button"
                className="skewed inline-flex h-11 shrink-0 items-center rounded-md bg-raised px-4 text-xs uppercase-label text-ink-mid card-ring transition-colors dur-instant hover:text-ink-hi"
              >
                <span>Club numbers</span>
              </Link>
              <Link
                href="/field/points"
                role="button"
                className="skewed inline-flex h-11 shrink-0 items-center rounded-md bg-volt px-4 text-xs uppercase-label text-on-accent btn-glow transition-transform dur-instant active:scale-[0.97]"
              >
                <span>Points contribution</span>
              </Link>
            </div>
          </div>
        );
      })()}

      {/* mode segmented control — skewed chrome, in the same glass as the bars */}
      <div role="group" aria-label="Field mode" className="flex flex-wrap gap-1 rounded-md glass-edge p-1">
        {MODES.map((m) => {
          const gated = historical && m.id !== "points";
          return (
            <button
              key={m.id}
              onClick={() => !gated && setMode(m.id)}
              disabled={gated}
              aria-pressed={mode === m.id}
              title={gated ? "Historical gameweeks show points only" : undefined}
              className={cn(
                "skewed rounded-sm px-3 py-1.5 text-xs uppercase-label transition-colors dur-instant",
                mode === m.id ? "bg-volt text-on-accent" : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
                gated && "cursor-not-allowed opacity-40",
              )}
            >
              <span>{m.label}</span>
            </button>
          );
        })}
        {/* The artwork switch and the compare box belong to the pitch. A board
            has its own artwork switch and nobody's rival, so neither follows
            you in — the control row stays about the board you are reading. */}
        {!boardMode && (
          <>
            <AvatarToggle mode={avatar} onChange={setAvatar} className="ml-auto border-0 shadow-none" />
            <div className="flex items-center gap-1.5 pr-1">
              <input
                value={rivalIdRaw}
                onChange={(e) => setRivalIdRaw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadRival()}
                placeholder="Compare id or name"
                className="h-7 w-40 rounded-sm border border-line bg-sunk px-2 text-xs text-ink-hi placeholder:text-ink-lo focus:outline-none focus-visible:outline focus-visible:outline-volt"
                aria-label="Rival entry id or manager name"
              />
              <button
                onClick={() => (rival ? clearRival() : loadRival())}
                className="skewed rounded-sm bg-raised px-2.5 py-1 text-xs uppercase-label text-ink-mid hover:text-ink-hi"
              >
                <span>{rival ? "Clear" : "Compare"}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {rivalError && <p role="alert" className="text-sm text-flare">{rivalError}</p>}

      {/* head-to-head header — two totals, one gap, both engine-sourced */}
      {/* A scoreline, not a row of odds and ends. `flex-wrap justify-between`
           put four unrelated things on one line and spilled the view toggle
           onto a second, so the gap — the one figure the whole screen exists
           to show — ended up small and adrift between two scores that were not
           even aligned with each other. Three columns mirror around the middle
           now: your side, the gap, theirs. The gap is the headline and is
           sized like one. */}
      {rival && (
        <div className="rounded-lg bg-surface-1 card-ring px-4 py-3.5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
            <div className="min-w-0 text-right">
              <p className="upper-label truncate text-2xs text-ink-lo">You</p>
              <p className="fig-num mt-0.5 text-[clamp(30px,7vw,44px)] leading-none">
                {Math.round(yourTotal)}
              </p>
            </div>

            {(() => {
              const gap = Math.round(yourTotal - rival.totals.gw);
              const level = gap === 0;
              return (
                <div className="shrink-0 text-center">
                  <span
                    className={cn(
                      "skewed inline-flex h-9 min-w-[64px] items-center justify-center rounded-md px-3",
                      level ? "bg-surface-3 text-ink-mid" : gap > 0 ? "bg-surge" : "bg-flare",
                      !level && "text-on-accent",
                    )}
                    aria-label={
                      level
                        ? "Level with them"
                        : `You are ${Math.abs(gap)} points ${gap > 0 ? "ahead" : "behind"}`
                    }
                  >
                    <span className="fig-num text-xl leading-none">
                      {level ? "level" : `${gap > 0 ? "+" : "\u2212"}${Math.abs(gap)}`}
                    </span>
                  </span>
                  {!level && (
                    <p aria-hidden className="upper-label mt-1 text-[9px] text-ink-lo">
                      {gap > 0 ? "ahead" : "behind"}
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="min-w-0 text-left">
              <p className="upper-label truncate text-2xs text-ink-lo">
                {rival.teamName ?? `Entry ${rival.entry}`}
              </p>
              <p className="fig-num mt-0.5 text-[clamp(30px,7vw,44px)] leading-none">
                {rival.totals.gw}
              </p>
            </div>
          </div>

          <div className="mt-3 flex justify-center">
            <div role="group" aria-label="Compare view" className="flex gap-1 rounded-md glass-edge p-1">
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
          striped and marked; never a flat rectangle. A board mode swaps the
          turf for that board. */}
      {boardMode ? (
        <section
          aria-label={MODES.find((m) => m.id === boardMode)?.label ?? "Board"}
          aria-busy={boardLoading || undefined}
          className="space-y-3 rounded-lg has-gloss card-lift bg-raised p-4 md:p-5"
        >
          <header>
            <h2 className="fig-num text-[19px] leading-none">{BOARD_HEADS[boardMode].title}</h2>
            <p className="mt-1 max-w-[70ch] text-2xs uppercase-label text-ink-lo">
              {BOARD_HEADS[boardMode].blurb}
            </p>
          </header>
          {board ? (
            boardMode === "top" ? (
              <TopPerformers data={board as TopPerformersData} />
            ) : boardMode === "bonus" ? (
              <BonusBoard data={board as BonusBoardData} />
            ) : (
              <DefconBoard data={board as DefconBoardData} />
            )
          ) : boardError ? (
            <p role="alert" className="py-10 text-center text-sm text-ink-lo">
              {COPY.upstreamDown.body}
            </p>
          ) : (
            <BoardSkeleton />
          )}
        </section>
      ) : (
      <section aria-label={`Your team on the pitch, ${mode} mode`} className="rounded-lg has-gloss card-lift overflow-hidden bg-raised p-3 md:p-5">
        <div
          ref={pitchRef}
          className="on-turf relative overflow-hidden rounded-lg px-2 py-4 md:px-6"
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
              swingByElement={swingByElement} leverageByElement={leverageByElement} sharedSet={sharedSet}
              onPeek={setPeekElement}
              avatar={avatar}
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
                          avatar={avatar}
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
        {/* The heading above already says these are substitutes. 70% made them
            look half-rendered rather than secondary, which is the same
            complaint as the compare fade — 88% steps back without that. */}
        <ul className="flex flex-wrap gap-2 opacity-[0.88]">
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
                  avatar={avatar}
                />
              </button>
            </li>
          ))}
        </ul>

        {/* the key. Collapsed, because it is reference rather than furniture. */}
        <MatchEventLegend className="mt-4" />
      </section>
      )}

      {/* Risk is where an injury belongs: the variance above prices what your
          XI might do, this prices whether they will be there to do it. */}
      {mode === "risk" && <InjuryReport rows={model.squad} />}

      {/* Everything below reads your squad, so a market board replaces it
          rather than burying it — and a board view stops paying for charts
          nobody scrolled to. */}
      {!boardMode && (
        <>
      <EOScatter rows={model.squad} onSelect={(el) => setPeekElement(el)} />

      {/* the decision board — the Monte Carlo and Nash engines the app already
          carried, finally on screen. The simulation feed is fetched once and
          shared; the two charts that need it say so while it loads. */}
      <section aria-label="Decision board" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="upper-label text-2xs text-ink-lo">The decision board</h2>
          <p className="text-2xs text-ink-lo">
            Simulation and attribution — every figure here is an estimate, and says so.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ProcessVsOutcome
            rows={model.squad}
            fieldAvg={model.rankContext.fieldAvg}
            gwPoints={model.hero.gwPoints}
          />
          <Delivery rows={model.squad} expectedByElement={expectedByElement} />
          {decisionWeb ? (
            <>
              <RankAtRisk
                web={decisionWeb}
                estimatedRank={model.hero.estimatedLiveRank ?? model.hero.officialLiveRank}
                ranksPerPoint={model.rankContext.ranksPerPoint}
              />
              <Crossover rows={model.squad} web={decisionWeb} pointsBehind={pointsBehind} />
            </>
          ) : (
            <p className="rounded-lg bg-surface-1 card-ring p-6 text-center text-sm text-ink-lo lg:col-span-2">
              {decisionWebLoading
                ? "Simulating the gameweek — 800 Monte Carlo draws…"
                : "The simulation needs your picks and some finished fixtures to lean on."}
            </p>
          )}
          <DecisionLedger multiverse={model.multiverse} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PositionContribution rows={model.squad} />
        <Availability rows={model.squad} />
        <BonusLeaders rows={model.squad} />
        <CaptainShare rows={model.squad} />
      </div>

      {/* the season underneath the gameweek — are the players any good */}
      <section aria-label="Your fifteen this season" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="upper-label text-2xs text-ink-lo">Your fifteen this season</h2>
          <p className="text-2xs text-ink-lo">
            Season totals, not projections — what they have actually done.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ExpectedVsActual rows={model.squad} />
          <OverUnder rows={model.squad} />
          <MinutesSecurity rows={model.squad} currentGw={model.event.id} />
          <ValueForMoney rows={model.squad} />
        </div>
      </section>
        </>
      )}

      {peeked.current && (
        <PeekSheet
          element={peekElement}
          model={model}
          swingByElement={swingByElement}
          leverageByElement={leverageByElement}
          onOpenChange={(o) => {
            if (!o) setPeekElement(null);
          }}
        />
      )}
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
    case "correlation":
      // mean simulated points — the prose carries the honesty wrap above
      return { text: webMean != null ? `~${webMean.toFixed(1)}` : "—", tone: "plain" };
    case "risk":
      // neutral colour by spec — size carries the encoding, the pill just states it
      return { text: riskShare != null ? `${Math.round(riskShare * 100)}%` : "—", tone: "plain" };
    case "top":
    case "bonus":
    case "defcon":
      // the board replaces the pitch — tokens never render in these modes
      return { text: String(row.livePoints), tone: "plain" };
  }
}

/**
 * The board's placeholder while its market fetch is in flight.
 *
 * Shaped like what arrives — a control row, two charts, a table — so the
 * layout does not jump when the real thing lands.
 */
function BoardSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading board">
      <div className="h-9 w-full max-w-md rounded-md bg-surface-3/60" />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-56 rounded-lg bg-surface-3/40" />
        <div className="h-56 rounded-lg bg-surface-3/40" />
      </div>
      <div className="h-72 rounded-lg bg-surface-3/40" />
    </div>
  );
}

/** Compact per-90 figure — ".31" under 1, one decimal above. */
function fmt90(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v < 1 ? v.toFixed(2).replace(/^0/, "") : v.toFixed(1);
}

/** Player face in a club-rail frame with armband, DEFCON arc and state ring. */
export function ShirtToken({
  row, mode, swing, lev, webMean, riskShare, avatar = "face",
}: {
  row: SquadRow; mode: Mode; swing?: SwingRow; lev?: LevRow;
  webMean?: number; riskShare?: number; avatar?: AvatarMode;
}) {
  const club = clubOf(row.teamId);
  const done = row.fixtureState === "done";
  const live = row.fixtureState === "live";
  const val = modeValue(row, mode, swing, lev, webMean, riskShare);
  const defconPct = row.defconThreshold < 99 ? Math.min(1, row.defconCount / row.defconThreshold) : 0;
  const defconHit = defconPct >= 1;
  // risk mode — token SIZE encodes the marginal variance share (neutral colour)
  const riskScale = mode === "risk" && riskShare != null ? 0.78 + Math.min(0.65, riskShare * 5.5) : 1;

  return (
    <div
      className={cn(
        "relative w-[76px] text-center transition-transform duration-[600ms] focus-visible:outline-none",
      )}
      title={`${row.webName} · ${club.name}`}
    >
      {/* state ring — live pulses volt, yet-to-play is a hollow volt ring, done is a settled surge band */}
      {!done && (
        <span
          aria-hidden
          className={cn("absolute -inset-1 rounded-lg", live && "animate-[gaffer-live-ring_2s_infinite]")}
          style={{ boxShadow: live ? undefined : "inset 0 0 0 1.5px color-mix(in oklab, var(--volt) 45%, transparent)" }}
        />
      )}
      {done && (
        <span
          aria-hidden
          className="absolute -inset-1 rounded-lg"
          style={{ boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--surge) 40%, transparent)" }}
        />
      )}
      {/* DEFCON meter — defensive contributions against the two-point
          threshold. It used to be a green ring on green turf, which read as
          decoration; now the colour carries the state: steel while the work is
          still being done, gold the moment the two points are banked. */}
      {defconPct > 0 && (
        <span
          className="absolute -left-1.5 -top-1.5 h-6 w-6"
          title={`${row.webName}: ${row.defconCount} of ${row.defconThreshold} defensive contributions${
            defconHit ? " — 2 points banked" : ""
          }`}
        >
          <svg aria-hidden viewBox="0 0 40 40" className="h-full w-full -rotate-90">
            <circle cx="20" cy="20" r="17" fill="none" stroke="var(--bg-overlay)" strokeWidth="5" />
            <circle
              cx="20" cy="20" r="17" fill="none"
              stroke={defconHit ? "var(--defcon-hit)" : "var(--defcon)"}
              strokeWidth="5"
              strokeDasharray={`${defconPct * 106.8} 106.8`}
              strokeLinecap="round"
            />
          </svg>
          <span className="sr-only">
            {row.defconCount} of {row.defconThreshold} defensive contributions
          </span>
        </span>
      )}
      {/* face — club rail frame, scaled by variance share in risk mode. The
          frame clips its own contents, so the armband lives in this wrapper
          instead and is free to overhang the corner. */}
      <span
        className="relative mx-auto block h-12 w-12 transition-transform dur-base"
        style={{ transform: `scale(${riskScale.toFixed(2)})`, transformOrigin: "center bottom" }}
      >
      <span className="relative block h-full w-full overflow-hidden rounded-md">
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${club.rail} 22%, var(--surface-2)), var(--surface-2))` }}
        />
        {row.photo || avatar === "kit" ? (
          <PlayerAvatar
            photo={row.photo}
            teamId={row.teamId}
            mode={avatar}
            className="relative h-full w-full object-cover object-top"
          />
        ) : (
          <span aria-hidden className="grid h-full w-full place-items-center">
            <CrestTile teamId={row.teamId} />
          </span>
        )}
        <span
          aria-hidden
          className="absolute inset-0 rounded-md"
          style={{
            boxShadow: row.isCaptain
              ? "inset 0 0 0 2px var(--volt), inset 0 -10px 12px -8px rgba(0,0,0,.5)"
              : "inset 0 0 0 1px color-mix(in oklab, " + club.rail + " 35%, transparent), inset 0 -10px 12px -8px rgba(0,0,0,.5)",
          }}
        />
      </span>

        {row.isCaptain && (
          <span
            aria-label={row.multiplier >= 3 ? "Triple captain" : "Captain"}
            title={row.multiplier >= 3 ? "Triple captain — scores treble" : "Captain — scores double"}
            className={cn(
              "absolute -right-1.5 -top-1.5 z-20 grid place-items-center rounded-full",
              "bg-volt font-extrabold leading-none text-on-accent",
              row.multiplier >= 3 ? "h-[19px] w-[19px] text-[10px]" : "h-[18px] w-[18px] text-[11px]",
            )}
            style={{
              boxShadow:
                "0 0 0 2px var(--bg-raised), 0 0 10px 1px color-mix(in oklab, var(--volt) 55%, transparent)",
            }}
          >
            {row.multiplier >= 3 ? "3C" : "C"}
          </span>
        )}
        {row.isVice && !row.isCaptain && (
          <span
            aria-label="Vice-captain"
            title="Vice-captain — takes the armband if the captain does not play"
            /* The vice used to be grey on grey and vanished against the turf.
               It is the captain's colour now — outlined rather than filled, so
               it reads as the understudy at a glance rather than a second
               armband. */
            className="absolute -right-1.5 -top-1.5 z-20 grid h-[17px] w-[17px] place-items-center rounded-full bg-overlay text-[10px] font-extrabold leading-none text-volt"
            style={{ boxShadow: "0 0 0 2px var(--bg-raised), inset 0 0 0 1.5px var(--volt)" }}
          >
            V
          </span>
        )}
      </span>

      {row.subbedInFor !== null && (
        <span aria-label="Projected auto-substitute" title="Projected auto-sub in" className="absolute right-0 top-7 text-xs font-bold text-ultra">⇅</span>
      )}

      {/* Availability. Top-left, where the armband and the vice mark are not,
          and only when there is something to say — a cross for out or banned,
          an exclamation for a doubt. The detail is in Risk. */}
      {row.availability.flagged && (
        <span
          aria-label={`${row.webName}: ${availabilityLabel(row.availability)}`}
          title={availabilityLabel(row.availability)}
          className="absolute -left-1 -top-1 z-20 grid h-[17px] w-[17px] place-items-center rounded-full text-[11px] font-bold leading-none"
          style={{
            background: row.availability.kind === "doubt" ? "var(--amber)" : "var(--flare)",
            color: "var(--ink-fixed-dark)",
            boxShadow: "0 0 0 2px var(--bg-raised)",
          }}
        >
          {row.availability.kind === "doubt" ? "!" : "\u00d7"}
        </span>
      )}

      {/* what he has actually done — goals, assists, the shutout, cards */}
      <MatchEventStrip
        events={matchEvents(row.liveStats, {
          pos: row.pos,
          fixtureDone: done,
          bonus: row.bonus,
          bonusOfficial: row.bonusOfficial,
        })}
      />

      <span className="mt-0.5 block truncate text-2xs font-semibold text-ink-hi">{row.webName}</span>

      {/* expectation line — the real gameweek xG/xGC once the player is on the
          pitch (live feed, same Opta numbers the scoresites carry); the
          season per-90 expectation before kick-off */}
      {/* Always rendered, so the points pill sits at the same height on every
          token in the row even when a player has no expectation to show. */}
      {(
        <span
          className="mt-0.5 block h-[9px] whitespace-nowrap text-[9px] leading-none text-ink-lo num-tabular"
          title={
            row.liveStats
              ? "This gameweek's live xG and expected goals conceded (xGC) from the FPL/Opta feed"
              : "Season xG per 90 · team expected goals conceded (xGC) for this fixture"
          }
        >
          {row.liveStats || row.xg90 != null || row.xgc90 != null
            ? `xG ${fmt90(row.liveStats ? row.liveStats.xg : row.xg90)} · xGC ${fmt90(row.liveStats ? row.liveStats.xgc : row.xgc90)}`
            : "\u00a0"}
        </span>
      )}

      {/* value pill on the shoulder — points count up + wash on poll diffs; done fills, live pulses, pre outlines */}
      <span
        className={cn(
          "mt-0.5 inline-block min-w-9 skewed rounded-sm px-1.5 py-px text-center text-xs font-extrabold num-tabular",
          done && "bg-surge text-on-accent",
          live && val.tone === "volt" && "bg-volt text-on-accent",
          /* Yet to kick off. The fill has to be a fixed dark chip, not
             `bg-overlay`: overlay is white in the light theme and the turf
             ink is near-white, so this pill was a white number on a white
             pill for every player before his fixture started. */
          !done && !live && "bg-on-turf text-ink-mid card-ring",
          val.tone === "surge" && !done && "bg-transparent text-surge",
          val.tone === "flare" && !done && "bg-transparent text-flare",
          val.tone === "ultra" && !done && "bg-transparent text-ultra",
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

/**
 * Two XIs on one pitch — yours near half, theirs far.
 *
 * A shared player cannot move the gap between you — he scores the same for
 * each of you — so the pitch marks the ones only one of you owns, in that
 * half's colour. Those are the contest. Nothing is dimmed to say so.
 *
 * Every token opens the same peek sheet the ordinary pitch opens. It did not
 * before — compare rendered bare tokens instead of buttons, so the moment you
 * loaded a rival the whole pitch went dead to the touch.
 */
function ComparePitch({
  rows, mode, rival, swingByElement, leverageByElement, sharedSet, avatar = "face", onPeek,
}: {
  rows: SquadRow[][]; mode: Mode; rival: RivalPayload;
  swingByElement: Map<number, SwingRow>; leverageByElement: Map<number, LevRow>; sharedSet: Set<number>;
  avatar?: AvatarMode; onPeek: (element: number) => void;
}) {
  const rivalStarters = rival.rows.filter((r) => !r.onBench);
  const rivalBands = [1, 2, 3, 4].map((pos) => rivalStarters.filter((r) => r.pos === pos));

  /**
   * Mark the difference, do not hide the sameness.
   *
   * This used to fade shared players to 40% and blur them, which made a third
   * of the pitch look broken — half-there photos, names you could not read,
   * points you could not check — and dimming is a poor way to say "ignore
   * this" about something you can still tap. Nothing is transparent now.
   * Instead the players only ONE of you owns get a bar in their half's colour,
   * because those are the eight or ten that actually decide the gap; the
   * shared ones simply carry no bar.
   */
  const Token = ({ row, tokenMode, swing, lev, side }: {
    row: SquadRow; tokenMode: Mode; swing?: SwingRow; lev?: LevRow; side: "you" | "them";
  }) => {
    const differs = !sharedSet.has(row.element);
    return (
      <button
        type="button"
        onClick={() => onPeek(row.element)}
        aria-label={
          `${row.webName}, open details — ` +
          (differs
            ? side === "you"
              ? "only you own him"
              : "only they own him"
            : "you both own him")
        }
        className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt"
      >
        <ShirtToken row={row} mode={tokenMode} swing={swing} lev={lev} avatar={avatar} />
        <span
          aria-hidden
          className="mx-auto mt-1 block h-[3px] w-9 rounded-full"
          style={{
            /* the slot is always there so every token in a row is the same
               height; only a differential paints it */
            background: differs ? (side === "you" ? "var(--volt)" : "var(--ultra)") : "transparent",
          }}
        />
      </button>
    );
  };

  return (
    <div className="relative space-y-2.5">
      {/* far end — the rival's name over their goal */}
      <p className="text-center text-2xs uppercase-label text-ultra">{rival.teamName ?? `Entry ${rival.entry}`}</p>
      {/* far half — the rival's XI with real live data, GK at the top edge */}
      {rivalBands.map((band, i) => (
        <ul key={`rv${i}`} className="flex flex-wrap items-start justify-center gap-2">
          {band.map((r) => (
            <li key={r.element}>
              <Token row={r} tokenMode="points" side="them" />
            </li>
          ))}
        </ul>
      ))}
      {/* halfway line — the two strike forces meet here */}
      <div className="relative my-1 h-px bg-line-hi/60" />
      {/* near half — you, GK at the bottom edge, forwards facing theirs */}
      {[...rows].reverse().map((row, i) => (
        <ul key={`me${i}`} className="flex flex-wrap items-start justify-center gap-2">
          {row.map((p) => (
            <li key={p.element}>
              <Token
                row={p}
                tokenMode={mode}
                side="you"
                swing={swingByElement.get(p.element)}
                lev={leverageByElement.get(p.element)}
              />
            </li>
          ))}
        </ul>
      ))}
      <p className="text-center text-2xs uppercase-label text-volt">You</p>
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 text-center text-2xs text-ink-lo">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-[3px] w-5 rounded-full bg-volt" />
          only you
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-[3px] w-5 rounded-full bg-ultra" />
          only them
        </span>
        <span className="num-tabular">
          {sharedSet.size} shared — those cancel out
        </span>
      </p>
      <p className="text-center text-2xs text-ink-lo">Auto-subs and provisional bonus included.</p>
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
                {!r.bonusOfficial && r.bonus > 0 && <sup className="text-bonus">*</sup>}
              </td>
              <td className="px-1.5 py-1.5 text-right text-ultra">{r.subbedInFor !== null ? "⇅" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-2xs text-ink-3">* projected bonus · ⇅ projected auto-sub</p>
    </div>
  );
}
