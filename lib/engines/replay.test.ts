import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { provisionalBonus, bonusForFixture } from "@/lib/engines/bonus";
import { buildLiveSquad } from "@/lib/engines/liveSquad";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import type { Fixture, Live, PicksResponse } from "@/lib/fpl/schemas";

/**
 * THE replay gate (docs/09 §1): computed bonus == official bonus,
 * projected subs == official subs, computed points == official points.
 *
 * Requires FINAL gameweek fixtures. Re-record after GW1 hits data_checked
 * (~Sun 09:00 UK) with `pnpm record`, then this suite stops skipping and
 * enforces exact equality.
 */
const FIX = path.join(import.meta.dirname, "..", "..", "__fixtures__");
const ENTRY_ID = Number(process.env.FPL_ENTRY_ID ?? 1851681);

function fx<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(FIX, name), "utf8")) as T;
}

const hasReplayData = existsSync(path.join(FIX, "replay-ready"));

describe.skipIf(!hasReplayData)("replay: finished gameweek", () => {
  const picks = fx<PicksResponse>(`picks-${ENTRY_ID}-gw1.json`);
  const live = fx<Live>("live-gw1.json");
  const fixtures = fx<Fixture[]>("fixtures-gw1.json");

  it("reproduces official bonus for every element", () => {
    // After finalisation all days have bonus added; force-compute as if none did.
    const computed = provisionalBonus(fixtures, new Set());
    for (const el of live.elements) {
      if (el.stats.minutes === 0 && el.stats.bps === 0) continue;
      expect(computed.get(el.id) ?? 0).toBe(el.stats.bonus > 0 ? el.stats.bonus : 0);
    }
  });

  it("bonus tie rule matches FPL grouping on every fixture", () => {
    for (const f of fixtures) {
      if (!f.started || f.minutes < 20) continue;
      const bps = f.stats.find((s) => s.identifier === "bps");
      if (!bps) continue;
      const map = new Map<number, number>();
      for (const e of [...bps.h, ...bps.a]) map.set(e.element, e.value);
      const bonusStat = f.stats.find((s) => s.identifier === "bonus");
      if (!bonusStat || !f.finished_provisional) continue;
      const official = new Map<number, number>();
      for (const e of [...bonusStat.h, ...bonusStat.a]) official.set(e.element, e.value);
      if (official.size === 0) continue;
      expect(bonusForFixture(map)).toEqual(official);
    }
  });

  it("reproduces official auto-subs", async () => {
    const { MemoryStore, setCacheStore } = await import("@/lib/cache/store");
    setCacheStore(new MemoryStore());
    const boot = await getBootstrapLite();
    const squadState = buildLiveSquad({ picks, live, fixtures, boot, bonusAddedDays: new Set() });

    const projected = squadState.subs.map((s) => ({ out: s.out, in: s.in })).sort((a, b) => a.out - b.out);
    const official = picks.automatic_subs.map((s) => ({ out: s.element_out, in: s.element_in })).sort((a, b) => a.out - b.out);
    expect(projected).toEqual(official);
  });

  it("reproduces official gameweek points exactly", async () => {
    const { MemoryStore, setCacheStore } = await import("@/lib/cache/store");
    setCacheStore(new MemoryStore());
    const boot = await getBootstrapLite();
    const squadState = buildLiveSquad({
      picks,
      live,
      fixtures,
      boot,
      // Final GW: official bonus already inside total_points; pass all days as added.
      bonusAddedDays: new Set(fixtures.map((f) => f.kickoff_time?.slice(0, 10) ?? "")),
    });
    expect(squadState.gwPoints).toBe(picks.entry_history.points);
  });
});
