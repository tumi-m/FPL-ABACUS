import { buildLiveSquad, type LiveSquad } from "@/lib/engines/liveSquad";
import { buildFixtureModel, projectFixture } from "@/lib/engines/fixtureModel";
import { fallbackEO } from "@/lib/engines/eo";
import { ranksPerPoint, liveRank as computeLiveRank, type RankCurve } from "@/lib/engines/rankModel";
import { swingForEvent, reconcile } from "@/lib/engines/swing";
import type { RawEvent } from "@/lib/engines/swing";
import { leverageRow, type LeverageRow } from "@/lib/engines/leverage";
import { runMultiverse, regretRelief, type Branch, type BranchResult } from "@/lib/engines/multiverse";
import { eventPoints } from "@/lib/engines/swing";
import { parseScoring } from "@/lib/engines/scoring";
import type { BootstrapLite } from "@/lib/fpl/bootstrapLite";
import type { Entry, EventStatus, Fixture, GwPhase, Live, PicksResponse, Transfer } from "@/lib/fpl/schemas";
import type { Pos } from "@/lib/engines/types";

export interface SquadRow {
  element: number;
  webName: string;
  pos: Pos;
  teamShort: string;
  teamCode: number;
  multiplier: number;
  isCaptain: boolean;
  isVice: boolean;
  onBench: boolean;
  minutes: number;
  livePoints: number;
  provisionalBonus: number;
  /** Actual bonus points (1·2·3) — official from the feed, else projected. */
  bonus: number;
  /** False while bonus is still our projection — FPL hasn't added it yet. */
  bonusOfficial: boolean;
  defconCount: number;
  defconThreshold: number;
  fixtureId: number | null;
  opponentShort: string;
  fixtureState: "pre" | "live" | "done";
  fixtureMinute: number;
  subbedInFor: number | null;
  /** FPL team id (1–20) — the club-identity lookup key. */
  teamId: number;
  /** Effective ownership % in the selected cohort (estimated prior if no snapshot). */
  eo: number;
  /** Headshot photo code from bootstrap (playerImg key), empty when unknown. */
  photo: string;
  /** Season xG per 90 (shrunk) — the scoring expectation under the face. */
  xg90: number | null;
  /** Team expected goals conceded for this fixture (fixture model, per 90). */
  xgc90: number | null;
  /** Per-GW live stat line from the event feed — null before a player is involved. */
  liveStats: import("@/lib/engines/types").LiveStatsLite | null;
}

export interface SwingRow {
  id: string;
  minute: number;
  element: number;
  webName: string;
  identifier: string;
  points: number;
  eo: number;
  yourMultiplier: number;
  ranksGained: number;
  kind: "gain" | "loss" | "neutral";
}

export interface LeverageDisplay {
  element: number;
  webName: string;
  pos: Pos;
  minutesRemaining: number;
  goal: number;
  assist: number;
  cleanSheet: number;
  defcon: number;
  expected: number;
  exposure: number;
}

export interface FixtureRailRow {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeShort: string;
  awayShort: string;
  homeScore: number | null;
  awayScore: number | null;
  minute: number;
  state: "pre" | "live" | "done";
  yourPlayers: number;
  /** ISO kickoff, so a fixture yet to start can say when. */
  kickoff: string | null;
}

export interface MatchdayModel {
  generatedAt: number;
  phase: GwPhase;
  /** `id` is the gameweek being viewed; `latest` is the live one, so a
   *  historical view knows what it can navigate back to. */
  event: { id: number; name: string; deadlineTime: string; latest: number };
  entry: { id: number; name: string };
  hero: {
    gwPoints: number;
    officialEventPoints: number | null;
    officialLiveRank: number | null;
    estimatedLiveRank: number | null;
    confidence: "high" | "medium" | "low" | "none";
    rankDeltaSinceLastPoll: number | null;
    playersPlayed: number;
    playersToPlay: number;
    captainPoints: number;
    benchPoints: number;
    chip: string | null;
    transfersCost: number;
  };
  squad: SquadRow[];
  subs: { out: number; in: number }[];
  swings: SwingRow[];
  swingSummary: { reconciled: boolean; scale: number | null; residual: number; observedDelta: number | null };
  leverage: { yours: LeverageDisplay[]; threats: LeverageDisplay[]; eoSource: "estimated" | "cohort"; cohortSampleSize?: number };
  multiverse: { results: BranchResult[]; regretIndex: number; reliefIndex: number };
  fixturesRail: FixtureRailRow[];
  rankContext: {
    fieldAvg: number;
    fieldSd: number;
    sampleSize: number;
    ranksPerPoint: number;
    curveAvailable: boolean;
  };
  lastUpdatedLabel: string;
  upstreamDegraded?: boolean;
}

const MAX_SWINGS = 30;
const MAX_LEVERAGE_ROWS = 12;

export function composeMatchdayModel(deps: {
  eventId: number;
  entry: Entry;
  picks: PicksResponse;
  boot: BootstrapLite;
  live: Live;
  fixtures: Fixture[];
  /** Season fixture list — the xGC fixture model's input (falls back to fixtures). */
  allFixtures?: Fixture[];
  status: EventStatus;
  phase: GwPhase;
  addedDays: Set<string>;
  bundle: { curve: RankCurve | null; fieldAvg: number; fieldSd: number; sampleSize: number };
  rawEvents: RawEvent[];
  transfersThisGw: Transfer[];
  previousSnapshot?: { officialLiveRank: number | null; estRank: number | null } | null;
  /** Sampled cohort EO — when present it replaces the estimated prior everywhere. */
  cohortEo?: { cohort: string; sampleSize: number; eo: Map<number, number> } | null;
}): { model: MatchdayModel; snapshot: { officialLiveRank: number | null; estRank: number | null } } {
  const { entry, picks, boot, live, fixtures, phase, addedDays, bundle, rawEvents, transfersThisGw } = deps;

  const squadState: LiveSquad = buildLiveSquad({
    picks,
    live,
    fixtures,
    boot,
    bonusAddedDays: addedDays,
  });

  const scoring = parseScoring(boot.scoring);
  const mostCaptained = boot.events.find((e) => e.id === deps.eventId)?.most_captained ?? null;
  const teamById = new Map(boot.teams.map((t) => [t.id, t]));
  // Fixture model for the per-face xGC — team expected goals conceded this GW.
  const fxModel = buildFixtureModel(deps.allFixtures?.length ? deps.allFixtures : fixtures, {
    upToGw: deps.eventId,
  });

  // EO: sampled cohort when available, estimated prior otherwise.
  const eoOf = (elementId: number): number => {
    if (deps.cohortEo) {
      const v = deps.cohortEo.eo.get(elementId);
      if (v !== undefined) return v;
    }
    const meta = boot.elements[elementId];
    if (!meta) return 0;
    return fallbackEO({
      selectedByPercent: meta.selected_by_percent,
      pos: meta.element_type,
      mostCaptainedId: mostCaptained,
      elementId,
    });
  };

  const squadRows: SquadRow[] = picks.picks.map((p) => {
    const player = squadState.players.get(p.element);
    const meta = boot.elements[p.element];
    const subbedIn = squadState.subs.find((s) => s.in === p.element);
    const team = meta ? teamById.get(meta.team) : undefined;
    const teamFixtures = meta
      ? fixtures.filter((f) => f.team_h === meta.team || f.team_a === meta.team)
      : [];
    const fx = teamFixtures[0];
    const oppId = fx ? (fx.team_h === meta?.team ? fx.team_a : fx.team_h) : null;
    const isHome = fx ? fx.team_h === meta?.team : true;
    let state: SquadRow["fixtureState"] = "pre";
    if (fx) {
      if (fx.finished_provisional || fx.finished) state = "done";
      else if (fx.started) state = "live";
    }
    return {
      element: p.element,
      webName: meta?.web_name ?? `#${p.element}`,
      pos: (meta?.element_type ?? 4) as Pos,
      teamShort: team?.short_name ?? "",
      teamCode: meta?.team_code ?? 0,
      multiplier: squadState.multipliers.get(p.element) ?? p.multiplier,
      isCaptain: p.is_captain,
      isVice: p.is_vice_captain,
      onBench: p.position >= 12 && !subbedIn,
      minutes: player?.minutes ?? 0,
      livePoints: player?.livePoints ?? 0,
      provisionalBonus: player?.provisionalBonus ?? 0,
      bonus: player?.bonus ?? 0,
      bonusOfficial: player?.bonusOfficial ?? false,
      defconCount: player?.defcon.count ?? 0,
      defconThreshold: player?.defcon.threshold ?? 99,
      fixtureId: fx?.id ?? null,
      opponentShort: oppId ? `${isHome ? "" : "@"}${teamById.get(oppId)?.short_name ?? ""}` : "—",
      fixtureState: state,
      fixtureMinute: fx?.minutes ?? 0,
      subbedInFor: subbedIn ? subbedIn.out : null,
      teamId: meta?.team ?? 0,
      eo: round1(eoOf(p.element)),
      photo: meta?.photo ?? "",
      xg90: meta?.xg90 ?? null,
      xgc90:
        meta && fx && oppId
          ? Math.round(projectFixture(fxModel, meta.team, oppId, isHome).xgAgainst * 100) / 100
          : null,
      liveStats: player?.stats ?? null,
    };
  });

  const yourTotalPre = entry.summary_overall_points ?? 0;
  const totalNow = yourTotalPre + squadState.gwPoints;

  const xiElements = picks.picks.filter((p) => p.position <= 11).map((p) => p.element);
  const playedCount = xiElements.filter((el) => squadState.players.get(el)?.played).length;
  const toPlayCount = xiElements.filter((el) => {
    const pl = squadState.players.get(el);
    return pl ? !pl.fixturesFinished && pl.minutes === 0 : true;
  }).length;

  const captainEl = squadState.captainId;
  const captainPoints =
    (squadState.players.get(captainEl)?.livePoints ?? 0) *
    (squadState.chip === "3xc" ? 3 : squadState.multipliers.get(captainEl) === 2 ? 2 : 1);

  let estimatedRank: number | null = null;
  let confidence: MatchdayModel["hero"]["confidence"] = "none";
  if (bundle.curve) {
    const lr = computeLiveRank({
      curve: bundle.curve,
      yourPreTotal: yourTotalPre,
      yourLiveGwScore: squadState.gwPoints,
      fieldLiveAverage: bundle.fieldAvg,
      fieldLiveSd: Math.max(1, bundle.fieldSd),
      minutesRemainingFraction: remainingFraction(fixtures),
    });
    estimatedRank = lr.rank;
    confidence = lr.confidence;
  }

  const officialLiveRank = entry.summary_overall_rank ?? null;
  const officialEventPoints = entry.summary_event_points ?? null;

  let rankDelta: number | null = null;
  if (deps.previousSnapshot) {
    const prev = deps.previousSnapshot.officialLiveRank ?? deps.previousSnapshot.estRank;
    const cur = officialLiveRank ?? estimatedRank;
    if (prev !== null && cur !== null) rankDelta = prev - cur;
  }

  // Swing feed
  const rppAtScore = bundle.curve ? ranksPerPoint(bundle.curve, totalNow) : 1000;
  const multOf = (elementId: number): number => squadState.multipliers.get(elementId) ?? 0;
  const swingRowsRaw = rawEvents
    .filter((e) => e.identifier !== "bps")
    .map((e) =>
      swingForEvent(e, eventPoints(e.identifier), (multOf(e.element) ?? 0) as 0 | 1 | 2 | 3, eoOf(e.element), rppAtScore),
    );

  let swingSummary = { reconciled: false, scale: null as number | null, residual: 0, observedDelta: rankDelta };
  let swingRows = swingRowsRaw;
  if (rankDelta !== null && swingRowsRaw.length > 0) {
    const rec = reconcile(swingRowsRaw, rankDelta);
    swingRows = rec.events;
    swingSummary = { reconciled: rec.scale !== undefined, scale: rec.scale ?? null, residual: rec.residual, observedDelta: rankDelta };
  }

  const swingDisplay: SwingRow[] = swingRows.slice(0, MAX_SWINGS).map((s) => ({
    id: s.id,
    minute: s.minute,
    element: s.element,
    webName: boot.elements[s.element]?.web_name ?? `#${s.element}`,
    identifier: s.identifier,
    points: s.points,
    eo: round1(s.eo),
    yourMultiplier: s.yourMultiplier,
    ranksGained: Math.round(s.ranksGained),
    kind: s.kind,
  }));

  // Leverage board — players with minutes remaining
  const relevantElements = new Set<number>([
    ...xiElements,
    ...live.elements
      .filter((el) => el.stats.minutes < 90)
      .sort((a, b) => b.stats.bps - a.stats.bps)
      .slice(0, 60)
      .map((el) => el.id),
  ]);

  const rows: LeverageRow[] = [];
  for (const el of relevantElements) {
    const meta = boot.elements[el];
    const player = squadState.players.get(el);
    if (!meta || !player) continue;
    if (player.fixturesFinished && player.minutes > 0) continue;
    const remaining = Math.max(0, 90 - player.minutes) * (player.fixtureIds.length > 0 ? 1 : 0);
    if (remaining <= 0) continue;
    const yourMult = (multOf(el) ?? 0) as 0 | 1 | 2 | 3;
    const row = leverageRow({
      element: el,
      pos: meta.element_type as Pos,
      yourMult,
      eo: eoOf(el),
      scoring,
      ranksPerPt: rppAtScore,
      minutesRemaining: remaining,
    });
    rows.push(row);
  }

  const toDisplay = (r: LeverageRow): LeverageDisplay => {
    const get = (o: string) => r.perOutcome.find((x) => x.outcome === o)?.ranks ?? 0;
    return {
      element: r.element,
      webName: boot.elements[r.element]?.web_name ?? `#${r.element}`,
      pos: boot.elements[r.element]?.element_type as Pos,
      minutesRemaining: Math.round(r.exposure > 0 ? 90 : 0),
      goal: Math.round(get("goal")),
      assist: Math.round(get("assist")),
      cleanSheet: Math.round(get("cleanSheet")),
      defcon: Math.round(get("defcon")),
      expected: Math.round(r.expected),
      exposure: Math.round(r.exposure * 100),
    };
  };

  const yours = rows.filter((r) => r.direction > 0).sort((a, b) => b.expected - a.expected).slice(0, MAX_LEVERAGE_ROWS).map(toDisplay);
  const threats = rows.filter((r) => r.direction <= 0).sort((a, b) => a.expected - b.expected).slice(0, MAX_LEVERAGE_ROWS).map(toDisplay);

  // Multiverse
  const altPoints = new Map<number, { points: number; pos: number }>();
  for (const t of transfersThisGw) {
    const soldLive = squadState.players.get(t.element_out);
    altPoints.set(t.element_out, {
      points: soldLive?.livePoints ?? boot.elements[t.element_out]?.ep_next ?? 0,
      pos: boot.elements[t.element_out]?.element_type ?? 4,
    });
  }
  for (const b of squadState.bench) {
    const pts = squadState.players.get(b.element)?.livePoints ?? 0;
    altPoints.set(b.element, {
      points: pts,
      pos: boot.elements[b.element]?.element_type ?? 4,
    });
  }

  const branches: Branch[] = [
    ...squadState.finalXI.filter((p) => p.element !== squadState.captainId).map((p) => ({ kind: "captain", alt: p.element }) as Branch),
    ...squadState.bench.flatMap((b) => {
      const benchPos = boot.elements[b.element]?.element_type;
      const candidates = squadState.finalXI.filter(
        (s) => boot.elements[s.element]?.element_type === benchPos && s.element !== squadState.captainId,
      );
      const target = candidates.sort(
        (x, y) => (squadState.players.get(x.element)?.livePoints ?? 0) - (squadState.players.get(y.element)?.livePoints ?? 0),
      )[0];
      return target ? [{ kind: "bench", out: target.element, in: b.element } as Branch] : [];
    }),
    ...(picks.entry_history.event_transfers_cost > 0 ? [{ kind: "roll" } as Branch] : []),
  ];

  const multiverseResults = runMultiverse(
    {
      finalXI: squadState.finalXI.map((p) => ({
        element: p.element,
        pos: (boot.elements[p.element]?.element_type ?? 4) as number,
        multiplier: squadState.multipliers.get(p.element) ?? 1,
      })),
      captainId: squadState.captainId,
      chip: squadState.chip,
      benchElementIds: squadState.bench.map((b) => b.element),
      livePointsByElement: new Map([...squadState.players].map(([id, p]) => [id, p.livePoints])),
      transfersCost: picks.entry_history.event_transfers_cost,
    },
    {
      curve: bundle.curve ?? emptyCurve(),
      preTotal: yourTotalPre,
      fieldAvg: bundle.fieldAvg,
      altPoints,
    },
    branches,
  ).map((r) => ({ ...r, label: labelBranch(r.branch, boot) }));

  const rr = regretRelief(multiverseResults);

  // Fixtures rail
  const rail: FixtureRailRow[] = fixtures.map((f) => {
    const countYours = picks.picks.filter((p) => {
      const meta = boot.elements[p.element];
      return meta && (meta.team === f.team_h || meta.team === f.team_a);
    }).length;
    const state: FixtureRailRow["state"] = f.finished_provisional || f.finished ? "done" : f.started ? "live" : "pre";
    return {
      id: f.id,
      homeTeamId: f.team_h,
      awayTeamId: f.team_a,
      homeShort: teamById.get(f.team_h)?.short_name ?? "?",
      awayShort: teamById.get(f.team_a)?.short_name ?? "?",
      homeScore: f.team_h_score,
      awayScore: f.team_a_score,
      minute: f.minutes,
      state,
      yourPlayers: countYours,
      kickoff: f.kickoff_time ?? null,
    };
  });

  const model: MatchdayModel = {
    generatedAt: Date.now(),
    phase,
    event: {
      id: deps.eventId,
      name: boot.events.find((e) => e.id === deps.eventId)?.name ?? `GW${deps.eventId}`,
      deadlineTime: boot.events.find((e) => e.id === deps.eventId)?.deadline_time ?? "",
      latest: boot.events.find((e) => e.is_current)?.id ?? deps.eventId,
    },
    entry: { id: entry.id, name: entry.name },
    hero: {
      gwPoints: squadState.gwPoints,
      officialEventPoints,
      officialLiveRank,
      estimatedLiveRank: estimatedRank,
      confidence,
      rankDeltaSinceLastPoll: rankDelta,
      playersPlayed: playedCount,
      playersToPlay: Math.max(0, toPlayCount),
      captainPoints,
      benchPoints: squadState.benchPoints,
      chip: squadState.chip,
      transfersCost: picks.entry_history.event_transfers_cost,
    },
    squad: squadRows,
    subs: squadState.subs,
    swings: swingDisplay,
    swingSummary,
    leverage: {
      yours,
      threats,
      eoSource: deps.cohortEo ? "cohort" : "estimated",
      ...(deps.cohortEo ? { cohortSampleSize: deps.cohortEo.sampleSize } : {}),
    },
    multiverse: { results: multiverseResults.slice(0, 8), regretIndex: rr.regretIndex, reliefIndex: rr.reliefIndex },
    fixturesRail: rail,
    rankContext: {
      fieldAvg: bundle.fieldAvg,
      fieldSd: bundle.fieldSd,
      sampleSize: bundle.sampleSize,
      ranksPerPoint: Math.round(rppAtScore),
      curveAvailable: Boolean(bundle.curve),
    },
    lastUpdatedLabel: new Date().toISOString(),
  };

  const snapshotOut = { officialLiveRank, estRank: estimatedRank };
  return { model, snapshot: snapshotOut };
}

function remainingFraction(fixtures: Fixture[]): number {
  const inPlay = fixtures.filter((f) => f.started);
  if (!inPlay.length) return 1;
  const remaining = inPlay.reduce((s, f) => s + Math.max(0, 90 - Math.min(f.minutes, 90)), 0);
  return remaining / (inPlay.length * 90);
}

function emptyCurve(): RankCurve {
  return {
    points: [
      { rank: 1, total: 100 },
      { rank: 1_000_000, total: 40 },
    ],
    population: 2,
  };
}

function labelBranch(b: Branch, boot: BootstrapLite): string {
  const name = (el: number) => boot.elements[el]?.web_name ?? `#${el}`;
  switch (b.kind) {
    case "captain":
      return `Captaining ${name(b.alt)} instead`;
    case "bench":
      return `Benching ${name(b.out)} before ${name(b.in)}`;
    case "transfer": {
      const r0 = b.reverse[0];
      return r0 ? `Keeping ${name(r0.out)} over ${name(r0.in)}` : "Reversing transfers";
    }
    case "chip":
      return b.without === "bboost" ? "Playing Bench Boost" : b.without === "3xc" ? "Playing Triple Captain" : "Playing the chip";
    case "roll":
      return "Rolling the transfer instead";
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
