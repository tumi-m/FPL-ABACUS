import { sigilGlyphs, type SigilSwing } from "@/lib/generative/specs";

const TONE: Record<string, string> = {
  surge: "var(--surge)",
  flare: "var(--flare)",
  line: "var(--line-hi)",
};

/**
 * The Gameweek Sigil (v10 E1) — one gameweek's swing sequence as a glyph.
 *
 * Stroke angle = the minute it fell, length = the swing's share of the
 * week's biggest move, colour = direction; your own events draw heavier.
 * Deterministic from mulberry32(entryId + gw) so the same input renders
 * byte-identical twice — the share rule §8 is why it is SVG rather than
 * canvas: pure vector, no hydration cost, and the OG route renders the
 * exact same geometry server-side.
 */
export function GameweekSigil({
  seed,
  swings,
  size = 220,
  label,
}: {
  seed: number;
  swings: SigilSwing[];
  size?: number;
  label?: string;
}) {
  const glyphs = sigilGlyphs(seed, swings);
  const c = 110;
  const r0 = 34;
  const rMax = 92;

  return (
    <svg
      role="img"
      aria-label={
        label ??
        "Gameweek sigil — one stroke per scoring event, angle by minute, length by rank swing"
      }
      viewBox="0 0 220 220"
      width={size}
      height={size}
    >
      {/* the minute dial — 12 o'clock is kickoff, one full sweep is the match */}
      <circle cx={c} cy={c} r={r0} fill="none" stroke="var(--line)" strokeWidth="1" />
      <circle cx={c} cy={c} r={rMax} fill="none" stroke="var(--line-hi)" strokeWidth="1" strokeDasharray="2 6" />
      {glyphs.length === 0 && (
        <text
          x={c}
          y={c + 4}
          textAnchor="middle"
          fill="var(--ink-lo)"
          fontSize="11"
          fontStyle="italic"
        >
          no swings yet
        </text>
      )}
      {glyphs.map((g, i) => {
        const x1 = c + Math.cos(g.angle) * r0;
        const y1 = c + Math.sin(g.angle) * r0;
        const r1 = r0 + (rMax - r0) * g.reach;
        const x2 = c + Math.cos(g.angle) * r1;
        const y2 = c + Math.sin(g.angle) * r1;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={TONE[g.tone] ?? TONE.line}
            strokeWidth={g.yours ? 4 : 2}
            strokeLinecap="round"
            opacity={g.yours ? 0.95 : 0.45}
          />
        );
      })}
      {/* kickoff tick at 12 o'clock so the dial reads as a clock, not a star */}
      <line x1={c} y1={c - r0} x2={c} y2={c - rMax} stroke="var(--line-hi)" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}