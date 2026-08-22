import { describe, expect, it } from "vitest";
import {
  bocpd,
  changepointAlert,
  eventProbability,
  fitCox,
  trueForm,
} from "@/lib/quant/estimators";
import { mulberry32 } from "@/lib/engines/simulate";

describe("trueForm (feature 6)", () => {
  it("narrows uncertainty on starts and widens during absence", () => {
    const obs = [
      { y90: 0.5, minutes: 90 },
      { y90: 0.6, minutes: 90 },
      { y90: null, minutes: 0 }, // injury
      { y90: null, minutes: 0 },
      { y90: 0.55, minutes: 90 },
    ];
    const r = trueForm(obs);
    const sdAfterStarts = r.filtered[1].sd;
    const sdMidInjury = r.filtered[3].sd;
    expect(sdMidInjury).toBeGreaterThan(sdAfterStarts);
    const sdBack = r.filtered[4].sd;
    expect(sdBack).toBeLessThan(sdMidInjury);
  });

  it("discounts cameo evidence versus full starts", () => {
    const starter = trueForm([
      { y90: 1.2, minutes: 90 },
      { y90: 1.4, minutes: 90 },
    ]);
    const cameo = trueForm([
      { y90: 1.2, minutes: 12 },
      { y90: 1.4, minutes: 10 },
    ]);
    // the starter's posterior sits much closer to the observed hot streak
    expect(starter.ability).toBeGreaterThan(cameo.ability + 0.3);
  });
});

describe("bocpd (feature 7)", () => {
  it("flags a role change shortly after it happens", () => {
    const rng = mulberry32(4);
    const before = Array.from({ length: 14 }, () => 0.05 + rng() * 0.04); // bit-part
    const after = Array.from({ length: 14 }, () => 0.58 + rng() * 0.06); // set-piece king
    const points = bocpd([...before, ...after], { hazard: 1 / 12 });
    const alertIdx = changepointAlert(points, 0.6);
    expect(alertIdx).not.toBeNull();
    expect(alertIdx! - before.length).toBeLessThan(3); // within two matches of the break
  });

  it("stays quiet through steady streams", () => {
    const rng = mulberry32(8);
    const steady = Array.from({ length: 30 }, () => 0.2 + rng() * 0.05);
    const points = bocpd(steady);
    const maxCp = Math.max(...points.map((p) => p.probChangepoint));
    expect(maxCp).toBeLessThan(0.6);
  });

  it("keeps run-length posteriors normalised", () => {
    const points = bocpd([0.1, 0.15, 0.6, 0.65, 0.7]);
    for (const p of points) {
      let total = 0;
      for (const v of p.runlengths.values()) total += v;
      expect(total).toBeCloseTo(1, 4);
    }
  });
});

describe("fitCox (feature 8)", () => {
  it("recovers positive load risk — heavy legs get hurt more", () => {
    const rng = mulberry32(21);
    const data = Array.from({ length: 240 }, (_, i) => {
      const heavy = i % 2 === 0;
      const load = heavy ? 1.6 + rng() * 0.4 : 0.4 + rng() * 0.4;
      // heavy loaders fail sooner — build censoring accordingly
      const failWeek = heavy ? 2 + Math.floor(rng() * 4) : 7 + Math.floor(rng() * 4);
      return {
        covariates: [load],
        event: 1,
        time: failWeek,
      };
    });
    const model = fitCox(data);
    expect(model.coefficients[0]).toBeGreaterThan(0);

    const risky = eventProbability(model, [1.9], 3);
    const fresh = eventProbability(model, [0.4], 3);
    expect(risky).toBeGreaterThan(fresh);
    expect(risky).toBeGreaterThan(0);
    expect(risky).toBeLessThanOrEqual(1);
  });

  it("handles empty-ish input without exploding", () => {
    const model = fitCox([{ covariates: [1], event: 0, time: 3 }]);
    expect(Number.isFinite(eventProbability(model, [1], 2))).toBe(true);
  });
});
