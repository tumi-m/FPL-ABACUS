import { describe, expect, it } from "vitest";
import { bandOf, buildPercentiles, percentileOf } from "@/lib/engines/playerPercentiles";
import type { ElementLite } from "@/lib/fpl/bootstrapLite";

function player(over: Partial<ElementLite> = {}): ElementLite {
  return {
    id: 1, web_name: "P", element_type: 3, team: 1, team_code: 1, now_cost: 60,
    status: "a", news: "", chance_of_playing_this_round: null, chance_of_playing_next_round: null,
    selected_by_percent: 1, form: 0, ep_next: null, photo: "", code: 1,
    minutes: 900, xg90: null, xa90: null, ppg: 0, total_points: 50, event_points: 0,
    goals_scored: 0, assists: 0, bonus: 0, bps: 0, transfersInEvent: 0, transfersOutEvent: 0,
    costChangeEvent: 0, costChangeStart: 0,
    xgTotal: 0, xaTotal: 0, xgcTotal: 0, xgiTotal: 0, ep_this: null,
    cleanSheets: 0, goalsConceded: 0, ownGoals: 0, saves: 0, pensSaved: 0, pensMissed: 0,
    yellowCards: 0, redCards: 0, starts: 10, deadBall: null,
    defcon: 0, tackles: 0, recoveries: 0, cbi: 0,
    influence: 0, creativity: 0, threat: 0,
    ...over,
  };
}

describe("percentileOf", () => {
  it("puts the best of a pool at the top", () => {
    expect(percentileOf(10, [1, 2, 3, 4, 10])).toBe(90);
  });

  it("splits ties rather than ordering them arbitrarily", () => {
    // Twenty players on nought assists must all read the same; array order is
    // not a ranking.
    const pool = [0, 0, 0, 0, 5];
    expect(percentileOf(0, pool)).toBe(40);
  });

  it("refuses to rank against a cohort too small to mean anything", () => {
    expect(percentileOf(5, [1, 2, 3, 4])).toBeNull();
  });
});

describe("buildPercentiles", () => {
  const others = (n: number, over: (i: number) => Partial<ElementLite>) =>
    Array.from({ length: n }, (_, i) => player({ id: i + 10, ...over(i) }));

  it("ranks a player only against his own position", () => {
    // A defender's goals must not be measured against strikers'.
    const target = player({ id: 1, element_type: 2, goals_scored: 3 });
    const defenders = others(9, (i) => ({ element_type: 2, goals_scored: i === 0 ? 4 : 0 }));
    const strikers = others(20, () => ({ element_type: 4, goals_scored: 20 }));
    const r = buildPercentiles({ player: target, all: [...defenders, ...strikers], minMinutes: 90 });
    expect(r.cohortSize).toBe(10);
    const goals = r.groups.flatMap((g) => g.rows).find((x) => x.key === "goals");
    expect(goals?.percentile).toBeGreaterThan(80);
  });

  it("inverts the bar where a low number is the good one", () => {
    // Fewest cards must read as a full bar, not an empty one.
    const clean = player({ id: 1, yellowCards: 0 });
    const booked = others(9, () => ({ yellowCards: 9 }));
    const r = buildPercentiles({ player: clean, all: booked, minMinutes: 90 });
    const cards = r.groups.flatMap((g) => g.rows).find((x) => x.key === "cards");
    expect(cards?.lowerIsBetter).toBe(true);
    expect(cards?.percentile).toBeGreaterThanOrEqual(90);
  });

  it("shows a keeper his own rows and hides them from everyone else", () => {
    const gk = player({ id: 1, element_type: 1, saves: 40, starts: 10 });
    const keepers = others(9, () => ({ element_type: 1, saves: 10 }));
    const keys = buildPercentiles({ player: gk, all: keepers, minMinutes: 90 })
      .groups.flatMap((g) => g.rows).map((r) => r.key);
    expect(keys).toContain("saves");
    expect(keys).toContain("conceded");

    // A midfielder scores a point for a clean sheet, so he keeps that row —
    // but saves and goals conceded are not his to answer for.
    const mid = player({ id: 1, element_type: 3 });
    const mids = others(9, () => ({ element_type: 3 }));
    const midKeys = buildPercentiles({ player: mid, all: mids, minMinutes: 90 })
      .groups.flatMap((g) => g.rows).map((r) => r.key);
    expect(midKeys).toContain("cleanSheets");
    expect(midKeys).not.toContain("saves");
    expect(midKeys).not.toContain("conceded");

    // A forward scores nothing from a clean sheet at all.
    const fwd = player({ id: 1, element_type: 4 });
    const fwds = others(9, () => ({ element_type: 4 }));
    const fwdKeys = buildPercentiles({ player: fwd, all: fwds, minMinutes: 90 })
      .groups.flatMap((g) => g.rows).map((r) => r.key);
    expect(fwdKeys).not.toContain("cleanSheets");
  });

  it("never divides by zero minutes", () => {
    const unused = player({ id: 1, minutes: 0, total_points: 0 });
    const rest = others(9, () => ({ minutes: 900 }));
    const r = buildPercentiles({ player: unused, all: rest, minMinutes: 0 });
    for (const row of r.groups.flatMap((g) => g.rows)) {
      expect(Number.isFinite(row.value ?? 0)).toBe(true);
    }
    // Per-90 rows drop out entirely rather than showing Infinity or a zero
    // that reads as "he is bad at this".
    expect(r.groups.flatMap((g) => g.rows).map((x) => x.key)).not.toContain("goals");
  });

  it("includes the player in his own cohort", () => {
    // Ranking against a pool he is absent from can put him past the hundredth.
    const star = player({ id: 1, minutes: 100, goals_scored: 50 });
    const rest = others(9, () => ({ minutes: 900 }));
    const r = buildPercentiles({ player: star, all: rest, minMinutes: 500 });
    expect(r.cohortSize).toBe(10);
    const goals = r.groups.flatMap((g) => g.rows).find((x) => x.key === "goals");
    expect(goals?.percentile).toBeLessThanOrEqual(100);
  });

  it("leaves the percentile null rather than guessing on a thin cohort", () => {
    const p = player({ id: 1 });
    const r = buildPercentiles({ player: p, all: others(2, () => ({})), minMinutes: 90 });
    for (const row of r.groups.flatMap((g) => g.rows)) expect(row.percentile).toBeNull();
  });

  it("reads clean sheets against minutes played, so the rate cannot exceed 100", () => {
    // Four clean sheets across 900 minutes — ten matches' worth — is 40%.
    const p = player({ id: 1, element_type: 2, minutes: 900, cleanSheets: 4 });
    const rest = others(9, () => ({ element_type: 2, minutes: 900, cleanSheets: 1 }));
    const cs = buildPercentiles({ player: p, all: rest, minMinutes: 90 })
      .groups.flatMap((g) => g.rows).find((x) => x.key === "cleanSheets");
    expect(cs?.display).toBe("40%");
  });

  it("cannot produce a clean-sheet rate above 100, however the season went", () => {
    // The bug this replaces: dividing by starts let a substitute who kept a
    // clean sheet without starting exceed 100%, which then outranked players
    // who had genuinely kept one in every match.
    const sub = player({ id: 1, element_type: 2, minutes: 90, starts: 0, cleanSheets: 1 });
    const rest = others(9, () => ({ element_type: 2, minutes: 900, cleanSheets: 5 }));
    const cs = buildPercentiles({ player: sub, all: rest, minMinutes: 45 })
      .groups.flatMap((g) => g.rows).find((x) => x.key === "cleanSheets");
    expect(cs?.value).toBeLessThanOrEqual(100);
    expect(cs?.display).toBe("100%");
  });
});

describe("bandOf", () => {
  it("bands the four states at their boundaries", () => {
    expect(bandOf(100)).toBe("elite");
    expect(bandOf(80)).toBe("elite");
    expect(bandOf(79)).toBe("strong");
    expect(bandOf(55)).toBe("strong");
    expect(bandOf(54)).toBe("average");
    expect(bandOf(30)).toBe("average");
    expect(bandOf(29)).toBe("poor");
    expect(bandOf(0)).toBe("poor");
  });
});
