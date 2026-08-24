import { notFound } from "next/navigation";
import { RankCurve } from "@/components/charts/RankCurve";
import { SwingBars } from "@/components/charts/SwingBars";
import { Sparkline } from "@/components/charts/Sparkline";
import { DistributionCurve } from "@/components/charts/DistributionCurve";
import { HeatGrid } from "@/components/charts/HeatGrid";
import { Meter, BulletBar } from "@/components/charts/Meter";
import { ProbabilityBand } from "@/components/charts/ProbabilityBand";
import { EOScatter } from "@/components/charts/EOScatter";
import { PointsWaterfall } from "@/components/charts/PointsWaterfall";
import { DefconRate } from "@/components/charts/DefconRate";
import { PriceGauge } from "@/components/charts/PriceGauge";
import { OwnershipFlow } from "@/components/charts/OwnershipFlow";
import { FixtureSwing } from "@/components/charts/FixtureSwing";
import { XgVsActual } from "@/components/charts/XgVsActual";
import { ChipTimeline } from "@/components/charts/ChipTimeline";

export const metadata = { title: "Chart gallery", robots: { index: false, follow: false } };

const curveSeries = [
  {
    id: "you",
    name: "You",
    entity: "you" as const,
    data: [1, 2, 3, 4, 5].map((gw) => ({ x: gw, y: [412318, 380112, 512004, 298441, 241930][gw - 1] })),
  },
  {
    id: "top10k",
    name: "Top 10k average",
    entity: "top10k" as const,
    data: [1, 2, 3, 4, 5].map((gw) => ({ x: gw, y: [9000000, 120000, 45000, 21000, 14000][gw - 1] })),
  },
];

export default function ChartGallery() {
  if (process.env.NODE_ENV === "production" && process.env.GAFFER_DEV_CHARTS !== "1") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Chart gallery</h1>
      <RankCurve
        series={curveSeries}
        table={{
          headers: ["GW", "You", "Top 10k"],
          rows: [1, 2, 3, 4, 5].map((gw) => [
            gw,
            (curveSeries[0].data[gw - 1].y as number).toLocaleString(),
            (curveSeries[1].data[gw - 1].y as number).toLocaleString(),
          ]),
        }}
      />
      <SwingBars
        ariaLabel="Diverging bar chart of rank impact per scoring event"
        rows={[
          { label: "78' Saka assist", detail: "you own (C)", value: 86400 },
          { label: "66' Gabriel bonus", value: -18200 },
          { label: "45' Haaland goal", detail: "field owns", value: -96400 },
          { label: "12' Clean sheet", value: 55100 },
          { label: "90' Palmer blank", value: 14100 },
        ]}
      />
      <div className="flex items-center gap-6 rounded-lg bg-surface-1 card-ring p-4">
        <Sparkline values={[52, 61, 44, 71, 58, 66]} ariaLabel="Points trend sparkline" />
        <Sparkline values={[30, 35, 40, 38, 52, 60]} ariaLabel="Rank trend sparkline" />
      </div>
      <DistributionCurve
        bins={Array.from({ length: 40 }, (_, i) => ({
          x: 20 + i * 2,
          y: Math.round(1000 * Math.exp(-0.5 * ((20 + i * 2 - 58) / 14) ** 2)),
        }))}
        yourScore={62}
        ariaLabel="Area chart of field score distribution with your score marked"
      />
      <HeatGrid
        ariaLabel="Fixture difficulty heat grid"
        rows={["ARS", "LIV", "MCI"].map((team) => ({
          label: team,
          cells: Array.from({ length: 6 }, (_, i) => ({
            value: ((i + team.length) % 5) + 1,
            text: String(((i + team.length) % 5) + 1),
          })),
        }))}
      />
      <div className="grid gap-6 rounded-lg bg-surface-1 card-ring p-5 md:grid-cols-2">
        <Meter value={0.72} label="DEFCON" hint="7.2 / 10" />
        <Meter value={0.31} label="Price pressure" hint="68k / 220k" tone="warning" />
        <BulletBar value={62} target={55} band={[42, 70]} max={100} label="GW points vs cohort" />
        <BulletBar value={18} target={50} band={[30, 65]} max={100} label="Template overlap %" />
      </div>
      <ProbabilityBand
        points={[1, 2, 3, 4, 5, 6].map((gw) => ({
          x: gw,
          p5: 1_500_000 * Math.pow(0.72, gw),
          p50: 900_000 * Math.pow(0.7, gw),
          p95: 300_000 * Math.pow(0.66, gw),
        }))}
        ariaLabel="Fan chart of projected overall rank with confidence band"
      />
      <EOScatter rows={squadFixture()} />
      <PointsWaterfall rows={squadFixture()} />
      <DefconRate
        matches={["EVE", "MUN", "TOT", "CHE", "NEW"].map((t, i) => ({ label: t, defcon: [12, 14, 8, 11, 6][i] }))}
        playerName="Gabriel"
      />
      <PriceGauge
        playerName="Mbeumo"
        netTransfers={186_400}
        riseProbability={0.62}
        velocity24h={[4, 9, 7, 12, 18, 24, 21, 28]}
      />
      <OwnershipFlow
        days={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}
        clubs={[
          { club: "LIV", colorVar: "var(--club-liv)", values: [12, 18, 25, 31, 38, 46] },
          { club: "ARS", colorVar: "var(--club-ars)", values: [9, 12, 17, 20, 27, 31] },
          { club: "NFO", colorVar: "var(--club-nfo)", values: [4, 6, 11, 14, 16, 22] },
        ]}
      />
      <FixtureSwing
        playerName="Isak"
        leagueMean={1.35}
        points={[
          { gw: 24, xgc: 1.82 },
          { gw: 25, xgc: 1.66 },
          { gw: 26, xgc: 1.21 },
          { gw: 27, xgc: 0.94 },
          { gw: 28, xgc: 1.05 },
          { gw: 29, xgc: 0.78 },
        ]}
      />
      <XgVsActual
        playerName="Palmer"
        points={[1, 2, 3, 4, 5, 6, 7, 8].map((gw) => ({
          gw,
          xgi: Math.round((gw * 0.92 + Math.sin(gw) * 0.3) * 100) / 100,
          actual: Math.round((gw * 0.74 + Math.cos(gw * 1.7) * 0.5) * 100) / 100,
        }))}
      />
      <ChipTimeline
        plays={[
          { manager: "You", gw: 24, kind: "fh" },
          { manager: "You", gw: 29, kind: "wc2" },
          { manager: "Rival A", gw: 25, kind: "bb" },
          { manager: "Rival A", gw: 32, kind: "wc2" },
          { manager: "Rival B", gw: 24, kind: "wc1" },
          { manager: "Rival B", gw: 36, kind: "bb" },
          { manager: "Rival C", gw: 29, kind: "mb" },
          { manager: "Rival C", gw: 33, kind: "fh" },
        ]}
        gwRange={[23, 38]}
      />
    </div>
  );
}

/** Complete SquadRow fixtures so engine-fed charts render standalone in the gallery. */
function squadFixture() {
  const names = [
    { webName: "Salah", pos: 3 as const, teamId: 11, eo: 84, pts: 16 },
    { webName: "Haaland", pos: 4 as const, teamId: 13, eo: 72, pts: 12 },
    { webName: "Saka", pos: 3 as const, teamId: 1, eo: 41, pts: 9 },
    { webName: "Gabriel", pos: 2 as const, teamId: 1, eo: 30, pts: 8 },
    { webName: "Palmer", pos: 3 as const, teamId: 6, eo: 22, pts: 2 },
  ];
  return names.map((n, i) => ({
    element: i + 1,
    webName: n.webName,
    pos: n.pos,
    teamShort: "XXX",
    teamCode: n.teamId,
    multiplier: i === 0 ? 2 : 1,
    isCaptain: i === 0,
    isVice: i === 1,
    onBench: false,
    minutes: 90,
    livePoints: n.pts,
    provisionalBonus: 0,
    bonus: 2,
    bonusOfficial: false,
    defconCount: 0,
    defconThreshold: 10,
    fixtureId: null,
    opponentShort: "—",
    fixtureState: "done" as const,
    fixtureMinute: 90,
    subbedInFor: null,
    teamId: n.teamId,
    eo: n.eo,
    xg90: null,
    xgc90: null,
    photo: "",
    liveStats: null,
  }));
}
