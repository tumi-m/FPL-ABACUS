import { describe, expect, it } from "vitest";
import { leverageRow } from "@/lib/engines/leverage";
import { parseScoring } from "@/lib/engines/scoring";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Bootstrap } from "@/lib/fpl/schemas";

const boot = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "..", "..", "__fixtures__", "bootstrap.json"), "utf8"),
) as Bootstrap;
const scoring = parseScoring(boot.game_config);

describe("leverage", () => {
  const base = {
    element: 1,
    pos: 4 as const,
    scoring,
    ranksPerPt: 1000,
    minutesRemaining: 45,
    outcomeProbabilities: { goal: 0.2, assist: 0.15 },
  };

  it("owned player rows are positive on returns", () => {
    const row = leverageRow({ ...base, yourMult: 2, eo: 40 });
    const goal = row.perOutcome.find((o) => o.outcome === "goal");
    expect(goal?.ranks).toBeGreaterThan(0);
    expect(row.direction).toBe(1);
  });

  it("threat rows are negative for un-owned players the field owns", () => {
    const row = leverageRow({ ...base, yourMult: 0, eo: 60 });
    const goal = row.perOutcome.find((o) => o.outcome === "goal");
    expect(goal?.ranks).toBeLessThan(0);
    expect(row.direction).toBe(-1);
  });

  it("exposure falls to zero when minutes run out", () => {
    const row = leverageRow({ ...base, yourMult: 2, eo: 10, minutesRemaining: 0 });
    expect(row.exposure).toBe(0);
  });
});
