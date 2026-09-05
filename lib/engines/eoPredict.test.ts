import { describe, expect, it } from "vitest";
import {
  predictDeadlineEO,
  EO_PREDICT_METHOD,
  EO_NEWS_PP,
  EO_NEWS_CAP,
  type EoPredictInput,
} from "./eoPredict";
import type { PriceSnapshot } from "./price";

const H = 3_600_000;
const T0 = new Date("2026-09-01T12:00:00Z").getTime();

/** Hourly snapshots with a steady net flow per hour. */
function snaps(netPerHour: number, hours = 30, start = T0): PriceSnapshot[] {
  const out: PriceSnapshot[] = [];
  let net = 0;
  for (let i = 0; i < hours; i++) {
    net += netPerHour;
    out.push({
      capturedAt: new Date(start + i * H),
      transfersIn: 1_000_000 + Math.max(0, net),
      transfersOut: 1_000_000 + Math.max(0, -net),
    });
  }
  return out;
}

const base: EoPredictInput = {
  element: 1,
  ownedNow: 20,
  snapshots: snaps(2000),
  newsTags: 0,
  hoursToDeadline: 72,
  totalManagers: 11_000_000,
};

describe("predictDeadlineEO", () => {
  it("refuses with a stated reason when snapshots are too thin for velocity", () => {
    const r = predictDeadlineEO({ ...base, snapshots: snaps(2000, 1) });
    expect(r.covered).toBe(false);
    expect(r.predicted).toBe(20);
    expect(r.reason).toMatch(/snapshot/i);
  });

  it("a strong positive velocity raises the deadline figure", () => {
    const r = predictDeadlineEO(base);
    // 2000/hr × 24h = 48k/day × 3 days = 144k / 11M × 100 ≈ 1.3pp
    expect(r.covered).toBe(true);
    expect(r.predicted).toBeCloseTo(21.3, 1);
    expect(r.low).toBeLessThan(r.predicted);
    expect(r.high).toBeGreaterThan(r.predicted);
  });

  it("a strong negative velocity lowers it", () => {
    const r = predictDeadlineEO({ ...base, snapshots: snaps(-2000) });
    expect(r.predicted).toBeCloseTo(18.7, 1);
  });

  it("news tags add a capped bump", () => {
    const none = predictDeadlineEO(base);
    const some = predictDeadlineEO({ ...base, newsTags: 3 });
    // 1dp rounding either side — the bump is within a rounding step of exact.
    expect(Math.abs(some.predicted - none.predicted - 3 * EO_NEWS_PP)).toBeLessThan(0.06);
    const flood = predictDeadlineEO({ ...base, newsTags: 100 });
    expect(Math.abs(flood.predicted - none.predicted - EO_NEWS_CAP * EO_NEWS_PP)).toBeLessThan(0.06);
  });

  it("a longer horizon moves the figure further, and widens the band", () => {
    const near = predictDeadlineEO({ ...base, hoursToDeadline: 24 });
    const far = predictDeadlineEO({ ...base, hoursToDeadline: 120 });
    expect(far.predicted - base.ownedNow).toBeGreaterThan(near.predicted - base.ownedNow);
    expect(far.high - far.low).toBeGreaterThan(near.high - near.low);
  });

  it("a passed deadline predicts the published figure, with the base band", () => {
    const r = predictDeadlineEO({ ...base, hoursToDeadline: -5 });
    expect(r.predicted).toBe(20);
    expect(r.low).toBeLessThanOrEqual(20);
  });

  it("clamps to the 0–100 range a percentage lives in", () => {
    const top = predictDeadlineEO({ ...base, ownedNow: 99.9, snapshots: snaps(50_000), newsTags: 50 });
    expect(top.predicted).toBeLessThanOrEqual(100);
    const bottom = predictDeadlineEO({ ...base, ownedNow: 0.1, snapshots: snaps(-50_000) });
    expect(bottom.predicted).toBeGreaterThanOrEqual(0);
  });

  it("thin coverage is flagged with the reason, not silently plotted tight", () => {
    // Same trailing-day flow as the wide read, so only the thin extra moves.
    const r = predictDeadlineEO({ ...base, snapshots: snaps(24_000, 3) });
    expect(r.covered).toBe(true);
    expect(r.thin).toBe(true);
    expect(r.reason).toMatch(/snapshot/i);
    const wide = predictDeadlineEO(base);
    expect(r.high - r.low).toBeGreaterThan(wide.high - wide.low);
  });

  it("the method string states the model honestly", () => {
    expect(EO_PREDICT_METHOD).toMatch(/stated, not fitted/i);
  });
});