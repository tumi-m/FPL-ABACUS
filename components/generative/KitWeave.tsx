import { kitWeaveBands } from "@/lib/generative/specs";

/**
 * Kit weave (v2 §8) — decorative background of diagonal club-colour bands for
 * /squad and /dna. Chrome, not data: sits behind content at low opacity and
 * never encodes meaning.
 */
export function KitWeave({ teamIds, className }: { teamIds: number[]; className?: string }) {
  const bands = kitWeaveBands(teamIds);
  const total = bands.reduce((s, b) => s + b.width + 4, 0);
  const stops = bands
    .map((b) => `${b.colorVar} ${b.width}px, transparent ${b.width}px transparent ${b.width + 4}px`)
    .join(", ");

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}>
      <div
        className="absolute inset-[-40%]"
        style={{
          opacity: 0.14,
          transform: "rotate(24deg)",
          backgroundImage: `repeating-linear-gradient(90deg, ${stops})`,
          backgroundSize: `${total}px 100%`,
        }}
      />
    </div>
  );
}
