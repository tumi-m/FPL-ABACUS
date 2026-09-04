import { describe, expect, it } from "vitest";
import { trueForm } from "@/lib/quant/estimators";

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