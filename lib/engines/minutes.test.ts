import { describe, expect, it } from "vitest";
import {
  estimateMinutes,
  MIN_APPEARANCES,
  MINUTES_THIN_LABEL,
  type MinutesObservation,
} from "./minutes";

function obs(gw: number, minutes: number, started?: boolean): MinutesObservation {
  return { gw, minutes, started: started ?? minutes > 0 };
}

/** An ever-present: started everything, finished everything. */
const EVERPRESENT = [1, 2, 3, 4, 5, 6].map((gw) => obs(gw, 90));

/** A rotated squad player: start, sit, start, sit… */
const ROTATED = [1, 2, 3, 4, 5, 6, 7, 8].map((gw) =>
  gw % 2 === 1 ? obs(gw, 90) : obs(gw, 0, false),
);

/** A starter hooked early most weeks. */
const EARLY_HOOK = [1, 2, 3, 4, 5].map((gw) => obs(gw, gw <= 4 ? 52 : 90));

/** A new signing: two cameos off the bench. */
const NEW_SIGNING = [4, 5, 6].map((gw) => obs(gw, 25, false));

describe("estimateMinutes", () => {
  it("refuses below the minimum appearances, with the reason", () => {
    const thin = estimateMinutes([obs(1, 90), obs(2, 0, false)]);
    expect(thin.reliable).toBe(false);
    expect(thin.appearances).toBe(2);
    expect(thin.note).toContain(String(MIN_APPEARANCES));
    expect(thin.pStart).toBe(0);
  });

  it("says nothing to read when there is no history at all", () => {
    const none = estimateMinutes([]);
    expect(none.reliable).toBe(false);
    expect(none.note).toContain("No match history");
  });

  it("quotes a high P(start) for an ever-present", () => {
    const est = estimateMinutes(EVERPRESENT);
    expect(est.reliable).toBe(true);
    expect(est.pStart).toBeGreaterThan(0.85);
    expect(est.p60).toBeGreaterThan(0.85);
    expect(est.expectedMinutes).toBeGreaterThan(60);
  });

  it("lands a rotated player between the extremes", () => {
    const est = estimateMinutes(ROTATED);
    expect(est.reliable).toBe(true);
    expect(est.pStart).toBeGreaterThan(0.4);
    expect(est.pStart).toBeLessThan(0.8);
    // the interval brackets the mean
    expect(est.pStartInterval[0]).toBeLessThan(est.pStart);
    expect(est.pStartInterval[1]).toBeGreaterThan(est.pStart);
  });

  it("prices the early hook on P(60+), not on P(start)", () => {
    const est = estimateMinutes(EARLY_HOOK);
    expect(est.reliable).toBe(true);
    expect(est.pStart).toBeGreaterThan(0.8); // he starts
    expect(est.p60).toBeLessThan(0.5); // he does not finish
    expect(est.expectedMinutes).toBeLessThan(60); // so he is worth fewer minutes
  });

  it("stays honest about a bench player", () => {
    const est = estimateMinutes(NEW_SIGNING);
    // three rows — exactly at the threshold, but zero starts
    expect(est.reliable).toBe(true);
    expect(est.pStart).toBeLessThan(0.4);
    expect(est.pStartInterval[0]).toBe(0); // the interval admits the uncertainty
  });

  it("treats a sub appearance as not-a-start", () => {
    const subbed = [1, 2, 3, 4].map((gw) => obs(gw, 30, false));
    const est = estimateMinutes(subbed);
    expect(est.reliable).toBe(true);
    expect(est.pStart).toBeLessThan(0.4);
  });

  it("widens the interval when history is short", () => {
    const short = estimateMinutes(EVERPRESENT.slice(0, 3));
    const long = estimateMinutes(EVERPRESENT);
    const widthOf = (est: ReturnType<typeof estimateMinutes>) =>
      est.pStartInterval[1] - est.pStartInterval[0];
    expect(widthOf(short)).toBeGreaterThan(widthOf(long));
  });

  it("ignores observations older than the window", () => {
    const stale = [1, 2, 3].map((gw) => obs(gw, 90)).concat([20, 21].map((gw) => obs(gw, 0, false)));
    const est = estimateMinutes(stale, { nowGw: 21, maxAge: 5 });
    expect(est.appearances).toBe(2); // only GW20–21 fall inside the window
    expect(est.reliable).toBe(false);
  });

  it("treats a sub appearance as not-a-start", () => {
    const subbed = [1, 2, 3, 4].map((gw) => obs(gw, 30, false));
    const est = estimateMinutes(subbed);
    expect(est.reliable).toBe(true);
    expect(est.pStart).toBeLessThan(0.4);
  });

  it("returns the thin label constant for surfaces to render", () => {
    expect(MINUTES_THIN_LABEL).toBe("Not enough history");
  });
});