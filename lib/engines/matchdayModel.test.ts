import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { composeMatchdayModel } from "@/lib/engines/matchdayModel";
import { getGwPhase, bonusAddedDays } from "@/lib/engines/matchState";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import type { Bootstrap, Entry, EventStatus, Fixture, Live, PicksResponse } from "@/lib/fpl/schemas";

const FIX = path.join(import.meta.dirname, "..", "..", "__fixtures__");
const fx = <T>(name: string) => JSON.parse(readFileSync(path.join(FIX, name), "utf8")) as T;

const ENTRY_ID = 1851681;

describe("composeMatchdayModel", () => {
  it("builds a complete model from recorded GW1 payloads under 60 KB", async () => {
    const bootRaw = fx<Bootstrap>("bootstrap.json");
    const picks = fx<PicksResponse>(`picks-${ENTRY_ID}-gw1.json`);
    const live = fx<Live>("live-gw1.json");
    const fixtures = fx<Fixture[]>("fixtures-gw1.json");
    const status = fx<EventStatus>("event-status.json");
    const entry = fx<Entry>(`entry-${ENTRY_ID}.json`);

    // Rehydrate bootstrapLite through the real reducer (pure part)
    const { cached } = await import("@/lib/cache/swr");
    const { MemoryStore, setCacheStore } = await import("@/lib/cache/store");
    setCacheStore(new MemoryStore());
    const boot = await getBootstrapLite();

    const phase = getGwPhase(bootRaw.events.find((e) => e.is_current) ?? bootRaw.events[0], fixtures, status);
    const bundle = {
      curve: {
        points: [
          { rank: 1, total: 80 },
          { rank: 1000, total: 70 },
          { rank: 100000, total: 60 },
          { rank: 5000000, total: 40 },
        ],
        population: 4,
      },
      fieldAvg: 55,
      fieldSd: 12,
      sampleSize: 4,
    };

    const { model } = composeMatchdayModel({
      eventId: bootRaw.events.find((e) => e.is_current)?.id ?? 1,
      entry,
      picks,
      boot,
      live,
      fixtures,
      status,
      phase,
      addedDays: bonusAddedDays(status, 1),
      bundle,
      rawEvents: [
        { fixture: fixtures[0].id, element: 4, identifier: "goals_scored", value: 1, minute: 34 },
      ],
      transfersThisGw: [],
      previousSnapshot: null,
    });

    expect(model.squad).toHaveLength(15);
    expect(model.hero.gwPoints).toBeGreaterThanOrEqual(0);
    expect(model.fixturesRail.length).toBe(fixtures.length);
    expect(model.leverage.yours.length).toBeLessThanOrEqual(12);
    expect(model.leverage.threats.length).toBeLessThanOrEqual(12);
    expect(model.multiverse.results.length).toBeLessThanOrEqual(8);
    expect(model.leverage.eoSource).toBe("estimated");

    const size = Buffer.byteLength(JSON.stringify(model));
    expect(size).toBeLessThan(60 * 1024);
  });
});
