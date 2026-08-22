/**
 * Generative visuals (v2 §8) — every visual is DETERMINISTIC: same entry id,
 * same gameweek data, byte-identical output. mulberry32 drives all layout
 * randomness so server and client agree without shipping state.
 */
import { mulberry32 } from "@/lib/engines/simulate";

export interface GwRecord {
  event: number;
  points: number;
  overallRank: number | null;
  chip: string | null;
}

export interface FingerprintStroke {
  /** Angle around the ring, radians. */
  angle: number;
  /** 0..1 normalised severity (rank swing magnitude). */
  magnitude: number;
  /** Stroke length multiplier 0..1 from gameweek points. */
  length: number;
  /** Token name for the stroke colour — surge gains, flare drops, line base. */
  tone: "surge" | "flare" | "line";
}

/**
 * Season fingerprint — one spoke per gameweek played. Rank swings give the
 * magnitude, points give length; chips get a full-length volt-adjacent mark.
 */
export function fingerprintStrokes(
  seed: number,
  records: GwRecord[],
  totalPlayers = 10_000_000,
): FingerprintStroke[] {
  if (!records.length) return [];
  const rng = mulberry32(seed);
  const ranks = records.map((r) => r.overallRank ?? null);
  const sortedRanks = [...ranks.filter((r): r is number => r != null)].sort((a, b) => b - a);
  const worst = sortedRanks[0] ?? totalPlayers;

  return records.map((r, i) => {
    const prev = i > 0 ? ranks[i - 1] : null;
    let tone: FingerprintStroke["tone"] = "line";
    if (prev != null && r.overallRank != null && r.overallRank < prev) tone = "surge";
    else if (prev != null && r.overallRank != null && r.overallRank > prev) tone = "flare";

    // Jitter keeps adjacent identical weeks visually distinct but stable.
    const jitter = rng() * 0.06;
    const magnitude =
      r.overallRank == null ? jitter : Math.min(1, Math.log10(1 + r.overallRank / worst * 9) / 1 + jitter);

    return {
      angle: (i / Math.max(1, records.length)) * Math.PI * 2 - Math.PI / 2 + (rng() - 0.5) * 0.02,
      magnitude,
      length: Math.max(0.15, Math.min(1, r.points / 100)),
      tone: r.chip ? "surge" : tone,
    };
  });
}

export interface SigilSpec {
  petals: number;
  petalLength: number[];
  rotationStep: number;
  ringDashes: number[];
  coreRadius: number;
}

/** Gameweek sigil — deterministic mandolin of petals + dashed rings. */
export function sigilSpec(seed: number): SigilSpec {
  const rng = mulberry32(seed);
  const petals = 6 + Math.floor(rng() * 7);
  return {
    petals,
    petalLength: Array.from({ length: petals }, () => 0.55 + rng() * 0.45),
    rotationStep: (rng() * Math.PI) / petals,
    ringDashes: Array.from({ length: 3 }, () => 4 + Math.floor(rng() * 14)),
    coreRadius: 0.18 + rng() * 0.12,
  };
}

/**
 * Kit weave — decorative background bands keyed to club identity tokens.
 * Always paired with codes when rendered near data (style guide §8).
 */
export function kitWeaveBands(teamIds: number[]): { colorVar: string; width: number }[] {
  if (!teamIds.length) {
    return [
      { colorVar: "var(--line)", width: 6 },
      { colorVar: "var(--line-hi)", width: 2 },
    ];
  }
  const rng = mulberry32(teamIds.reduce((s, t) => s + t * 2654435761, 0));
  return teamIds.map((t) => ({
    colorVar: `var(--club-${clubKey(t)})`,
    width: 3 + Math.round(rng() * 9),
  }));
}

/** FPL team id (1–20) → the token key used in globals.css. */
export function clubKey(teamId: number): string {
  const KEYS = [
    "ars", "avl", "bou", "bre", "bha", "che", "cov", "cry", "eve", "ful",
    "hul", "ips", "lee", "liv", "mci", "mun", "new", "nfo", "tot", "sun",
  ];
  return KEYS[((teamId - 1) % KEYS.length + KEYS.length) % KEYS.length];
}
