"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { HeroScore } from "@/components/gaffer/matchday/HeroScore";
import { RegretMeter } from "@/components/gaffer/matchday/RegretMeter";
import { SwingFeed } from "@/components/gaffer/matchday/SwingFeed";
import { LeverageBoard } from "@/components/gaffer/matchday/LeverageBoard";
import { MatchPitch } from "@/components/gaffer/matchday/MatchPitch";
import { SquadTable } from "@/components/gaffer/matchday/SquadTable";
import { Scoreboard } from "@/components/gaffer/matchday/Scoreboard";
import { GameweekPicker } from "@/components/gaffer/GameweekPicker";
import { MomentToast } from "@/components/gaffer/MomentToast";
import { weekMoment, type MomentSpec } from "@/lib/engines/weekPhase";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

const POLL_LIVE_MS = 20_000;
const POLL_IDLE_MS = 300_000;
const VIEW_KEY = "gaffer_md_view";

type Panel = "scores" | "feed" | "board" | "team";

export function MatchdayClient({
  initialModel,
  historical = false,
}: {
  initialModel: MatchdayModel;
  /** A past gameweek is a fixed record: nothing to poll, nothing to toast. */
  historical?: boolean;
}) {
  const [panel, setPanel] = React.useState<Panel>("scores");
  const [view, setView] = React.useState<"pitch" | "table">("pitch");
  const entry = initialModel.entry.id;

  React.useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "table" || v === "pitch") setView(v);
    } catch {
      // ignore
    }
  }, []);

  const chooseView = (v: "pitch" | "table") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // ignore
    }
  };

  const { data } = useSWR<MatchdayModel>(
    ["gaffer-live", entry, initialModel.event.id],
    async ([, keyEntry, gw]: [string, number, number]) => {
      const res = await fetch(
        historical ? `/api/gaffer/live?entry=${keyEntry}&gw=${gw}` : `/api/gaffer/live?entry=${keyEntry}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as MatchdayModel;
    },
    {
      fallbackData: initialModel,
      refreshInterval: (latest?: MatchdayModel) => {
        // A past gameweek is settled — polling it is pure waste.
        if (historical) return 0;
        if (typeof document !== "undefined" && document.hidden) return 0;
        const p = latest?.phase ?? initialModel.phase;
        return p === "live" || p === "provisional" ? POLL_LIVE_MS : POLL_IDLE_MS;
      },
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );
  const model = data as MatchdayModel | undefined;
  const current = model ?? initialModel;

  // Week Machine lite — phase-driven emphasis, computed after mount so SSR and
  // hydration agree. Nav is never gated; every surface stays escapable.
  const [moment, setMoment] = React.useState<MomentSpec | null>(null);
  React.useEffect(() => {
    setMoment(weekMoment(current.phase, Date.now(), current.event.deadlineTime));
  }, [current.phase, current.event.deadlineTime]);

  // Bonus settle-fade: the moment the GW leaves provisional territory.
  const settled = current.phase === "bonus_added" || current.phase === "final";

  // Rank-climb moment — fires once per improvement against this GW's best
  // known rank on this device; dismissible, auto-clears.
  const [toast, setToast] = React.useState<string | null>(null);
  const lastClimbRef = React.useRef<number | null>(null);
  const liveRank = current?.hero.officialLiveRank ?? current?.hero.estimatedLiveRank ?? null;
  const peakKey = `gaffer_peak_${current.event.id}`;
  React.useEffect(() => {
    if (liveRank == null || document.hidden) return;
    try {
      const peak = Number(localStorage.getItem(peakKey));
      if (Number.isFinite(peak) && peak > 0 && liveRank < peak && lastClimbRef.current !== liveRank) {
        lastClimbRef.current = liveRank;
        setToast(`Up ${peak - liveRank} places — now #${liveRank.toLocaleString("en-GB")}`);
      }
      if (!Number.isFinite(peak) || liveRank < peak) localStorage.setItem(peakKey, String(liveRank));
    } catch {
      /* storage blocked — no moment, no harm */
    }
  }, [liveRank, peakKey]);

  // Atmosphere trend — style guide §10: floodlight bank tint interpolates
  // surge-weighted when your rank is rising, flare-weighted when falling.
  const prevRankRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const root = document.documentElement;
    const prev = prevRankRef.current;
    if (liveRank != null && prev != null && liveRank !== prev) {
      root.dataset.trend = liveRank < prev ? "up" : "down";
    }
    if (liveRank != null) prevRankRef.current = liveRank;
    return () => {
      delete root.dataset.trend;
    };
  }, [liveRank]);
  const regretProps = {
    regretIndex: current.multiverse.regretIndex,
    reliefIndex: current.multiverse.reliefIndex,
    topRegret: current.multiverse.results.find((r) => r.ranksDelta > 0) ?? null,
    topRelief: current.multiverse.results.find((r) => r.ranksDelta < 0) ?? null,
    rows: current.multiverse.results.map((r) => ({
      label: r.label,
      pointsDelta: r.pointsDelta,
      ranksDelta: r.ranksDelta,
    })),
    sampleSize: current.rankContext.sampleSize,
    // Without the curve the branches price at zero ranks apiece; the card
    // switches to points rather than showing an empty meter.
    curveAvailable: current.rankContext.curveAvailable,
  };

  return (
    <div className="space-y-4">
      {/* the same picker the Field carries, so a week is chosen one way */}
      <h1 className="sr-only">Home — GW{current.event.id}</h1>
      <div className="lower3">
        <div className="lower3-flag bg-volt" />
        <div className="lower3-body">
          <GameweekPicker
            gw={current.event.id}
            latest={current.event.latest}
            basePath="/live"
          />
          {historical && (
            <span className="upper-label text-2xs text-ink-lo">settled · a past round</span>
          )}
          <span className="text-2xs uppercase-label text-ink-lo">{current.phase}</span>
          <Link
            href="/squad"
            className="skewed ml-auto inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md card-ring px-3 text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
          >
            <span>My team</span>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ── Mobile ─────────────────────────────────────────────── */}
      <div className="space-y-4 lg:hidden">
        <HeroScore model={current} moment={moment} />
        <div role="group" aria-label="Matchday panels" className="grid grid-cols-4 gap-1 rounded-full glass-edge p-1">
          {(
            [
              ["scores", "Scores"],
              ["team", "Team"],
              ["board", "Board"],
              ["feed", "Feed"],
            ] as [Panel, string][]
          ).map(([p, label]) => (
            <button
              key={p}
              onClick={() => setPanel(p)}
              aria-pressed={panel === p}
              className={`h-8 rounded-full text-xs font-medium transition-colors dur-instant ${
                panel === p ? "bg-surface-3 text-ink-1" : "text-ink-3"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {panel === "board" && (
          <>
            <RegretMeter {...regretProps} />
            <LeverageBoard model={current} />
          </>
        )}
        {panel === "team" && (
          <>
            {view === "pitch" ? <MatchPitch model={current} /> : <SquadTable model={current} settled={settled} />}
            <PitchTableToggle view={view} choose={chooseView} />
          </>
        )}
        {panel === "scores" && <Scoreboard model={current} />}
        {panel === "feed" && <SwingFeed model={current} />}
      </div>

      {/* ── Desktop ────────────────────────────────────────────── */}
      <div className="hidden space-y-4 lg:block">
        <HeroScore model={current} moment={moment} />
        {/* Scores lead on Home: the round is the headline, your rank is the
            gloss on it. It used to sit at the very bottom of the column. */}
        <Scoreboard model={current} />
        {view === "pitch" ? <MatchPitch model={current} /> : <SquadTable model={current} settled={settled} />}
        <PitchTableToggle view={view} choose={chooseView} />
        <LeverageBoard model={current} />
        <RegretMeter {...regretProps} />
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-16 h-[calc(100dvh-6rem)]">
          <SwingFeed model={current} />
        </div>
      </div>
      </div>
      <MomentToast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function PitchTableToggle({
  view,
  choose,
}: {
  view: "pitch" | "table";
  choose: (v: "pitch" | "table") => void;
}) {
  return (
    <div className="flex justify-center">
      <div role="group" aria-label="Team view" className="inline-flex rounded-full glass-edge p-0.5">
        {(["pitch", "table"] as const).map((v) => (
          <button
            key={v}
            onClick={() => choose(v)}
            aria-pressed={view === v}
            className={`h-7 rounded-full px-3.5 text-xs font-medium capitalize transition-colors dur-instant ${
              view === v ? "bg-surface-3 text-ink-1" : "text-ink-3 hover:text-ink-1"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
