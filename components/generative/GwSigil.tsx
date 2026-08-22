import { sigilSpec } from "@/lib/generative/specs";

/**
 * Gameweek sigil (v2 §8) — deterministic SVG mark for a gameweek; server-
 * rendered so it works as the /film cover and OG art. Pure vector: no canvas,
 * no hydration cost, identical output from the same seed.
 */
export function GwSigil({
  seed,
  size = 220,
  label,
}: {
  seed: number;
  size?: number;
  label?: string;
}) {
  const spec = sigilSpec(seed);
  const c = 110; // viewBox centre
  const rMax = 96;

  return (
    <svg
      role="img"
      aria-label={label ?? "Deterministic gameweek sigil"}
      viewBox="0 0 220 220"
      width={size}
      height={size}
    >
      {/* dashed rings */}
      {spec.ringDashes.map((dash, i) => (
        <circle
          key={i}
          cx={c}
          cy={c}
          r={rMax * (0.55 + i * 0.15)}
          fill="none"
          stroke="var(--line-hi)"
          strokeWidth="1"
          strokeDasharray={`${dash} ${dash * 1.6}`}
        />
      ))}

      {/* petals */}
      <g transform={`rotate(${(spec.rotationStep * 180) / Math.PI} ${c} ${c})`}>
        {Array.from({ length: spec.petals }, (_, i) => {
          const a = (i / spec.petals) * Math.PI * 2 - Math.PI / 2;
          const len = rMax * spec.petalLength[i];
          const x2 = c + Math.cos(a) * len;
          const y2 = c + Math.sin(a) * len;
          const cx = c + Math.cos(a + Math.PI / spec.petals) * len * 0.32;
          const cy = c + Math.sin(a + Math.PI / spec.petals) * len * 0.32;
          return (
            <path
              key={i}
              d={`M ${c} ${c} Q ${cx} ${cy} ${x2} ${y2}`}
              fill="none"
              stroke="var(--volt)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity={i % 2 === 0 ? 0.9 : 0.45}
            />
          );
        })}
      </g>

      {/* core */}
      <circle cx={c} cy={c} r={rMax * spec.coreRadius} fill="var(--bg-raised)" stroke="var(--ice)" strokeWidth="1.5" />
    </svg>
  );
}
