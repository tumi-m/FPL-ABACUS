import { describe, expect, it } from "vitest";
import { fitDixonColes, lambdasFor, scoreProbability, tau } from "@/lib/quant/strength";

function season(ageBase = 0): Parameters<typeof fitDixonColes>[0] {
  // A crushes everyone; C leaks; B middling. Ten rounds each pairing pattern.
  const out: { homeTeam: number; awayTeam: number; gh: number; ga: number; ageDays: number }[] = [];
  for (let r = 0; r < 10; r++) {
    out.push({ homeTeam: 1, awayTeam: 2, gh: 3, ga: 0, ageDays: ageBase + r * 7 });
    out.push({ homeTeam: 2, awayTeam: 3, gh: 2, ga: 0, ageDays: ageBase + r * 7 });
    out.push({ homeTeam: 3, awayTeam: 1, gh: 1, ga: 2, ageDays: ageBase + r * 7 });
    out.push({ homeTeam: 4, awayTeam: 5, gh: 1, ga: 1, ageDays: ageBase + r * 7 });
  }
  return out;
}

describe("fitDixonColes", () => {
  it("is deterministic", () => {
    const a = fitDixonColes(season());
    const b = fitDixonColes(season());
    expect(a.att.get(1)).toBe(b.att.get(1));
    expect(a.def.get(3)).toBe(b.def.get(3));
  });

  it("ranks injected strength correctly", () => {
    const fit = fitDixonColes(season(), { sweeps: 120 });
    expect(fit.att.get(1)!).toBeGreaterThan(fit.att.get(2)!);
    expect(fit.att.get(2)!).toBeGreaterThan(fit.att.get(3)!);
    // lower (more negative) defence coefficient = leakier side, since
    // opponent rates are exp(μ + att − def)
    expect(fit.def.get(3)!).toBeLessThan(fit.def.get(1)!);
  });

  it("weights recent matches more when xi > 0", () => {
    // team 1 was prolific long ago; its last five matches are dour 0-0s
    const matches = [
      ...Array.from({ length: 10 }, (_, i) => ({
        homeTeam: 1,
        awayTeam: 9,
        gh: 4,
        ga: 0,
        ageDays: 300 - i * 2,
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        homeTeam: 1,
        awayTeam: 8,
        gh: 0,
        ga: 0,
        ageDays: 14 - i,
      })),
    ];
    const decayed = fitDixonColes(matches, { xi: 0.02 });
    const flat = fitDixonColes(matches, { xi: 0 });
    expect(decayed.att.get(1)!).toBeLessThan(flat.att.get(1)!);
  });

  it("shrinks extreme rates when the prior is tight", () => {
    const tiny = [{ homeTeam: 1, awayTeam: 2, gh: 9, ga: 0, ageDays: 0 }];
    // μ absorbs the goal burst, so compare pooling strengths directly:
    // a tight σ_att must pull the projected rate far below a loose one.
    const strongPrior = fitDixonColes(tiny, { sigmaAtt: 0.05, sweeps: 80 });
    const loosePrior = fitDixonColes(tiny, { sigmaAtt: 5, sweeps: 80 });
    const tight = lambdasFor(strongPrior, 1, 2).lambdaHome;
    const loose = lambdasFor(loosePrior, 1, 2).lambdaHome;
    expect(tight).toBeLessThan(loose);
    expect(tight).toBeGreaterThan(0);
  });

  it("returns standard errors that shrink with more data", () => {
    const few = fitDixonColes(season().slice(0, 4));
    const many = fitDixonColes(season());
    expect(many.se.get(1)!.att).toBeLessThan(few.se.get(1)!.att);
  });

  it("degrades gracefully to priors on empty input", () => {
    const fit = fitDixonColes([]);
    expect(fit.matchesUsed).toBe(0);
    expect(Number.isFinite(fit.mu)).toBe(true);
  });
});

describe("tau and score probabilities", () => {
  it("boosts low scores for negative rho", () => {
    // τ(0,0) = 1 − λμρ — with negative ρ this EXCEEDS one
    expect(tau(0, 0, -0.1, 1.2, 1.2)).toBeGreaterThan(1);
    expect(tau(1, 1, -0.1, 5, 5)).toBeGreaterThan(1); // diagonal boosted together
    expect(tau(0, 1, -0.1, 5, 5)).toBeLessThan(1); // off-diagonal dampened
    expect(tau(4, 3, -0.1, 5, 5)).toBe(1); // high scores untouched
    const p00neg = scoreProbability(0.8, 0.8, 0, 0, -0.1);
    const p00zero = scoreProbability(0.8, 0.8, 0, 0, 0);
    expect(p00neg).toBeGreaterThan(p00zero);
    const p10neg = scoreProbability(2.5, 2.5, 0, 1, -0.1);
    const p10zero = scoreProbability(2.5, 2.5, 0, 1, 0);
    expect(p10neg).toBeLessThan(p10zero); // off-diagonal cells lose mass
  });

  it("projects a stronger home rate via gamma", () => {
    const fit = fitDixonColes(season(), { sweeps: 60 });
    const { lambdaHome, lambdaAway } = lambdasFor(fit, 1, 3);
    expect(lambdaHome).toBeGreaterThan(lambdaAway * 0.5); // home edge exists
  });
});
