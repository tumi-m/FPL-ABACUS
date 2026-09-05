"use client";

import { ChartFrame } from "@/components/charts/ChartFrame";
import { Est } from "@/components/gaffer/Est";
import type { UnderstandingData } from "@/lib/server/buildUnderstanding";

/**
 * The season-understanding board (v10 D1) — three engines, one screen.
 *
 * The Ledger's bars sum to what the decisions explain (Shapley's efficiency
 * guarantee), the luck channels price the season against the chances, and
 * the ribbons draw the Kalman mean with its ±1.96√P band — the shape that
 * says "this is form, this is noise" without a word. Every interval carries
 * its method via <Est>.
 */

const fmt = (v: number) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1));

const SHAPLEY_METHOD =
  "Shapley values by Monte Carlo permutation sampling over the season's settled weeks — 400 orderings, fixed seed. Efficiency-guaranteed: the bars sum to the total attributed.";

const LUCK_METHOD = {
  finishing:
    "Σ(goals − xG) · the position's goal value from FPL's live scoring config, captaincy included. Positive is finishing above the chances — which regresses.",
  creation:
    "Σ(assists − xA) · the assist value, captaincy included. The chances being made against the ones converted.",
  field:
    "Your weekly score against the sampled field average, summed over the weeks read. Not variance — just where you stand.",
} as const;

const FORM_METHOD =
  "Kalman local-level filter over per-90 expected involvement, cameos discounted by minutes; absences widen the band.";

/** The Ledger — diverging bars, Shapley attribution over decision kinds. */
export function UnderstandingLedger({ ledger }: { ledger: UnderstandingData["ledger"] }) {
  const span = Math.max(1, ...ledger.lines.map((l) => Math.abs(l.value)));
  const mid = 250;
  const half = 230;
  const W = mid + half + 20;
  const rowH = 30;
  const H = ledger.lines.length * rowH + 52;

  return (
    <ChartFrame
      eyebrow="Shapley · Monte Carlo"
      title="The Ledger — what each decision was worth"
      ariaLabel="Shapley attribution of your season across the kinds of decisions you took"
      caption="Right of the line paid you points; left cost you. The bars sum to the total attributed — that is the sampler's guarantee, not a rounding promise."
      table={{
        headers: ["Decision", "Points", "±SE"],
        rows: ledger.lines.map((l) => [l.key, fmt(l.value), l.se.toFixed(2)]),
      }}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {ledger.lines.map((l, i) => {
          const y = 10 + i * rowH;
          const w = (half * Math.abs(l.value)) / span;
          const isGain = l.value >= 0;
          return (
            <g key={l.key}>
              <text x={mid - 12} y={y + 15} textAnchor="end" fontSize="11" className="fill-(--ink-mid)">
                {l.key}
              </text>
              <rect
                x={isGain ? mid : mid - w}
                y={y + 4}
                width={Math.max(2, w)}
                height={16}
                rx="3"
                fill={isGain ? "var(--surge)" : "var(--flare)"}
              >
                <title>{`${l.key}: ${fmt(l.value)} points (SE ±${l.se.toFixed(2)})`}</title>
              </rect>
              <text
                x={isGain ? mid + Math.max(2, w) + 6 : mid - Math.max(2, w) - 6}
                y={y + 16}
                textAnchor={isGain ? "start" : "end"}
                fontSize="10"
                className="fill-(--ink-lo)"
              >
                {fmt(l.value)}
              </text>
            </g>
          );
        })}
        <line x1={mid} y1={6} x2={mid} y2={H - 26} stroke="var(--axis)" strokeWidth="1" />
        <text x={mid - 12} y={H - 8} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">
          cost you
        </text>
        <text x={mid + 8} y={H - 8} fontSize="10" className="fill-(--ink-lo)">
          paid you
        </text>
      </svg>
      <p className="mt-2 text-2xs text-ink-lo">
        Total attributed <Est method={SHAPLEY_METHOD}>{fmt(ledger.total)}</Est> points across{" "}
        {ledger.orderings.toLocaleString("en-GB")} orderings. The fifteen&apos;s raw
        points are the spine the decisions sit on top of.
      </p>
    </ChartFrame>
  );
}

/** Process vs outcome — the season's luck channels as diverging bars. */
export function SeasonLuck({ luck }: { luck: UnderstandingData["luck"] }) {
  const channels = [
    { key: "Finishing", v: luck.finishingLuck, method: LUCK_METHOD.finishing },
    { key: "Creation", v: luck.creationLuck, method: LUCK_METHOD.creation },
    { key: "Versus field", v: luck.fieldLuck, method: LUCK_METHOD.field },
  ];
  const span = Math.max(1, ...channels.map((c) => Math.abs(c.v)));
  const mid = 250;
  const half = 200;
  const W = mid + half + 60;
  const rowH = 34;
  const H = channels.length * rowH + 44;

  return (
    <ChartFrame
      eyebrow="Luck"
      title="Process vs outcome — the season's channels"
      ariaLabel="Season luck channels: finishing, creation and score against the field"
      caption="Finishing reverts toward the chances over a season; the field channel does not — it is just where you stand."
      table={{
        headers: ["Channel", "Points"],
        rows: channels.map((c) => [c.key, fmt(c.v)]),
      }}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={mid} y1={8} x2={mid} y2={H - 26} stroke="var(--axis)" strokeWidth="1" />
        {channels.map((c, i) => {
          const y = 10 + i * rowH;
          const w = (half * Math.abs(c.v)) / span;
          const good = c.v >= 0;
          return (
            <g key={c.key}>
              <text x={mid - 12} y={y + 17} textAnchor="end" fontSize="11" className="fill-(--ink-mid)">
                {c.key}
              </text>
              <rect
                x={good ? mid : mid - w}
                y={y + 5}
                width={Math.max(2, w)}
                height={18}
                rx="3"
                fill={good ? "var(--surge)" : "var(--flare)"}
                opacity={0.9}
              >
                <title>{`${c.key}: ${fmt(c.v)} pts`}</title>
              </rect>
              <text
                x={good ? mid + Math.max(2, w) + 6 : mid - Math.max(2, w) - 6}
                y={y + 18}
                textAnchor={good ? "start" : "end"}
                fontSize="11"
                fontWeight="800"
                className="fill-(--ink-hi)"
              >
                {fmt(c.v)}
              </text>
            </g>
          );
        })}
        <text x={mid - 12} y={H - 8} textAnchor="end" fontSize="10" className="fill-(--ink-lo)">
          against you
        </text>
        <text x={mid + 8} y={H - 8} fontSize="10" className="fill-(--ink-lo)">
          your way
        </text>
      </svg>
      {luck.advice.length > 0 && (
        <ul className="mt-2 space-y-1">
          {luck.advice.map((a) => (
            <li key={a} className="text-2xs leading-relaxed text-ink-mid">
              {a}
            </li>
          ))}
        </ul>
      )}
    </ChartFrame>
  );
}

/** One player's true-form ribbon — Kalman mean with the ±1.96√P band. */
export function FormRibbon({
  ribbon,
}: {
  ribbon: UnderstandingData["ribbons"][number];
}) {
  const W = 560;
  const H = 150;
  const M = { top: 14, right: 14, bottom: 24, left: 36 };
  const rounds = ribbon.points.map((p) => p.round);
  const x0 = rounds[0] ?? 1;
  const x1 = rounds[rounds.length - 1] ?? x0;
  const x = (r: number) => M.left + ((W - M.left - M.right) * (r - x0)) / Math.max(1, x1 - x0);
  const lo = Math.min(...ribbon.points.map((p) => p.ability - 1.96 * p.sd), 0);
  const hi = Math.max(...ribbon.points.map((p) => p.ability + 1.96 * p.sd));
  const pad = Math.max(0.05, (hi - lo) * 0.12);
  const y = (v: number) =>
    H - M.bottom - ((v - (lo - pad)) / (hi + pad - (lo - pad))) * (H - M.top - M.bottom);

  const bandTop = ribbon.points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.round).toFixed(1)},${y(p.ability + 1.96 * p.sd).toFixed(1)}`)
    .join(" ");
  const bandBack = [...ribbon.points]
    .reverse()
    .map((p) => `L${x(p.round).toFixed(1)},${y(p.ability - 1.96 * p.sd).toFixed(1)}`)
    .join(" ");
  const mean = ribbon.points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.round).toFixed(1)},${y(p.ability).toFixed(1)}`)
    .join(" ");

  return (
    <ChartFrame
      eyebrow="True form"
      title={`${ribbon.name} — form against noise`}
      ariaLabel={`Kalman-filtered expected involvement per 90 for ${ribbon.name} with uncertainty band`}
      caption="The band is ±1.96 standard deviations. Where it is wide, the season says little; where it is tight, the level is real."
      table={{
        headers: ["GW", "Level", "±Band"],
        rows: ribbon.points.map((p) => [p.round, p.ability.toFixed(2), `±${(1.96 * p.sd).toFixed(2)}`]),
      }}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        <path d={`${bandTop} ${bandBack} Z`} fill="var(--seq-250)" opacity={0.55} />
        <path d={mean} fill="none" stroke="var(--series-1)" strokeWidth="2" />
        {ribbon.points.map((p) => (
          <circle
            key={p.round}
            cx={x(p.round)}
            cy={y(p.ability)}
            r={2.5 + 3.5 * Math.min(1, p.sd / 0.5)}
            fill="var(--series-1)"
            opacity={0.85}
          >
            <title>{`GW${p.round}: level ${p.ability.toFixed(2)} ±${(1.96 * p.sd).toFixed(2)}`}</title>
          </circle>
        ))}
        <text x={M.left - 6} y={M.top + 4} fontSize="9" textAnchor="end" className="fill-(--ink-lo)">
          {hi.toFixed(1)}
        </text>
        <text x={M.left - 6} y={H - M.bottom} fontSize="9" textAnchor="end" className="fill-(--ink-lo)">
          {Math.max(0, lo - pad).toFixed(1)}
        </text>
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" className="fill-(--ink-lo)">
          Gameweek — expected involvement per 90
        </text>
      </svg>
      <p className="mt-2 text-2xs text-ink-lo">
        Now: <Est method={FORM_METHOD}>{`${ribbon.current.ability.toFixed(2)} ±${(1.96 * ribbon.current.sd).toFixed(2)}`}</Est>
      </p>
    </ChartFrame>
  );
}