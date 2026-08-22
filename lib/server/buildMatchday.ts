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

export type BuildResult =
  | { ok: true; model: MatchdayModel & { upstreamDegraded?: boolean } }
  | { ok: false; reason: "picks-not-set" | "compose-failed"; message?: string };

/** Shared pipeline for the /api/gaffer/live route and the /live RSC page. */
export async function buildMatchday(entryId: number): Promise<BuildResult> {
  const ctx = await loadGwContext();
  const deadlinePassed = new Date(ctx.event.deadline_time).getTime() < Date.now();

  let picks;
  try {
    picks = await getPicks(entryId, ctx.event.id, deadlinePassed);
  } catch (err) {
    if (typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 404) {
      return { ok: false, reason: "picks-not-set" };
    }
    return { ok: false, reason: "compose-failed", message: String(err) };
  }

  const [entry, bundle] = await Promise.all([getEntry(entryId), getRankCurveBundle(ctx.event.id)]);
  let transfersThisGw: Awaited<ReturnType<typeof getTransfers>> = [];
  try {
    transfersThisGw = (await getTransfers(entryId)).filter((t) => t.event === ctx.event.id);
  } catch {
    transfersThisGw = [];
  }

  const rawEvents = await collectEvents(ctx.event.id, ctx.fixtures);

  const snapKey = `gaffer:lastsnap:${entryId}:${ctx.event.id}`;
  let previousSnapshot: { officialLiveRank: number | null; estRank: number | null } | null = null;
  try {
    const raw = await cacheStore().get(snapKey);
    if (raw) previousSnapshot = JSON.parse(raw);
  } catch {
    previousSnapshot = null;
  }

  const { model, snapshot } = composeMatchdayModel({
    eventId: ctx.event.id,
    entry,
    picks,
    boot: ctx.boot,
    live: ctx.live,
    fixtures: ctx.fixtures,
    status: ctx.status,
    phase: ctx.phase,
    addedDays: ctx.addedDays,
    bundle,
    rawEvents,
    transfersThisGw,
    previousSnapshot,
    cohortEo: await getCohortEO(ctx.event.id),
  });

  await cacheStore().set(snapKey, JSON.stringify(snapshot), 60 * 60 * 6);

  return { ok: true, model: { ...model, upstreamDegraded: (await breakerMsLeft()) > 0 } };
}
