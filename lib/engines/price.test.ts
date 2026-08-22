import { describe, expect, it } from "vitest";
import { pressure } from "@/lib/engines/price";
import type { PriceSnapshot } from "@/lib/engines/price";

function snaps(netPerHour: number, hours: number, start = 0): PriceSnapshot[] {
  const out: PriceSnapshot[] = [];
  const t0 = new Date("2026-08-20T00:00:00Z").getTime();
  for (let i = 0; i < hours; i++) {
    out.push({ capturedAt: new Date(t0 + i * 3_600_000), transfersIn: start + i * netPerHour, transfersOut: start });
  }
  return out;
}

describe("price pressure", () => {
  it("is monotone in net transfers", () => {
    const low = pressure(snaps(10_000, 10), null);
    const high = pressure(snaps(40_000, 10), null);
    expect(high.pRise).toBeGreaterThanOrEqual(low.pRise);
    expect(high.progress).toBeGreaterThan(low.progress);
  });

  it("velocity gate suppresses pRise", () => {
    // Heavy cumulative pressure built two days ago; only a trickle today.
    const T = new Date("2026-08-20T02:00:00Z").getTime();
    const s: PriceSnapshot[] = [
      { capturedAt: new Date(T - 48 * 3_600_000), transfersIn: 0, transfersOut: 0 },
      { capturedAt: new Date(T - 24 * 3_600_000), transfersIn: 200_000, transfersOut: 0 },
      { capturedAt: new Date(T - 12 * 3_600_000), transfersIn: 205_000, transfersOut: 0 },
      { capturedAt: new Date(T), transfersIn: 210_000, transfersOut: 0 },
    ];
    const gated = pressure(s, null, { now: new Date(T) });
    expect(gated.velocityOk).toBe(false);
    expect(gated.pRise).toBeLessThan(0.95);
  });

  it("wildcard correction reduces net pressure", () => {
    const s = snaps(30_000, 8);
    const normal = pressure(s, null, { now: new Date(s[7].capturedAt) });
    const wild = pressure(s, null, { wildcardWindow: true, now: new Date(s[7].capturedAt) });
    expect(wild.net).toBeLessThan(normal.net);
  });

  it("returns zeros when there is not enough history", () => {
    const p = pressure([snaps(1000, 1)[0]], null);
    expect(p.net).toBe(0);
    expect(p.pRise).toBe(0);
  });
});
