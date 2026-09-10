import { describe, expect, it } from "vitest";
import {
  PACE_MIN_GWS,
  TREND_MIN_SEASONS,
  buildCareer,
  careerPace,
  type PastSeason,
} from "@/lib/engines/career";

const season = (name: string, points: number, rank: number): PastSeason => ({
  season_name: name,
  total_points: points,
  rank,
});

describe("buildCareer", () => {
  it("orders a career oldest first, whatever order it arrived in", () => {
    // Trusting the array's order would trust an upstream that has never
    // promised one, and a career read backwards inverts every delta.
    const r = buildCareer([
      season("2025/26", 2200, 300_000),
      season("2023/24", 2000, 900_000),
      season("2024/25", 2100, 600_000),
    ]);
    expect(r.seasons.map((s) => s.season)).toEqual(["2023/24", "2024/25", "2025/26"]);
  });

  it("reads a smaller rank as an improvement", () => {
    const r = buildCareer([season("2023/24", 2000, 900_000), season("2024/25", 2100, 600_000)]);
    expect(r.seasons[1].rankDelta).toBe(-300_000);
    expect(r.seasons[1].pointsDelta).toBe(100);
    expect(r.best?.season).toBe("2024/25");
    expect(r.worst?.season).toBe("2023/24");
  });

  it("leaves the earliest season with no delta to compare against", () => {
    const r = buildCareer([season("2023/24", 2000, 900_000)]);
    expect(r.seasons[0].rankDelta).toBeNull();
    expect(r.seasons[0].pointsDelta).toBeNull();
  });

  it("refuses a trend on two seasons", () => {
    // Two points make a line through anything. Calling one better year
    // "improving" sounds like a finding and predicts nothing.
    const r = buildCareer([season("2023/24", 2000, 900_000), season("2024/25", 2100, 400_000)]);
    expect(r.seasons).toHaveLength(2);
    expect(r.trend).toBe("too-few");
  });

  it("calls a trend once there are enough seasons for one", () => {
    const improving = buildCareer([
      season("2022/23", 1900, 3_000_000),
      season("2023/24", 2050, 1_500_000),
      season("2024/25", 2200, 400_000),
    ]);
    expect(improving.trend).toBe("improving");
    expect(TREND_MIN_SEASONS).toBe(3);

    const declining = buildCareer([
      season("2022/23", 2200, 400_000),
      season("2023/24", 2050, 1_500_000),
      season("2024/25", 1900, 3_000_000),
    ]);
    expect(declining.trend).toBe("declining");
  });

  it("judges movement proportionally, not in absolute places", () => {
    // 200,000 places is a transformation at the top of the table and a
    // rounding error at the bottom, so an absolute threshold would call the
    // second of these a change and it is not one.
    const atTheTop = buildCareer([
      season("2022/23", 2400, 30_000),
      season("2023/24", 2350, 120_000),
      season("2024/25", 2300, 230_000),
    ]);
    expect(atTheTop.trend).toBe("declining");

    const atTheBottom = buildCareer([
      season("2022/23", 1700, 8_000_000),
      season("2023/24", 1710, 8_100_000),
      season("2024/25", 1705, 8_050_000),
    ]);
    expect(atTheBottom.trend).toBe("steady");
  });

  it("takes the median rank so one disaster does not define a career", () => {
    const r = buildCareer([
      season("2022/23", 2200, 400_000),
      season("2023/24", 1400, 8_000_000),
      season("2024/25", 2250, 350_000),
    ]);
    expect(r.medianRank).toBe(400_000);
  });

  it("drops a season FPL could not give a rank for", () => {
    const r = buildCareer([
      season("2022/23", 2200, 400_000),
      { season_name: "2023/24", total_points: 0, rank: 0 },
    ]);
    expect(r.seasons.map((s) => s.season)).toEqual(["2022/23"]);
  });

  it("is honest about a manager with no history at all", () => {
    const r = buildCareer([]);
    expect(r.seasons).toEqual([]);
    expect(r.best).toBeNull();
    expect(r.trend).toBe("too-few");
    expect(r.medianRank).toBeNull();
  });

  it("flags that a per-gameweek figure assumes a full season", () => {
    // Somebody who joined in December has a small total for a reason this
    // data cannot show. The number is still useful; the assumption has to
    // travel with it.
    const r = buildCareer([season("2023/24", 1900, 900_000)]);
    expect(r.seasons[0].pointsPerGw).toBe(50);
    expect(r.assumesFullSeason).toBe(true);
  });
});

describe("careerPace", () => {
  const record = buildCareer([
    season("2022/23", 1900, 3_000_000), // 50.0 / gw
    season("2023/24", 2090, 1_500_000), // 55.0 / gw
    season("2024/25", 2280, 400_000), // 60.0 / gw
  ]);

  it("says nothing about a season that has barely started", () => {
    // Two gameweeks is variance with a scoreboard attached.
    expect(careerPace(record, { points: 130, gwsPlayed: 2 })).toBeNull();
    expect(PACE_MIN_GWS).toBe(5);
  });

  it("compares per gameweek against the best and the median season", () => {
    const pace = careerPace(record, { points: 650, gwsPlayed: 10 })!;
    expect(pace.pointsPerGw).toBe(65);
    expect(pace.vsBest).toBe(5);
    expect(pace.vsMedian).toBe(10);
  });

  it("reports a worse pace as a negative, not an absolute", () => {
    const pace = careerPace(record, { points: 450, gwsPlayed: 10 })!;
    expect(pace.pointsPerGw).toBe(45);
    expect(pace.vsBest).toBe(-15);
    expect(pace.vsMedian).toBe(-10);
  });

  it("has nothing to compare against with no past seasons", () => {
    expect(careerPace(buildCareer([]), { points: 650, gwsPlayed: 10 })).toBeNull();
  });
});
