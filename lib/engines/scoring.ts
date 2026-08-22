import type { Pos, ScoringConfig } from "@/lib/engines/types";
import { DEFCON_THRESHOLD } from "@/lib/engines/types";

const POS_BY_KEY = { GKP: 1, DEF: 2, MID: 3, FWD: 4 } as const;

type PerPosRaw = { GKP?: number; DEF?: number; MID?: number; FWD?: number };

function perPos(raw: unknown, fallback: Record<number, number>): Record<Pos, number> {
  const src = (raw ?? {}) as PerPosRaw;
  const out = {} as Record<Pos, number>;
  for (const [key, pos] of Object.entries(POS_BY_KEY)) {
    const v = src[key as keyof PerPosRaw];
    out[pos] = typeof v === "number" ? v : (fallback[pos] ?? 0);
  }
  return out;
}

/**
 * Parses bootstrap.game_config.scoring. Throws when the API stops exposing
 * scoring — we must never silently fall back to hardcoded point values.
 */
export function parseScoring(gameConfig: unknown): ScoringConfig {
  const cfg = gameConfig as { scoring?: Record<string, unknown> } | null;
  const s = cfg?.scoring;
  if (!s) throw new Error("game_config.scoring missing from bootstrap — cannot derive scoring");

  const num = (k: string, required = true): number => {
    const v = s[k];
    if (typeof v === "number") return v;
    if (required) throw new Error(`scoring.${k} missing or not numeric`);
    return 0;
  };

  return {
    goals: perPos(s.goals_scored, {}),
    cleanSheet: perPos(s.clean_sheets, {}),
    concededPer2: perPos(s.goals_conceded, {}),
    defconPoints: perPos(s.defensive_contribution, { 1: 0, 2: 0, 3: 0, 4: 0 }),
    assist: num("assists"),
    savesPer3: num("saves"),
    penSave: num("penalties_saved"),
    penMiss: num("penalties_missed"),
    yellow: num("yellow_cards"),
    red: num("red_cards"),
    ownGoal: num("own_goals"),
    minutesShort: num("short_play"),
    minutesLong: num("long_play"),
  };
}

export function pointsForOutcome(
  outcome: "goal" | "assist" | "cleanSheet" | "defcon",
  pos: Pos,
  scoring: ScoringConfig,
): number {
  switch (outcome) {
    case "goal":
      return scoring.goals[pos];
    case "assist":
      return scoring.assist;
    case "cleanSheet":
      return scoring.cleanSheet[pos];
    case "defcon":
      return scoring.defconPoints[pos];
  }
}

export { DEFCON_THRESHOLD };
