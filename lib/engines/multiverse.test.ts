import { describe, expect, it } from "vitest";
import { regretRelief, runMultiverse } from "@/lib/engines/multiverse";
import { buildRankCurve } from "@/lib/engines/rankModel";
import type { Branch, MultiverseCtx } from "@/lib/engines/multiverse";

function curve() {
  return buildRankCurve(
    Array.from({ length: 50 }, (_, i) => ({ rank: Math.round(Math.pow(10, 3 + (i / 50) * 3)), total: 80 - i })),
  );
}

function ctx(): MultiverseCtx {
  return {
    curve: curve(),
    preTotal: 1000,
    fieldAvg: 55,
    altPoints: new Map([
      [301, { points: 20, pos: 2 }],
      [202, { points: 6, pos: 3 }],
    ]),
  };
}

function base() {
  return {
    finalXI: [
      { element: 101, pos: 4 as const, multiplier: 2 as const },
      { element: 102, pos: 3 as const, multiplier: 1 as const },
      { element: 103, pos: 2 as const, multiplier: 1 as const },
    ],
    captainId: 101,
    chip: null,
    livePointsByElement: new Map([
      [101, 12],
      [102, 5],
      [103, 2],
    ]),
    transfersCost: 4,
  };
}

describe("runMultiverse", () => {
  it("captain-swap arithmetic verified by hand", () => {
    // base: 12×2 + 5 + 2 − 4 = 27 ; alt: captain moves to 102 →
    // 12×1 + 5×2 + 2 − 4 = 20 (the old captain loses his ×2, new one gains ×1)
    const results = runMultiverse(base(), ctx(), [{ kind: "captain", alt: 102 }]);
    expect(results).toHaveLength(1);
    expect(results[0].pointsDelta).toBe(-7);
  });

  it("a better alternative yields positive ranksDelta", () => {
    // base: 12×2 + 5 + 2 − 4 = 27 ; bench-swap 103 (2) → 301 (20):
    // 24 + 5 + 20 − 4 = 45 → delta +18
    const results = runMultiverse(base(), ctx(), [{ kind: "bench", out: 103, in: 301 }]);
    expect(results[0].pointsDelta).toBe(18);
    expect(results[0].ranksDelta).toBeGreaterThanOrEqual(0);
  });

  it("skips branches that cannot apply", () => {
    const branches: Branch[] = [
      { kind: "captain", alt: 999 }, // not in XI
      { kind: "bench", out: 103, in: 301 }, // applies
      { kind: "chip", without: "bboost" }, // no chip active
    ];
    const results = runMultiverse(base(), ctx(), branches);
    expect(results).toHaveLength(1);
    expect(results[0].branch.kind).toBe("bench");
  });

  it("caps branch count at 40", () => {
    const many: Branch[] = Array.from({ length: 60 }, () => ({ kind: "captain", alt: 102 }));
    const results = runMultiverse(base(), ctx(), many);
    expect(results.length).toBeLessThanOrEqual(40);
  });

  it("roll refunds transfer cost", () => {
    const results = runMultiverse(base(), ctx(), [{ kind: "roll" }]);
    expect(results[0].pointsDelta).toBe(4);
  });
});

describe("regretRelief", () => {
  it("splits best/worst directions", () => {
    const r = regretRelief([
      { branch: { kind: "roll" }, label: "", pointsDelta: 1, ranksDelta: 500 },
      { branch: { kind: "bench", out: 1, in: 2 }, label: "", pointsDelta: -1, ranksDelta: -300 },
    ]);
    expect(r.regretIndex).toBe(500);
    expect(r.reliefIndex).toBe(300);
  });
});
