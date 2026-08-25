import "server-only";
import { getEntry, getPicks, getTransfers } from "@/lib/fpl/endpoints";
import { loadGwContext } from "@/lib/server/gw";
import { getRankCurveBundle } from "@/lib/server/rankCurveServer";
import { getCohortEO } from "@/lib/server/eoServer";
import { collectEvents } from "@/lib/server/swingStore";
import { composeMatchdayModel } from "@/lib/engines/matchdayModel";
import type { MatchdayModel } from "@/lib/engines/matchdayModel";
import { cacheStore } from "@/lib/cache/store";
import { breakerMsLeft } from "@/lib/cache/swr";
import { ENHANCEMENT_MS, withDeadline } from "@/lib/server/deadline";

export type BuildResult =
  | { ok: true; model: MatchdayModel & { upstreamDegraded?: boolean } }
  | { ok: false; reason: "picks-not-set" | "compose-failed"; message?: string };

/** Shared pipeline for the /api/gaffer/live route and the /live RSC page. */
export async function buildMatchday(entryId: number, gw?: number): Promise<BuildResult> {
  const ctx = await loadGwContext(gw);
  const deadlinePassed = new Date(ctx.event.deadline_time).getTime() < Date.now();
  const historical = gw != null && gw !== ctx.boot.events.find((e) => e.is_current)?.id;

  let picks;
  try {
    picks = await getPicks(entryId, ctx.event.id, deadlinePassed);
  } catch (err) {
    if (typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 404) {
      return { ok: false, reason: "picks-not-set" };
    }
    return { ok: false, reason: "compose-failed", message: String(err) };
  }

  // Everything below depends only on the entry and the gameweek, so it goes
  // in one wave. This used to be five separate awaits in a row — five round
  // trips of latency stacked up before a single pixel could render.
  //
  // The last four are enhancements: the rank curve behind the live-rank
  // estimate, the swing event log, the cohort EO sample and the previous
  // snapshot. Each is capped by a deadline, because the page is worth more
  // than any of them. A slow one keeps running and warms the cache for the
  // next render; this one just goes without and says so.
  const snapKey = `gaffer:lastsnap:${entryId}:${ctx.event.id}`;
  const emptyBundle = { curve: null, fieldAvg: 0, fieldSd: 0, sampleSize: 0 };

  const [entry, transfersRes, bundle, rawEvents, cohortEo, previousSnapshot] = await Promise.all([
    getEntry(entryId),
    getTransfers(entryId).catch(() => [] as Awaited<ReturnType<typeof getTransfers>>),
    historical
      ? Promise.resolve(emptyBundle)
      : withDeadline(getRankCurveBundle(ctx.event.id), ENHANCEMENT_MS, emptyBundle),
    historical
      ? Promise.resolve([])
      : withDeadline(collectEvents(ctx.event.id, ctx.fixtures), ENHANCEMENT_MS, []),
    withDeadline(getCohortEO(ctx.event.id), ENHANCEMENT_MS, null),
    historical
      ? Promise.resolve(null)
      : readSnapshot(snapKey),
  ]);

  const transfersThisGw = transfersRes.filter((t) => t.event === ctx.event.id);

  const { model, snapshot } = composeMatchdayModel({
    eventId: ctx.event.id,
    entry,
    picks,
    boot: ctx.boot,
    live: ctx.live,
    fixtures: ctx.fixtures,
    allFixtures: ctx.allFixtures,
    status: ctx.status,
    phase: ctx.phase,
    addedDays: ctx.addedDays,
    bundle,
    rawEvents,
    transfersThisGw,
    previousSnapshot,
    cohortEo,
  });

  if (!historical) {
    await cacheStore().set(snapKey, JSON.stringify(snapshot), 60 * 60 * 6);
  }

  return { ok: true, model: { ...model, upstreamDegraded: (await breakerMsLeft()) > 0 } };
}

/** The last render's rank, for the delta arrow. Absent is normal, not an error. */
async function readSnapshot(
  key: string,
): Promise<{ officialLiveRank: number | null; estRank: number | null } | null> {
  try {
    const raw = await cacheStore().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
