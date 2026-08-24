import { describe, expect, it } from "vitest";
import { pressure, rankTonight, velocitySeries } from "@/lib/engines/price";
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

describe("velocity series", () => {
  it("returns per-interval net deltas oldest first", () => {
    const s = snaps(10_000, 6);
    const series = velocitySeries(s, new Date(s[5].capturedAt));
    expect(series).toEqual([10_000, 10_000, 10_000, 10_000, 10_000]);
  });

  it("clips to the trailing 24h window", () => {
    const s = snaps(5_000, 30);
    const series = velocitySeries(s, new Date(s[29].capturedAt));
    expect(series.length).toBe(24);
  });

  it("is empty without at least two in-window samples", () => {
    expect(velocitySeries([snaps(1000, 1)[0]], new Date())).toEqual([]);
  });

  it("nets outflows against inflows", () => {
    const T = new Date("2026-08-20T00:00:00Z").getTime();
    const s: PriceSnapshot[] = [
      { capturedAt: new Date(T), transfersIn: 100_000, transfersOut: 40_000 },
      { capturedAt: new Date(T + 3_600_000), transfersIn: 130_000, transfersOut: 90_000 },
    ];
    expect(velocitySeries(s, new Date(T + 3_600_000))).toEqual([-20_000]);
  });
});

describe("tonight ranking", () => {
  it("orders by |p(rise)| and signs direction from net", () => {
    const rows = rankTonight([
      { element: 1, snapshots: snaps(1_000, 8), lastChangeAt: null }, // slow trickle
      { element: 2, snapshots: snaps(45_000, 8), lastChangeAt: null }, // heavy rise pressure
      { element: 3, snapshots: [], lastChangeAt: null }, // uncovered
    ]);
    expect(rows[0].element).toBe(2);
    expect(rows[0].direction).toBe("up");
    expect(rows[0].covered).toBe(true);
    // uncovered sorts last at zero rather than being dropped
    expect(rows[rows.length - 1]).toMatchObject({ element: 3, pRise: 0, covered: false });
  });

  it("flags falling players as direction down", () => {
    const T = new Date("2026-08-20T00:00:00Z").getTime();
    const s: PriceSnapshot[] = [];
    for (let i = 0; i < 8; i++) {
      s.push({ capturedAt: new Date(T + i * 3_600_000), transfersIn: 0, transfersOut: i * 30_000 });
    }
    const rows = rankTonight([{ element: 9, snapshots: s, lastChangeAt: null }]);
    expect(rows[0].direction).toBe("down");
    expect(rows[0].net).toBeLessThan(0);
  });
});
