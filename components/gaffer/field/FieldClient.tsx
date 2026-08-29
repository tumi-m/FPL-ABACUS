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
import { CreationScatter } from "@/components/gaffer/field/CreationScatter";
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
import { describeReason, itemiseGap, topSwings } from "@/lib/engines/compareGap";
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
  /** Their transfer cost, so the gap breakdown reads hits rather than infers them. */
  transfersCost: number;
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
  /* EO is a sampled cohort when the snapshot exists and an estimated prior
     otherwise; the token marks the difference rather than hiding it. */
  const eoEstimated = model.leverage.eoSource !== "cohort";
  const benchPts = model.hero.benchPoints;
  const benchBoost = model.hero.chip === "bboost";

  /**
   * The bench in the order FPL actually uses.
   *
   * A reserve keeper can only ever replace your keeper, so he is labelled GK
   * rather than given a number he would never honour; the outfield three come
   * on 1, 2, 3 in the order you left them, which is the single fact a bench
   * exists to tell you and the one this had no way of showing.
   *
   * A starter an auto-sub has already taken off arrives here through the same
   * filter (see isBenched). He keeps no order — he is not next on, he is done
   * — and sorts to the end so the three who might still play stay together.
   */
  const benchOrdered = React.useMemo(() => {
    const waiting = bench.filter((row) => row.subbedOutFor === null);
    const cameOff = bench.filter((row) => row.subbedOutFor !== null);
    let outfield = 0;
    return [
      ...waiting.map((row) => ({
        row,
        badge: row.pos === 1 ? "GK" : String(++outfield),
        off: false,
      })),
      ...cameOff.map((row) => ({ row, badge: "", off: true })),
    ];
  }, [bench]);

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
  /*
   * Your score, the way FPL counts it.
   *
   * This was the sum of the starters' raw points, which is not a gameweek
   * score: it drops the captain's doubling and ignores a hit. Against a rival
   * — whose total comes from liveSquad and therefore IS multiplied and net of
   * hits — that compared two different quantities and called the difference a
   * gap. A captained haul made you look eight points worse than you were.
   * Both sides read the same figure now.
   */
  const yourTotal = model.hero.gwPoints;

  /* One shape for every comparative chart, so a rival is passed the same way
     everywhere and `undefined` is the single switch back to solo. */
  const rivalSeries = React.useMemo(
    () =>
      rival ? { name: rival.teamName ?? `Entry ${rival.entry}`, rows: rival.rows } : undefined,
    [rival],
  );

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
        // The same correction as the compare scoreline: multiplied and net of
        // hits, which is what "GW points" means everywhere else in the game.
        const gwTotal = model.hero.gwPoints;
        return (
          /* Three destinations do not fit beside the hero figure on a phone —
             the third ran off the right edge and squeezed the total to make
             room. The row stacks under 640px and only sits side by side once
             there is width for both. */
          <div className="flex flex-col items-stretch gap-3 rounded-lg has-gloss card-lift bg-raised px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <p className="upper-label text-2xs text-ink-lo">GW{gw} points</p>
              <p className="hero-figure mt-1 text-[clamp(44px,6vw,64px)] leading-none">
                {Math.round(gwTotal).toLocaleString("en-GB")}
              </p>
            </div>
            {/* The three ways out of the pitch: out to the league your fifteen
                were picked from, sideways into what a pair of them costs, or
                down into your own score. */}
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
              <Link
                href="/field/clubs"
                role="button"
                className="skewed inline-flex h-11 shrink-0 items-center rounded-md bg-raised px-4 text-xs uppercase-label text-ink-mid card-ring transition-colors dur-instant hover:text-ink-hi"
              >
                <span>Club numbers</span>
              </Link>
              <Link
                href="/field/combos"
                role="button"
                className="skewed inline-flex h-11 shrink-0 items-center rounded-md bg-raised px-4 text-xs uppercase-label text-ink-mid card-ring transition-colors dur-instant hover:text-ink-hi"
              >
                <span>Combinations</span>
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

          {/* Why, not just how much. The scoreline says you are six behind; on
              its own that is a number to feel bad about rather than something
              to learn from. This is the same six, itemised — and it is
              arithmetic, not a model: a score is the sum of points x
              multiplier, so the difference between two scores is the sum of
              the per-player differences, and every point lands on exactly one
              name. Captaincy shows up here even on a player you BOTH own,
              which is the case the differential bars on the pitch cannot see
              and is very often the whole story of the week. */}
          <GapBreakdown
            rows={model.squad}
            rival={rival}
            netGap={yourTotal - rival.totals.gw}
            yourCost={model.hero.transfersCost}
          />

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
          {/*
           * Chalk: one half, the half the squad is actually standing on.
           *
           * This drew a whole pitch into the same box — halfway line straight
           * through the midfield row, and a second penalty area under the
           * forwards belonging to nobody. The rows run keeper at the top to
           * forwards at the bottom, which is your own half, so that is what
           * gets drawn: the goal and the eighteen-yard box around the keeper
           * where he actually stands, and the centre circle breaking the
           * bottom edge where the forwards are. Suddenly the shape under the
           * players agrees with the players.
           *
           * Everything straight is drawn stretched, which is honest — a
           * squashed pitch has squashed boxes. The two arcs are quadratics
           * rather than circles for the same reason: a circle in a stretched
           * viewBox is an ellipse pretending otherwise.
           */}
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-55" preserveAspectRatio="none" viewBox="0 0 100 100">
            <g fill="none" stroke="rgba(240,250,245,.9)" strokeWidth="0.35" strokeLinecap="square">
              <rect x="2" y="2" width="96" height="96" />
              {/* goal, six-yard box, eighteen-yard box — the keeper's furniture */}
              <rect x="43" y="0.7" width="14" height="1.3" />
              <rect x="36" y="2" width="28" height="8" />
              <rect x="24" y="2" width="52" height="22" />
              <path d="M 40 24 Q 50 30 60 24" />
              <circle cx="50" cy="15" r="0.6" fill="rgba(240,250,245,.9)" stroke="none" />
              {/* halfway, and the arc of the centre circle rising off it */}
              <line x1="2" y1="98" x2="98" y2="98" />
              <path d="M 30 98 Q 50 84 70 98" />
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
              rows={rows} mode={mode} rival={rival} eoEstimated={eoEstimated}
              swingByElement={swingByElement} leverageByElement={leverageByElement} sharedSet={sharedSet}
              onPeek={setPeekElement}
              avatar={avatar}
            />
          ) : rival && rivalView === "table" ? (
            <CompareTable rows={model.squad} rival={rival} />
          ) : (
            <div className="relative space-y-2.5">
              {rows.map((row, i) => (
                <ul key={i} className={ROW}>
                  {row.map((p) => (
                    <li
                      key={p.element}
                      className={SLOT}
                      ref={(el) => {
                        if (el) tokenRefs.current.set(p.element, el);
                        else tokenRefs.current.delete(p.element);
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setPeekElement(p.element)}
                        aria-label={`${p.webName}, open details`}
                        className="block w-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt"
                      >
                        <ShirtToken
                          eoEstimated={eoEstimated}
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

        {/*
         * The bench, with the two things a bench is actually for.
         *
         * It was four dimmed tokens in pick order and nothing else — no way to
         * tell who comes on first, which is the whole point of a bench, and no
         * answer to the only question anyone asks of it, which is what it
         * cost you. FPL's own order is GK, then 1-2-3 outfield, and that order
         * decides every auto-sub, so it is a badge on the token rather than
         * something to infer from left-to-right.
         *
         * A starter taken off by an auto-sub now lands here too (see
         * isBenched), and he is marked "off" rather than given an order
         * number: he is not waiting to come on, he has been.
         */}
        <div className="mb-2 mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="upper-label text-ink-lo">Bench</h3>
          {benchPts > 0 && (
            <p className="text-2xs text-ink-lo num-tabular">
              <span className="font-extrabold text-ink-mid">{benchPts}</span>{" "}
              {benchBoost ? "points from the bench — the boost is on" : "points left on it"}
            </p>
          )}
        </div>
        <ul className={cn(ROW, "opacity-[0.88]")}>
          {benchOrdered.map(({ row: p, badge, off }) => (
            <li key={p.element} className={SLOT}>
              <button
                type="button"
                onClick={() => setPeekElement(p.element)}
                aria-label={
                  off
                    ? `${p.webName}, substituted off, open details`
                    : `${p.webName}, substitute ${badge}, open details`
                }
                className="relative block w-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt"
              >
                <span
                  aria-hidden
                  title={
                    off
                      ? "Auto-subbed off — he did not play"
                      : badge === "GK"
                        ? "Reserve goalkeeper — only replaces your keeper"
                        : `Substitute ${badge} — comes on ${badge === "1" ? "first" : `${badge}${badge === "2" ? "nd" : "rd"}`}`
                  }
                  className={cn(
                    "absolute left-[calc(2*var(--s))] top-[calc(2*var(--s))] z-20 grid h-[calc(16*var(--s))] min-w-[calc(16*var(--s))] place-items-center rounded-full px-1",
                    "text-[calc(9*var(--s))] font-extrabold leading-none",
                    off ? "bg-flare text-on-accent" : "bg-on-turf text-ink-mid card-ring",
                  )}
                >
                  {off ? "OFF" : badge}
                </span>
                <ShirtToken
                  eoEstimated={eoEstimated}
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

      {/* The squad-shape charts. With a rival loaded they stop being a report
          on your fifteen and become a comparison of two, on the pitch's own
          colours: volt is you, ultra is them, the same pair the differential
          bars use, so the mapping is learned once. */}
      <section aria-label={rival ? "You against them" : "Your gameweek"} className="space-y-4">
        {rival && (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="upper-label text-2xs text-ink-lo">You against them</h2>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-lo">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-volt" />
                you
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-ultra" />
                {rival.teamName ?? `Entry ${rival.entry}`}
              </span>
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PositionContribution rows={model.squad} rival={rivalSeries} />
          <Availability rows={model.squad} rival={rivalSeries} />
          <BonusLeaders rows={model.squad} rival={rivalSeries} />
          <CaptainShare rows={model.squad} rival={rivalSeries} />
        </div>
      </section>

      {/* the season underneath the gameweek — are the players any good */}
      <section aria-label="Your fifteen this season" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="upper-label text-2xs text-ink-lo">Your fifteen this season</h2>
          {/* Named as yours even in compare mode. These read a player's whole
              season rather than this week's scoreline, so putting a rival's
              fifteen on the same axes would double the marks without adding a
              comparison — and leaving the heading ambiguous next to four
              charts that ARE comparative is the worse mistake. */}
          <p className="text-2xs text-ink-lo">
            {rival
              ? "Your squad only — season totals, not projections."
              : "Season totals, not projections — what they have actually done."}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ExpectedVsActual rows={model.squad} />
          <OverUnder rows={model.squad} />
          <MinutesSecurity rows={model.squad} currentGw={model.event.id} />
          <ValueForMoney rows={model.squad} />
        </div>
      </section>

      {/* Everything above this line is your fifteen. This one is the league
          they came out of, on the same axes — which is the only way to see
          that the creator you are missing is a row you never scrolled to. */}
      <section aria-label="The league this season" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="upper-label text-2xs text-ink-lo">Everyone else, too</h2>
          <p className="text-2xs text-ink-lo">
            The whole market on one pair of axes — yours marked.
          </p>
        </div>
        <CreationScatter mine={model.squad.map((p) => p.element)} />
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
      return { text: String(tokenScore(row)), tone: live ? "volt" : "plain" };
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

/**
 * A line of the pitch, and one slot on it.
 *
 * The rows used to wrap. Five midfielders at a fixed seventy-six pixels need
 * 412px of row and a phone gives about 374, so the fifth dropped onto a line
 * of his own and a 3-5-2 drew itself as a 3-4-1-2 — a formation FPL does not
 * have. The row cannot wrap now; the tokens share what there is instead, each
 * capped at the size it used to be, so a wide screen looks exactly as before
 * and a narrow one shrinks the whole line rather than breaking it.
 */
/* px-1 is the state ring's overhang: it sits at -inset-1, so the outermost
   token in a full row had its ring shaved off by the pitch's own clip. */
const ROW = "flex flex-nowrap items-start justify-center gap-1.5 px-1 sm:gap-2";
const SLOT = "min-w-0 max-w-[76px] flex-1";

/** Compact per-90 figure — ".31" under 1, one decimal above. */
function fmt90(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v < 1 ? v.toFixed(2).replace(/^0/, "") : v.toFixed(1);
}

/**
 * The number on a token: what this player put on YOUR scoreboard.
 *
 * It was the raw player score, so a captain showed eight where he had earned
 * you sixteen — and the pitch therefore did not add up to the total printed
 * above it, which is the one arithmetic a reader will actually check. Every
 * other surface already multiplies: the hero figure, the compare scoreline,
 * the gap breakdown, `contribution()` in the charts.
 *
 * Multiplier rather than isCaptain, because a vice who inherits the armband
 * has the multiplier and not the flag, and a triple captain has three.
 *
 * A bench player's multiplier is zero, and zero is the wrong thing to print
 * for a man who scored eleven you did not get: off the pitch the honest
 * number is what he scored, which is exactly the "points left on the bench"
 * story the bench heading tells.
 */
function tokenScore(row: SquadRow): number {
  return row.multiplier > 0 ? row.livePoints * row.multiplier : row.livePoints;
}

/**
 * Line three: where this player is in his week.
 *
 * Before kick-off the useful fact is who he plays and whether it is away;
 * once he is on it is how long he has been on; afterwards the same in the past
 * tense, or plainly that he never came on. It used to carry a threat figure
 * too, which turned out to be the wrong place for it — see tokenExpectation.
 */
function tokenLine(row: SquadRow): { text: string; title: string } {
  if (row.fixtureState === "pre") {
    const opp = row.opponentShort;
    return {
      text: opp && opp !== "\u2014" ? (opp.startsWith("@") ? opp : `v ${opp}`) : "\u00a0",
      title: "This gameweek's fixture — @ means away",
    };
  }

  if (row.minutes <= 0) {
    return {
      text: row.fixtureState === "done" ? "did not play" : "not on",
      title: row.fixtureState === "done" ? "No minutes in this gameweek" : "Has not come on yet",
    };
  }

  return { text: `${row.minutes}'`, title: "Minutes played this gameweek" };
}

/**
 * The one expectation figure a token carries.
 *
 * This grew to four across two lines — xG, xA, their sum, and xGC — and four
 * figures on fifteen tokens is sixty numbers on one screen, which is a
 * spreadsheet rather than a pitch. A token has room to answer one question
 * well; the rest belongs where there is space to lay it out, which is the
 * sheet a tap opens.
 *
 * The one that survives is the one the position is judged by. A keeper and a
 * defender live on what gets past them, so they keep xGC; a midfielder or a
 * forward is read by what he is worth at the other end, so they keep xGI —
 * the headline, with its xG and xA split one tap away.
 */
function tokenExpectation(row: SquadRow): { text: string; title: string } {
  const live = row.liveStats;
  const defensive = row.pos === 1 || row.pos === 2;

  if (defensive) {
    const xgc = live ? live.xgc : row.xgc90;
    return {
      text: xgc == null ? "\u00a0" : `xGC ${fmt90(xgc)}`,
      title: live
        ? "Expected goals conceded while he was on, this gameweek"
        : "The fixture model's expected goals against for this match — tap for the rest",
    };
  }

  const xg = live ? live.xg : row.xg90;
  const xa = live ? live.xa : row.xa90;
  if (xg == null && xa == null) return { text: "\u00a0", title: "" };
  return {
    // Summed from xG and xA rather than read from FPL's own field, so the
    // headline can never disagree with the split the sheet shows underneath.
    text: `xGI ${fmt90((xg ?? 0) + (xa ?? 0))}`,
    title: live
      ? "Expected goal involvements this gameweek — expected goals plus expected assists. Tap for the split."
      : "Season expected goal involvements per 90 — expected goals plus expected assists. Tap for the split.",
  };
}

/** Player face in a club-rail frame with armband, DEFCON arc and state ring. */
export function ShirtToken({
  row, mode, swing, lev, webMean, riskShare, avatar = "face", eoEstimated = true,
}: {
  row: SquadRow; mode: Mode; swing?: SwingRow; lev?: LevRow;
  webMean?: number; riskShare?: number; avatar?: AvatarMode;
  /** True while EO is the prior rather than a sampled cohort — it gets a tilde. */
  eoEstimated?: boolean;
}) {
  const club = clubOf(row.teamId);
  const done = row.fixtureState === "done";
  const line = tokenLine(row);
  const expectation = tokenExpectation(row);
  const live = row.fixtureState === "live";
  const val = modeValue(row, mode, swing, lev, webMean, riskShare);
  const defconPct = row.defconThreshold < 99 ? Math.min(1, row.defconCount / row.defconThreshold) : 0;
  const defconHit = defconPct >= 1;
  // risk mode — token SIZE encodes the marginal variance share (neutral colour)
  const riskScale = mode === "risk" && riskShare != null ? 0.78 + Math.min(0.65, riskShare * 5.5) : 1;
  /* A real headshot in Faces mode — cut out, transparent, meant to float. */
  const bareFace = avatar === "face" && Boolean(row.photo);

  return (
    <div
      className={cn(
        "@container relative w-full text-center transition-transform duration-[600ms] focus-visible:outline-none",
      )}
      /**
       * One scaled pixel, and everything inside is a multiple of it.
       *
       * The token used to be 76px with every part of it a fixed size. Now the
       * row hands it whatever width is going, so the parts have to follow —
       * and following them one arbitrary value at a time is how a face ends up
       * scaled and the name it sits above does not. `--s` is a pixel that
       * shrinks with the token and never grows past one, so a full-width token
       * is byte-for-byte what it was and a squeezed one is the same drawing,
       * smaller. 1.316cqw is 1px at the old 76.
       */
      style={
        {
          ["--s" as string]: "min(1px, 1.316cqw)",
          ["--evt" as string]: "calc(15*min(1px, 1.316cqw))",
          ["--evt-row" as string]: "calc(21*min(1px, 1.316cqw))",
        } as React.CSSProperties
      }
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
      {/*
       * The defensive-contribution arc, only where it is the subject.
       *
       * It was drawn on every token in every mode, so a Points pitch came out
       * covered in part-filled rings that read as loading spinners hovering
       * over people's heads — the single biggest source of "something is going
       * on that I cannot name" on this screen. It is a DEFCON idea, so it
       * belongs in DEFCON mode; the one exception is a threshold already met,
       * because two banked points are worth saying wherever you are.
       */}
      {defconPct > 0 && (mode === "defcon" || defconHit) && (
        <span
          className="absolute -left-1.5 -top-1.5 h-[calc(24*var(--s))] w-[calc(24*var(--s))]"
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
        className="relative mx-auto block aspect-square w-[calc(48*var(--s))] transition-transform dur-base"
        style={{ transform: `scale(${riskScale.toFixed(2)})`, transformOrigin: "center bottom" }}
      >
      <span className="relative block h-full w-full overflow-hidden rounded-md">
        {/* The plate, and when it earns its place.
            A headshot is a cut-out with transparent shoulders, so a filled
            tile behind one is not a backdrop for the photo — it is a coloured
            card the player is stuck to, and eleven of them turn the pitch into
            a sticker album. A kit, a crest or an empty slot does need
            something to sit on. So the plate is drawn for those and skipped
            for a real face, which then floats on the grass the way it should:
            the shadow underneath does the lifting instead. */}
        {!bareFace && (
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${club.rail} 22%, var(--surface-2)), var(--surface-2))` }}
          />
        )}
        {row.photo || avatar === "kit" ? (
          <PlayerAvatar
            photo={row.photo}
            teamId={row.teamId}
            mode={avatar}
            className={cn(
              "relative h-full w-full object-cover object-top",
              // Nothing behind it, so the face carries its own separation.
              bareFace && "drop-shadow-[0_2px_6px_rgba(0,0,0,.55)]",
            )}
          />
        ) : (
          <span aria-hidden className="grid h-full w-full place-items-center">
            <CrestTile teamId={row.teamId} />
          </span>
        )}
        {/* The captain's ring is an armband and always shows. The club
            hairline and the bottom vignette were edges for the plate, so they
            go with it. */}
        {(row.isCaptain || !bareFace) && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-md"
            style={{
              boxShadow: row.isCaptain
                ? "inset 0 0 0 2px var(--volt)" + (bareFace ? "" : ", inset 0 -10px 12px -8px rgba(0,0,0,.5)")
                : "inset 0 0 0 1px color-mix(in oklab, " + club.rail + " 35%, transparent), inset 0 -10px 12px -8px rgba(0,0,0,.5)",
            }}
          />
        )}
      </span>

        {/* The other half of a swap. A substitute who has come on looks
            exactly like a starter otherwise, and "why is he on my pitch" is a
            question the pitch should answer itself. Left shoulder, so it can
            never collide with the armband on the right. */}
        {row.subbedInFor !== null && (
          <span
            aria-label="Came on as an automatic substitute"
            title="Auto-subbed on — he replaced a starter who did not play"
            className={cn(
              "absolute -left-1.5 -top-1.5 z-20 grid h-[calc(16*var(--s))] place-items-center rounded-full px-1",
              "bg-surge text-[calc(9*var(--s))] font-extrabold leading-none text-on-accent",
            )}
            style={{ boxShadow: "0 0 0 2px var(--bg-raised)" }}
          >
            ON
          </span>
        )}
        {row.isCaptain && (
          <span
            aria-label={row.multiplier >= 3 ? "Triple captain" : "Captain"}
            title={row.multiplier >= 3 ? "Triple captain — scores treble" : "Captain — scores double"}
            className={cn(
              "absolute -right-1.5 -top-1.5 z-20 grid place-items-center rounded-full",
              "bg-volt font-extrabold leading-none text-on-accent",
              row.multiplier >= 3
                ? "h-[calc(19*var(--s))] w-[calc(19*var(--s))] text-[calc(10*var(--s))]"
                : "h-[calc(18*var(--s))] w-[calc(18*var(--s))] text-[calc(11*var(--s))]",
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

      {/*
       * One plate, not three things floating on grass.
       *
       * The name, the score and the context line were three separate stacks
       * with three different treatments, painted straight onto a textured
       * pitch — so fifteen players read as forty-five loose fragments and
       * every one of them fought the turf for legibility. Grouping them onto a
       * single dark plate is what makes a crowded pitch calm: the plate
       * carries its own contrast, so it works on grass and on the bench's
       * light card without either needing to know about the other.
       *
       * The score keeps a pill of its own inside it, because the fill is
       * carrying state — settled, live, not yet — and that is worth more than
       * the tidiness of flattening it into text.
       */}
      <span
        className="mt-[calc(3*var(--s))] block w-full overflow-hidden rounded-md px-[calc(4*var(--s))] py-[calc(3*var(--s))] text-left"
        style={{ background: "var(--plate)" }}
      >
        <span
          className="block truncate text-[calc(11*var(--s))] font-semibold leading-tight text-ink-hi"
        >
          {row.webName}
        </span>

        <span className="mt-[calc(2*var(--s))] flex min-w-0 items-center justify-between gap-[calc(3*var(--s))]">
          {/* value pill — done fills as a scoreboard, live pulses volt, yet to
              play stays an outline. See --score-on-turf. */}
          <span
            className={cn(
              "inline-block shrink-0 skewed rounded-sm px-[calc(5*var(--s))] py-px text-center text-[calc(12*var(--s))] font-extrabold num-tabular",
              /* A fixed near-white plate needs a fixed dark ink. text-on-accent
                 is dark ON the turf and WHITE off it, so on the bench in light
                 mode a finished score was white on near-white. */
              done && "bg-score-turf",
              live && val.tone === "volt" && "bg-volt text-on-accent",
              !done && !live && "text-ink-mid",
              val.tone === "surge" && !done && "bg-transparent text-surge",
              val.tone === "flare" && !done && "bg-transparent text-flare",
              val.tone === "ultra" && !done && "bg-transparent text-ultra",
            )}
            style={
              done
                ? { color: "var(--ink-fixed-dark)" }
                : !live
                  ? { background: "var(--plate-chip)" }
                  : undefined
            }
            title={
              mode !== "points"
                ? undefined
                : row.multiplier > 1
                  ? `${row.livePoints} points, ${row.multiplier === 3 ? "tripled" : "doubled"} for the armband — ${tokenScore(row)} to you`
                  : row.multiplier === 0
                    ? `${row.livePoints} points, on the bench — none of them counted`
                    : `${row.livePoints} points`
            }
          >
            {mode === "points" ? (
              /*
               * A player who has not kicked off has not scored nought.
               *
               * Eleven zeroes before a deadline fills the most prominent slot
               * on every token with a figure that reads as a result and is
               * really an absence — and it is indistinguishable from a striker
               * who played ninety minutes and blanked, which is a completely
               * different week. A finished nought stays a nought: that one IS
               * a result.
               */
              row.fixtureState === "pre" ? (
                <span aria-label={`${row.webName} has not kicked off`}>–</span>
              ) : (
                <AnimatedNumber value={tokenScore(row)} format={(v) => String(Math.round(v))} />
              )
            ) : (
              <span>{val.text}</span>
            )}
          </span>

          {/*
           * Ownership, next to the score rather than instead of it.
           *
           * It had a mode of its own, which meant the two figures that decide
           * whether a week is good — what he scored and how many other people
           * had him — could never be read together. Nine points is a fine
           * return and a disaster if ninety per cent of the game owns him.
           * Marked with a tilde when it is the estimated prior rather than a
           * sampled cohort, the same honesty the rest of the app uses.
           */}
          {mode === "points" && (
            <span
              className="min-w-0 truncate text-[calc(9*var(--s))] leading-none text-ink-lo num-tabular"
              title={
                eoEstimated
                  ? "Estimated effective ownership — no cohort sample yet"
                  : "Effective ownership, sampled from the cohort"
              }
            >
              {eoEstimated ? "~" : ""}
              {Math.round(row.eo)}%
            </span>
          )}
        </span>

        {/* Where he is in his week, then what he is expected to do. Both
            slots always render so the plates keep one height across a row —
            see tokenLine and tokenExpectation. */}
        <span
          className="mt-[calc(2*var(--s))] block h-[calc(9*var(--s))] truncate whitespace-nowrap text-[calc(9*var(--s))] leading-none text-ink-lo num-tabular"
          title={line.title}
        >
          {line.text}
        </span>
        <span
          className="mt-[calc(1*var(--s))] block h-[calc(9*var(--s))] truncate whitespace-nowrap text-[calc(9*var(--s))] leading-none text-ink-lo num-tabular"
          title={expectation.title}
        >
          {expectation.text}
        </span>
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
  rows, mode, rival, swingByElement, leverageByElement, sharedSet, avatar = "face", onPeek, eoEstimated,
}: {
  rows: SquadRow[][]; mode: Mode; rival: RivalPayload;
  swingByElement: Map<number, SwingRow>; leverageByElement: Map<number, LevRow>; sharedSet: Set<number>;
  avatar?: AvatarMode; onPeek: (element: number) => void; eoEstimated: boolean;
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
        className="block w-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt"
      >
        <ShirtToken row={row} mode={tokenMode} swing={swing} lev={lev} avatar={avatar} eoEstimated={eoEstimated} />
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
      {/*
       * The rival's name over their goal, on a plate of its own.
       *
       * It was bare text in the normal flow, sitting exactly where the chalk
       * draws the goal and the six-yard box — so a white line ran through the
       * middle of somebody's team name and the whole thing read as clipped.
       * The halfway band already solved this problem once; the far end gets
       * the same treatment rather than a second answer to it.
       */}
      <div className="flex justify-center">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[rgba(4,18,31,.58)] px-3 py-1 text-2xs uppercase-label text-ultra ring-1 ring-[rgba(255,255,255,.16)]">
          <span className="truncate">{rival.teamName ?? `Entry ${rival.entry}`}</span>
          <span aria-hidden>↓</span>
        </span>
      </div>
      {/* far half — the rival's XI with real live data, GK at the top edge */}
      {rivalBands.map((band, i) => (
        <ul key={`rv${i}`} className={ROW}>
          {band.map((r) => (
            <li key={r.element} className={SLOT}>
              <Token row={r} tokenMode="points" side="them" />
            </li>
          ))}
        </ul>
      ))}
      {/*
       * The halfway line, drawn like one.
       *
       * It was a one-pixel hairline at 60% opacity, which on a dark pitch is
       * invisible — so twenty-two players read as one twenty-two-player team,
       * and because you and a rival usually share half a squad the same name
       * appeared twice with nothing to explain why. The two labels that did
       * exist sat at the very top and the very bottom, both off-screen on a
       * phone at the moment you needed them.
       *
       * So the join is a band across the pitch carrying both names, each
       * pointing at its own half. Wherever you stop scrolling, the nearest
       * thing to the middle of the screen tells you whose eleven you are
       * looking at. It draws no line of its own: the pitch already has a
       * halfway line and a centre circle, and a second pair a few rows off
       * from those read as a mistake rather than as structure.
       */}
      <div className="my-2 flex items-center justify-between gap-3 rounded-full bg-[rgba(4,18,31,.58)] px-3 py-1.5 ring-1 ring-[rgba(255,255,255,.16)]">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-2xs uppercase-label text-ultra">
          <span aria-hidden>↑</span>
          <span className="truncate">{rival.teamName ?? `Entry ${rival.entry}`}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-2xs uppercase-label text-volt">
          <span>You</span>
          <span aria-hidden>↓</span>
        </span>
      </div>
      {/* near half — you, GK at the bottom edge, forwards facing theirs */}
      {[...rows].reverse().map((row, i) => (
        <ul key={`me${i}`} className={ROW}>
          {row.map((p) => (
            <li key={p.element} className={SLOT}>
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

/**
 * The gap, itemised.
 *
 * Three names carry most of any weekly gap, and naming them turns a deficit
 * into a lesson: a captain you got wrong is a different week from a player you
 * do not own. The parts reconcile with the scoreline exactly — see
 * lib/engines/compareGap, which has a test that says so — so the remainder
 * line is honest arithmetic rather than a fudge, and it only appears when
 * there is a remainder to declare.
 */
function GapBreakdown({
  rows,
  rival,
  netGap,
  yourCost,
}: {
  rows: SquadRow[];
  rival: RivalPayload;
  /** The scoreline's own gap, which the parts must add up to. */
  netGap: number;
  /** Points you spent on transfers this week. */
  yourCost: number;
}) {
  const { rows: gapRows } = itemiseGap(
    rows.map((r) => ({
      element: r.element,
      webName: r.webName,
      teamId: r.teamId,
      livePoints: r.livePoints,
      multiplier: r.multiplier,
    })),
    rival.rows.map((r) => ({
      element: r.element,
      webName: r.webName,
      teamId: r.teamId,
      livePoints: r.livePoints,
      multiplier: r.multiplier,
    })),
  );

  /*
   * Hits are the one part of a gap that belongs to nobody, and they are read
   * from both managers' actual transfer costs rather than inferred.
   *
   * The tempting shortcut is netGap - playerGap: both totals are net of hits,
   * so whatever the players do not explain "must" be the hit difference. That
   * is only true when nothing else is out of step, and the failure mode is
   * ugly — anything anomalous in the data gets confidently relabelled as a
   * transfer hit, in fours or not. Reading the two costs means the hit line is
   * a fact, and anything still unexplained stays in the remainder where a
   * reader can see it is a remainder.
   */
  const hitGap = rival.transfersCost - yourCost;
  if (gapRows.length === 0 && hitGap === 0) return null;
  const top = topSwings(gapRows, 3);
  const rest = Math.round(netGap - hitGap - top.reduce((sum, r) => sum + r.delta, 0));

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      <p className="upper-label text-2xs text-ink-lo">What is making the difference</p>
      <ul className="mt-2 space-y-1.5">
        {top.map((row) => {
          const good = row.delta > 0;
          return (
            <li key={row.element} className="flex items-center gap-2.5 text-xs">
              <span
                className={cn(
                  "skewed inline-flex h-6 w-11 shrink-0 items-center justify-center rounded-sm text-2xs font-extrabold num-tabular",
                  good ? "bg-surge text-on-accent" : "bg-flare text-on-accent",
                )}
              >
                {good ? "+" : "\u2212"}
                {Math.abs(row.delta)}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink-hi">{row.webName}</span>
              <span className="shrink-0 text-2xs text-ink-lo">{describeReason(row)}</span>
            </li>
          );
        })}
      </ul>
      {hitGap !== 0 && (
        <p className="mt-2 flex items-center gap-2.5 text-xs">
          <span
            className={cn(
              "skewed inline-flex h-6 w-11 shrink-0 items-center justify-center rounded-sm text-2xs font-extrabold num-tabular",
              hitGap > 0 ? "bg-surge text-on-accent" : "bg-flare text-on-accent",
            )}
          >
            {hitGap > 0 ? "+" : "\u2212"}
            {Math.abs(hitGap)}
          </span>
          <span className="min-w-0 flex-1 text-ink-hi">Transfer hits</span>
          <span className="shrink-0 text-2xs text-ink-lo">
            {hitGap > 0 ? "they took more" : "you took more"}
          </span>
        </p>
      )}
      {rest !== 0 && (
        <p className="mt-2 text-2xs text-ink-lo num-tabular">
          {gapRows.length - top.length > 0
            ? `${gapRows.length - top.length} more ${gapRows.length - top.length === 1 ? "difference accounts" : "differences account"} for the remaining `
            : "Remaining "}
          {rest > 0 ? "+" : "\u2212"}
          {Math.abs(rest)}.
        </p>
      )}
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
              {/* Same rule as the pitch — see tokenScore. This column has to
                  add up to the scoreline beside it, and a raw captain does
                  not. */}
              <td
                className="px-1.5 py-1.5 text-right font-semibold text-ink-hi"
                title={
                  r.multiplier > 1
                    ? `${r.livePoints} points, ${r.multiplier === 3 ? "tripled" : "doubled"} for the armband`
                    : undefined
                }
              >
                {tokenScore(r)}
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
