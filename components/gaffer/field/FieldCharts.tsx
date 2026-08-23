"use client";

import { ChartFrame } from "@/components/charts/ChartFrame";
import { POSITION_SHORT } from "@/lib/ui/format";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

type SquadRow = MatchdayModel["squad"][number];

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

/**
 * Four companion charts under the pitch — every figure derived from the
 * matchday model, never estimated prose. Flat marks, upright names, values in
 * italic Saira via fig-num where they headline.
 */

/** Where the score comes from — live points split by position (XI only). */
export function PositionContribution({ rows }: { rows: SquadRow[] }) {
  const W = 560;
  const H = 190;
  const M = { top: 14, right: 52, bottom: 8, left: 44 };

  const xi = rows.filter((r) => !r.onBench);
  const byPos = [1, 2, 3, 4].map((pos) => ({
    pos,
    label: POSITION_SHORT[pos],
    pts: xi.filter((r) => r.pos === pos).reduce((s, r) => s + r.livePoints, 0),
  }));
  const max = Math.max(1, ...byPos.map((p) => p.pts));
  const bw = (H - M.top - M.bottom) / byPos.length;
  const barH = Math.min(26, bw * 0.62);

  const table = {
    headers: ["Position", "Live points"],
    rows: byPos.map((p) => [p.label, p.pts]),
  };

  return (
    <ChartFrame
      eyebrow="Contribution"
      title="Points by position"
      ariaLabel="Your gameweek points split by position"
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {byPos.map((p, i) => {
          const y = M.top + i * bw + (bw - barH) / 2;
          const w = ((W - M.left - M.right) * p.pts) / max;
          return (
            <g key={p.pos}>
              <text x={M.left - 10} y={y + barH / 2 + 4} textAnchor="end" fontSize="11" className="fill-(--ink-mid)">
                {p.label}
              </text>
              <rect x={M.left} y={y} width={Math.max(2, w)} height={barH} rx="3" fill={SERIES[i]} stroke="var(--bg-raised)" strokeWidth="2">
                <title>{`${p.label}: ${p.pts} pts`}</title>
              </rect>
              <text
                x={M.left + Math.max(2, w) + 8} y={y + barH / 2 + 4}
                fontSize="12" fontWeight="800" className="fill-(--ink-hi)"
                style={{ fontVariationSettings: '"wdth" 110' }}
              >
                {p.pts}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

/** The bonus race — top BPS runners in your squad right now. */
export function BpsLeaders({ rows, limit = 5 }: { rows: SquadRow[]; limit?: number }) {
  const W = 560;
  const H = 210;
  const M = { top: 14, right: 48, bottom: 8, left: 96 };

  const leaders = [...rows]
    .filter((r) => r.bps > 0)
    .sort((a, b) => b.bps - a.bps)
    .slice(0, limit);
  const max = Math.max(1, ...leaders.map((r) => r.bps));
  const rowH = (H - M.top - M.bottom) / Math.max(1, leaders.length);
  const barH = Math.min(22, rowH * 0.6);

  if (leaders.length === 0) {
    return (
      <ChartFrame eyebrow="Bonus race" title="BPS leaders" ariaLabel="Top bonus point system scores in your squad">
        <p className="py-8 text-center text-sm text-ink-lo">No BPS yet — check back once matches kick off.</p>
      </ChartFrame>
    );
  }

  const table = {
    headers: ["Player", "BPS"],
    rows: leaders.map((r) => [`${r.webName}${r.isCaptain ? " (C)" : ""}`, r.bps]),
  };

  return (
    <ChartFrame
      eyebrow="Bonus race"
      title="BPS leaders — your squad"
      ariaLabel="Top bonus point system scores in your squad"
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {leaders.map((r, i) => {
          const y = M.top + i * rowH + (rowH - barH) / 2;
          const w = ((W - M.left - M.right) * r.bps) / max;
          return (
            <g key={r.element}>
              <text x={M.left - 10} y={y + barH / 2 + 4} textAnchor="end" fontSize="11" className="fill-(--ink-hi)">
                {r.webName}
                {r.isCaptain && <tspan className="fill-(--volt)" fontWeight={800}> C</tspan>}
              </text>
              <rect x={M.left} y={y} width={Math.max(2, w)} height={barH} rx="3" fill={r.isCaptain ? "var(--volt)" : "var(--series-1)"} opacity={r.isCaptain ? 1 : 0.85} stroke="var(--bg-raised)" strokeWidth="2">
                <title>{`${r.webName}: ${r.bps} BPS`}</title>
              </rect>
              <text
                x={M.left + Math.max(2, w) + 8} y={y + barH / 2 + 4}
                fontSize="12" fontWeight="800" className="fill-(--ink-hi)"
                style={{ fontVariationSettings: '"wdth" 110' }}
              >
                {r.bps}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

/** Availability — how much of your XI has played, is playing, or waits. */
export function Availability({ rows }: { rows: SquadRow[] }) {
  const W = 560;
  const H = 120;
  const M = { top: 16, right: 20, bottom: 30, left: 20 };

  const xi = rows.filter((r) => !r.onBench);
  const segs = [
    { key: "done", label: "Finished", n: xi.filter((r) => r.fixtureState === "done").length, color: "var(--seq-250)" },
    { key: "live", label: "In play", n: xi.filter((r) => r.fixtureState === "live").length, color: "var(--volt)" },
    { key: "pre", label: "Yet to play", n: xi.filter((r) => r.fixtureState === "pre").length, color: "var(--line-hi)" },
  ];
  const total = xi.length || 1;

  const table = {
    headers: ["State", "Players"],
    rows: segs.map((s) => [s.label, s.n]),
  };

  let acc = 0;
  return (
    <ChartFrame
      eyebrow="Availability"
      title="Where your XI stands"
      ariaLabel="How many of your starting eleven have finished, are playing, or are yet to play"
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {segs.map((s) => {
          const x0 = M.left + ((W - M.left - M.right) * acc) / total;
          const w = ((W - M.left - M.right) * s.n) / total;
          acc += s.n;
          return (
            <g key={s.key}>
              <rect x={x0} y={M.top} width={Math.max(0, w - 2)} height={34} rx="3" fill={s.color}>
                <title>{`${s.label}: ${s.n}`}</title>
              </rect>
              {s.n > 0 && (
                <text x={x0 + w / 2} y={M.top + 22} textAnchor="middle" fontSize="13" fontWeight="800" fill={s.key === "pre" ? "var(--ink-mid)" : "#fff"} style={{ fontVariationSettings: '"wdth" 110' }}>
                  {s.n}
                </text>
              )}
            </g>
          );
        })}
        {segs.map((s, i) => {
          const third = (W - M.left - M.right) / 3;
          return (
            <g key={`l${s.key}`}>
              <rect x={M.left + i * third} y={H - 18} width={10} height={10} rx="2" fill={s.color} />
              <text x={M.left + i * third + 15} y={H - 9} fontSize="10" className="fill-(--ink-lo)">
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

/** Captain dependency — what share of the gameweek rides on one man. */
export function CaptainShare({ rows }: { rows: SquadRow[] }) {
  const W = 560;
  const H = 110;
  const M = { top: 18, right: 24, bottom: 26, left: 24 };

  const xi = rows.filter((r) => !r.onBench);
  const cap = xi.find((r) => r.isCaptain && r.multiplier >= 2);
  const total = xi.reduce((s, r) => s + r.livePoints, 0);
  const capPts = cap ? cap.livePoints * cap.multiplier : 0;
  const share = total > 0 ? Math.round((capPts / total) * 100) : 0;

  const table = {
    headers: ["Captain", "Captain pts", "XI pts", "Share"],
    rows: [[cap?.webName ?? "—", capPts, total, `${share}%`]],
  };

  return (
    <ChartFrame
      eyebrow="Dependency"
      title={cap ? `${cap.webName} carries ${share}% of your score` : "No active captain"}
      ariaLabel="Captain share of your gameweek points"
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        <rect x={M.left} y={M.top + 14} width={W - M.left - M.right} height={28} rx="4" fill="var(--surface-3)" />
        <rect x={M.left} y={M.top + 14} width={Math.max(2, ((W - M.left - M.right) * share) / 100)} height={28} rx="4" fill="var(--volt)">
          <title>{`${cap?.webName ?? "captain"}: ${capPts} of ${total} pts (${share}%)`}</title>
        </rect>
        <text
          x={M.left + Math.max(2, ((W - M.left - M.right) * share) / 100) - 10}
          y={M.top + 34}
          textAnchor="end" fontSize="14" fontWeight="800" className="fill-(--on-accent)"
          style={{ fontVariationSettings: '"wdth" 110' }}
        >
          {share}%
        </text>
        <text x={M.left} y={H - 6} fontSize="10" className="fill-(--ink-lo)">
          Captain points as a share of your starting XI&apos;s live score — higher means more single-point risk.
        </text>
      </svg>
    </ChartFrame>
  );
}
