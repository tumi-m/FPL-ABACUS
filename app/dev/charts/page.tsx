import { notFound } from "next/navigation";
import { RankCurve } from "@/components/charts/RankCurve";
import { SwingBars } from "@/components/charts/SwingBars";
import { Sparkline } from "@/components/charts/Sparkline";
import { DistributionCurve } from "@/components/charts/DistributionCurve";
import { HeatGrid } from "@/components/charts/HeatGrid";
import { Meter, BulletBar } from "@/components/charts/Meter";
import { ProbabilityBand } from "@/components/charts/ProbabilityBand";

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
    </div>
  );
}
