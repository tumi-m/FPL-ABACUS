/**
 * Fixed entity → slot registry. Colour follows the ENTITY, never its rank.
 * Slots must be assigned in order for adjacent-pair safety; never cycled.
 */
export const SLOT_VAR: Record<number, string> = {
  1: "var(--series-1)",
  2: "var(--series-2)",
  3: "var(--series-3)",
  4: "var(--series-4)",
  5: "var(--series-5)",
  6: "var(--series-6)",
  7: "var(--series-7)",
  8: "var(--series-8)",
};

export const ENTITY_SLOT = {
  top10k: 1,
  league: 2,
  you: 3,
  field: 4,
  top100k: 5,
  top1k: 6,
  rival: 7,
  template: 8,
} as const;

export type EntityKey = keyof typeof ENTITY_SLOT;

export function entityColor(entity: EntityKey): string {
  return SLOT_VAR[ENTITY_SLOT[entity]];
}

export interface Series {
  id: string;
  name: string;
  entity: EntityKey;
  data: { x: number; y: number }[];
}
