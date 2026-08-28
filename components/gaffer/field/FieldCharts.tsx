"use client";

import { ChartFrame } from "@/components/charts/ChartFrame";
import { POSITION_SHORT } from "@/lib/ui/format";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";

type SquadRow = MatchdayModel["squad"][number];

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

/**
 * Head-to-head colouring.
 *
 * The pitch has already taught these two: a differential bar under a token is
 * volt when only you own him and ultra when only they do. Every chart in
 * compare mode uses the same pair, so "the blue one is me" is learned once and
 * holds everywhere rather than being re-guessed per chart.
 */
const YOU = "var(--volt)";
const THEM = "var(--ultra)";

/** The rival's squad, when the Field is in compare mode. */
export interface RivalSeries {
  name: string;
  rows: SquadRow[];
}

/** Who is who, drawn once and reused — the same two swatches in every chart. */
function VsKey({ x, y, name }: { x: number; y: number; name: string }) {
  return (
    <g>
      <rect x={x} y={y} width={9} height={9} rx="2" fill={YOU} />
      <text x={x + 13} y={y + 8} fontSize="10" className="fill-(--ink-lo)">
        You
      </text>
      <rect x={x + 46} y={y} width={9} height={9} rx="2" fill={THEM} />
      <text x={x + 59} y={y + 8} fontSize="10" className="fill-(--ink-lo)">
        {name}
      </text>
    </g>
  );
}

/** Long team names wreck a chart title; the chart still has to name them. */
function shortName(name: string, max = 18): string {
  return name.length <= max ? name : `${name.slice(0, max - 1).trimEnd()}\u2026`;
}

/**
 * What a player actually put on your scoreboard.
 *
 * `livePoints` is the raw player score; FPL multiplies it by the pick
 * multiplier (0 bench, 1 starter, 2 captain, 3 triple captain) and the sum of
 * those products is your gameweek total before the transfer cost. Charts that
 * ignored the multiplier were quietly dropping the captain's second helping.
 */
export function contribution(r: SquadRow): number {
  return r.livePoints * r.multiplier;
}

/** Rows that count toward the score — starters plus any auto-sub already in. */
export function counting(rows: SquadRow[]): SquadRow[] {
  return rows.filter((r) => r.multiplier > 0);
}

/**
 * Four companion charts under the pitch — every figure derived from the
 * matchday model, never estimated prose. Flat marks, upright names, values in
 * italic Saira via fig-num where they headline.
 */

/**
 * Where the score comes from — live points split by position (XI only).
 *
 * In compare mode it becomes the same question asked of two squads: not "how
 * many did my midfield get" but "did my midfield beat theirs", which is the
 * only version of the question that decides anything in a league.
 */
export function PositionContribution({ rows, rival }: { rows: SquadRow[]; rival?: RivalSeries }) {
  const W = 560;
  const M = { top: 14, right: 52, bottom: 8, left: 44 };

  // The counting side of the squad, captain multiplier included — otherwise
  // these bars do not add up to the score they claim to explain.
  const split = (source: SquadRow[]) =>
    [1, 2, 3, 4].map((pos) => ({
      pos,
      label: POSITION_SHORT[pos],
      pts: counting(source)
        .filter((r) => r.pos === pos)
        .reduce((sum, r) => sum + contribution(r), 0),
    }));

  const mine = split(rows);
  const theirs = rival ? split(rival.rows) : null;
  const scored = mine.reduce((sum, p) => sum + p.pts, 0);
  const theirScored = theirs ? theirs.reduce((sum, p) => sum + p.pts, 0) : 0;

  // Two bars per position when there is a rival, so the block is taller and
  // the legend needs a strip of its own at the foot.
  const H = theirs ? 250 : 190;
  const legendH = theirs ? 20 : 0;
  const plot = H - M.top - M.bottom - legendH;
  const max = Math.max(1, ...mine.map((p) => p.pts), ...(theirs ?? []).map((p) => p.pts));
  const bw = plot / mine.length;
  const barH = theirs ? Math.min(15, bw * 0.34) : Math.min(26, bw * 0.62);
  const gap = theirs ? 3 : 0;

  const table = theirs
    ? {
        headers: ["Position", "You", rival!.name],
        rows: mine.map((p, i) => [p.label, p.pts, theirs[i].pts]),
      }
    : { headers: ["Position", "Live points"], rows: mine.map((p) => [p.label, p.pts]) };

  const bar = (pts: number) => ((W - M.left - M.right) * pts) / max;

  return (
    <ChartFrame
      eyebrow={theirs ? "Head to head" : "Contribution"}
      title={
        theirs
          ? `Points by position — you ${scored}, ${shortName(rival!.name)} ${theirScored}`
          : `Points by position — ${scored} on the board`
      }
      ariaLabel={
        theirs
          ? `Your gameweek points by position against ${rival!.name}, captain multiplier included`
          : "Your gameweek points split by position, captain multiplier included"
      }
      caption="Counts the captain's multiplier, so the bars add up to the gameweek score before any transfer cost."
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {mine.map((p, i) => {
          const mid = M.top + i * bw + bw / 2;
          const yMine = theirs ? mid - barH - gap / 2 : mid - barH / 2;
          const wMine = Math.max(2, bar(p.pts));
          const them = theirs?.[i];
          return (
            <g key={p.pos}>
              <text x={M.left - 10} y={mid + 4} textAnchor="end" fontSize="11" className="fill-(--ink-mid)">
                {p.label}
              </text>
              <rect
                x={M.left} y={yMine} width={wMine} height={barH} rx="3"
                fill={theirs ? YOU : SERIES[i]} stroke="var(--bg-raised)" strokeWidth="2"
              >
                <title>{`You — ${p.label}: ${p.pts} pts`}</title>
              </rect>
              <text
                x={M.left + wMine + 8} y={yMine + barH / 2 + 4}
                fontSize="12" fontWeight="800" className="fill-(--ink-hi)"
                style={{ fontVariationSettings: '"wdth" 110' }}
              >
                {p.pts}
              </text>
              {them && (
                <>
                  <rect
                    x={M.left} y={mid + gap / 2} width={Math.max(2, bar(them.pts))} height={barH} rx="3"
                    fill={THEM} stroke="var(--bg-raised)" strokeWidth="2"
                  >
                    <title>{`${rival!.name} — ${p.label}: ${them.pts} pts`}</title>
                  </rect>
                  <text
                    x={M.left + Math.max(2, bar(them.pts)) + 8} y={mid + gap / 2 + barH / 2 + 4}
                    fontSize="12" fontWeight="800" className="fill-(--ink-mid)"
                    style={{ fontVariationSettings: '"wdth" 110' }}
                  >
                    {them.pts}
                  </text>
                </>
              )}
            </g>
          );
        })}
        {theirs && <VsKey x={M.left} y={H - 14} name={shortName(rival!.name, 22)} />}
      </svg>
    </ChartFrame>
  );
}

/**
 * The bonus board — who's actually on for the 1·2·3, not the BPS noise.
 *
 * With a rival it stops being "my bonus" and becomes one board over both
 * squads, each name coloured by who is collecting it. Bonus is where a
 * gameweek quietly turns, and a name in the wrong colour near the top is the
 * clearest possible statement of that; a player you BOTH own is neutral,
 * because he pays you both and settles nothing.
 */
export function BonusLeaders({
  rows,
  rival,
  limit = 5,
}: {
  rows: SquadRow[];
  rival?: RivalSeries;
  limit?: number;
}) {
  const W = 560;
  const M = { top: 14, right: 48, bottom: 8, left: 96 };

  const mineOwn = new Set(rows.map((r) => r.element));
  const theirOwn = new Set((rival?.rows ?? []).map((r) => r.element));
  // One entry per player across both squads: the same man cannot appear twice
  // on a board that is about who is collecting what.
  const pool = new Map<number, SquadRow>();
  for (const r of [...rows, ...(rival?.rows ?? [])]) if (!pool.has(r.element)) pool.set(r.element, r);

  const leaders = [...pool.values()]
    .filter((r) => r.bonus > 0 || (r.liveStats?.bps ?? 0) > 0)
    .sort((a, b) => b.bonus - a.bonus || (b.liveStats?.bps ?? 0) - (a.liveStats?.bps ?? 0))
    .slice(0, limit);
  const anyBonus = leaders.some((r) => r.bonus > 0);
  const max = Math.max(1, ...leaders.map((r) => r.bonus));
  const H = rival ? 244 : 210;
  const legendH = rival ? 20 : 0;
  const rowH = (H - M.top - M.bottom - legendH) / Math.max(1, leaders.length);
  const barH = Math.min(22, rowH * 0.6);

  const side = (r: SquadRow): "you" | "them" | "both" => {
    const you = mineOwn.has(r.element);
    const them = theirOwn.has(r.element);
    return you && them ? "both" : you ? "you" : "them";
  };
  const fillFor = (r: SquadRow): string => {
    if (!rival) return "var(--bonus)";
    const which = side(r);
    return which === "you" ? YOU : which === "them" ? THEM : "var(--line-hi)";
  };

  if (leaders.length === 0 || !anyBonus) {
    return (
      <ChartFrame
        eyebrow={rival ? "Head to head" : "Bonus"}
        title="Bonus leaders"
        ariaLabel={rival ? `Bonus points across your squad and ${rival.name}` : "Bonus points in your squad"}
      >
        <p className="py-8 text-center text-sm text-ink-lo">
          No bonus yet — the 1·2·3 settle from the 20th minute.
        </p>
      </ChartFrame>
    );
  }

  const table = rival
    ? {
        headers: ["Player", "Bonus", "Collected by"],
        rows: leaders
          .filter((r) => r.bonus > 0)
          .map((r) => [
            r.webName,
            r.bonus,
            side(r) === "both" ? "both of you" : side(r) === "you" ? "you" : rival.name,
          ]),
      }
    : {
        headers: ["Player", "Bonus"],
        rows: leaders.filter((r) => r.bonus > 0).map((r) => [`${r.webName}${r.isCaptain ? " (C)" : ""}`, r.bonus]),
      };

  return (
    <ChartFrame
      eyebrow={rival ? "Head to head" : "Bonus"}
      title={rival ? "Bonus leaders — both squads" : "Bonus leaders — your squad"}
      ariaLabel={
        rival
          ? `Bonus points awarded or projected across your squad and ${rival.name}`
          : "Bonus points awarded or projected in your squad"
      }
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        {leaders.map((r, i) => {
          const y = M.top + i * rowH + (rowH - barH) / 2;
          const w = ((W - M.left - M.right) * r.bonus) / max;
          const which = side(r);
          return (
            <g key={r.element}>
              <text x={M.left - 10} y={y + barH / 2 + 4} textAnchor="end" fontSize="11" className="fill-(--ink-hi)">
                {r.webName}
                {r.isCaptain && <tspan className="fill-(--volt)" fontWeight={800}> C</tspan>}
              </text>
              <rect
                x={M.left} y={y} width={Math.max(2, w)} height={barH} rx="3"
                fill={fillFor(r)} opacity={r.bonusOfficial ? 1 : 0.75}
                stroke="var(--bg-raised)" strokeWidth="2"
              >
                <title>
                  {`${r.webName}: ${r.bonus} bonus${r.bonusOfficial ? "" : " (projected)"}` +
                    (rival
                      ? which === "both"
                        ? " — you both own him"
                        : which === "you"
                          ? " — only you own him"
                          : ` — only ${rival.name} owns him`
                      : "")}
                </title>
              </rect>
              <text
                x={M.left + Math.max(2, w) + 8} y={y + barH / 2 + 4}
                fontSize="12" fontWeight="800" className="fill-(--ink-hi)"
                style={{ fontVariationSettings: '"wdth" 110' }}
              >
                {r.bonus > 0 ? r.bonus : "—"}
              </text>
            </g>
          );
        })}
        {rival ? (
          <g>
            <VsKey x={M.left} y={H - 32} name={shortName(rival.name, 18)} />
            <rect x={M.left + 150} y={H - 32} width={9} height={9} rx="2" fill="var(--line-hi)" />
            <text x={M.left + 163} y={H - 24} fontSize="10" className="fill-(--ink-lo)">
              both
            </text>
            <text x={M.left} y={H - 6} fontSize="10" className="fill-(--ink-lo)">
              Ties broken by BPS · dimmer bars are projected until FPL adds official bonus
            </text>
          </g>
        ) : (
          <text x={M.left} y={H - 2} fontSize="10" className="fill-(--ink-lo)">
            Ties broken by BPS · dimmer bars are projected until FPL adds official bonus
          </text>
        )}
      </svg>
    </ChartFrame>
  );
}

/**
 * Availability — how much of an XI has played, is playing, or waits.
 *
 * The comparative version answers the question that actually matters while a
 * gameweek is in flight: a lead is worth very different things depending on
 * who still has players to come, and a five-point cushion against a rival with
 * four men left is not a lead at all.
 */
export function Availability({ rows, rival }: { rows: SquadRow[]; rival?: RivalSeries }) {
  const W = 560;
  const M = { top: 16, right: 20, bottom: 30, left: 20 };

  const read = (source: SquadRow[]) => {
    const xi = source.filter((r) => !r.onBench);
    return [
      { key: "done", label: "Finished", n: xi.filter((r) => r.fixtureState === "done").length, color: "var(--seq-250)" },
      { key: "live", label: "In play", n: xi.filter((r) => r.fixtureState === "live").length, color: "var(--volt)" },
      { key: "pre", label: "Yet to play", n: xi.filter((r) => r.fixtureState === "pre").length, color: "var(--line-hi)" },
    ];
  };

  const mine = read(rows);
  const theirs = rival ? read(rival.rows) : null;
  const H = theirs ? 168 : 120;
  const trackW = W - M.left - M.right;
  const toPlay = (segs: { key: string; n: number }[]) => segs.find((seg) => seg.key === "pre")!.n;

  const table = theirs
    ? {
        headers: ["State", "You", rival!.name],
        rows: mine.map((seg, i) => [seg.label, seg.n, theirs[i].n]),
      }
    : { headers: ["State", "Players"], rows: mine.map((seg) => [seg.label, seg.n]) };

  const Bar = ({ segs, y, side }: { segs: ReturnType<typeof read>; y: number; side?: string }) => {
    const total = segs.reduce((sum, seg) => sum + seg.n, 0) || 1;
    let acc = 0;
    return (
      <g>
        {side && (
          <text x={M.left} y={y - 4} fontSize="10" className="fill-(--ink-lo)">
            {side}
          </text>
        )}
        {segs.map((seg) => {
          const x0 = M.left + (trackW * acc) / total;
          const w = (trackW * seg.n) / total;
          acc += seg.n;
          return (
            <g key={seg.key}>
              <rect x={x0} y={y} width={Math.max(0, w - 2)} height={30} rx="3" fill={seg.color}>
                <title>{`${side ?? "You"} — ${seg.label}: ${seg.n}`}</title>
              </rect>
              {seg.n > 0 && (
                <text
                  x={x0 + w / 2} y={y + 20} textAnchor="middle" fontSize="13" fontWeight="800"
                  fill={seg.key === "pre" ? "var(--ink-mid)" : "#fff"}
                  style={{ fontVariationSettings: '"wdth" 110' }}
                >
                  {seg.n}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <ChartFrame
      eyebrow={theirs ? "Head to head" : "Availability"}
      title={
        theirs
          ? `Left to play — you ${toPlay(mine)}, ${shortName(rival!.name)} ${toPlay(theirs)}`
          : "Where your XI stands"
      }
      ariaLabel={
        theirs
          ? `How many of each starting eleven have finished, are playing, or are yet to play, for you and ${rival!.name}`
          : "How many of your starting eleven have finished, are playing, or are yet to play"
      }
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        <Bar segs={mine} y={M.top + (theirs ? 12 : 0)} side={theirs ? "You" : undefined} />
        {theirs && <Bar segs={theirs} y={M.top + 74} side={shortName(rival!.name, 22)} />}
        {mine.map((seg, i) => {
          const third = trackW / 3;
          return (
            <g key={`l${seg.key}`}>
              <rect x={M.left + i * third} y={H - 18} width={10} height={10} rx="2" fill={seg.color} />
              <text x={M.left + i * third + 15} y={H - 9} fontSize="10" className="fill-(--ink-lo)">
                {seg.label}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

/**
 * Captain dependency — what share of the gameweek rides on one man.
 *
 * Against a rival this is usually the whole week: two managers with nearly the
 * same fifteen are separated by which of them they doubled. One bar each, both
 * named, so the armband comparison is the thing you see rather than something
 * you work out.
 */
export function CaptainShare({ rows, rival }: { rows: SquadRow[]; rival?: RivalSeries }) {
  const W = 560;
  const M = { top: 18, right: 24, bottom: 26, left: 24 };

  // Both sides of this fraction must count the multiplier. Dividing the
  // doubled captain by an undoubled squad total overstated every share.
  const read = (source: SquadRow[]) => {
    const xi = counting(source);
    const cap = xi.find((r) => r.isCaptain && r.multiplier >= 2);
    const total = xi.reduce((sum, r) => sum + contribution(r), 0);
    const capPts = cap ? contribution(cap) : 0;
    return { cap, total, capPts, share: total > 0 ? Math.round((capPts / total) * 100) : 0 };
  };

  const me = read(rows);
  const them = rival ? read(rival.rows) : null;
  const H = them ? 158 : 110;
  const trackW = W - M.left - M.right;

  const table = them
    ? {
        headers: ["Side", "Captain", "Captain pts", "Score", "Share"],
        rows: [
          ["You", me.cap?.webName ?? "\u2014", me.capPts, me.total, `${me.share}%`],
          [rival!.name, them.cap?.webName ?? "\u2014", them.capPts, them.total, `${them.share}%`],
        ],
      }
    : {
        headers: ["Captain", "Captain pts", "Score", "Share"],
        rows: [[me.cap?.webName ?? "\u2014", me.capPts, me.total, `${me.share}%`]],
      };

  const Row = ({
    y, side, name, share, capPts, total, fill,
  }: {
    y: number; side: string; name: string; share: number; capPts: number; total: number; fill: string;
  }) => (
    <g>
      <text x={M.left} y={y - 4} fontSize="10" className="fill-(--ink-lo)">
        {side} · {name}
      </text>
      <rect x={M.left} y={y} width={trackW} height={26} rx="4" fill="var(--surface-3)" />
      <rect x={M.left} y={y} width={Math.max(2, (trackW * share) / 100)} height={26} rx="4" fill={fill}>
        <title>{`${name}: ${capPts} of ${total} pts (${share}%)`}</title>
      </rect>
      <text
        x={M.left + Math.max(2, (trackW * share) / 100) - 10} y={y + 18}
        textAnchor="end" fontSize="13" fontWeight="800" className="fill-(--on-accent)"
        style={{ fontVariationSettings: '"wdth" 110' }}
      >
        {share}%
      </text>
    </g>
  );

  return (
    <ChartFrame
      eyebrow={them ? "Head to head" : "Dependency"}
      title={
        them
          ? me.cap && them.cap
            ? me.cap.element === them.cap.element
              ? `Same captain — ${me.cap.webName} for both of you`
              : `${me.cap.webName} against ${them.cap.webName}`
            : "Captain armbands"
          : me.cap
            ? `${me.cap.webName} carries ${me.share}% of your score`
            : "No active captain"
      }
      ariaLabel={
        them
          ? `Captain share of the gameweek for you and ${rival!.name}`
          : "Captain share of your gameweek points"
      }
      table={table}
    >
      <svg role="img" viewBox={`0 0 ${W} ${H}`} className="w-full">
        <Row
          y={M.top + 14} side="You" name={me.cap?.webName ?? "no captain"}
          share={me.share} capPts={me.capPts} total={me.total} fill={YOU}
        />
        {them && (
          <Row
            y={M.top + 76} side={shortName(rival!.name, 20)} name={them.cap?.webName ?? "no captain"}
            share={them.share} capPts={them.capPts} total={them.total} fill={THEM}
          />
        )}
        <text x={M.left} y={H - 6} fontSize="10" className="fill-(--ink-lo)">
          Captain points as a share of the starting XI&apos;s live score — higher means more single-point risk.
        </text>
      </svg>
    </ChartFrame>
  );
}
