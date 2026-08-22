import { NextRequest, NextResponse } from "next/server";
import { getEntry, getPicks, getTransfers } from "@/lib/fpl/endpoints";
import { loadGwContext } from "@/lib/server/gw";
import { getRankCurveBundle } from "@/lib/server/rankCurveServer";
import { collectEvents } from "@/lib/server/swingStore";
import { composeMatchdayModel } from "@/lib/engines/matchdayModel";
import { cacheStore } from "@/lib/cache/store";
import { breakerMsLeft } from "@/lib/cache/swr";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const entryId = Number(req.nextUrl.searchParams.get("entry"));
  if (!Number.isFinite(entryId) || entryId <= 0) {
    return NextResponse.json({ error: "entry query param required" }, { status: 400 });
  }

  try {
    const ctx = await loadGwContext();
    const deadlinePassed = new Date(ctx.event.deadline_time).getTime() < Date.now();

    let picks;
    try {
      picks = await getPicks(entryId, ctx.event.id, deadlinePassed);
    } catch (err) {
      if (typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 404) {
        return NextResponse.json({ error: "picks-not-set", phase: ctx.phase }, { status: 200 });
      }
      throw err;
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
    let previousSnapshot = null;
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
    });

    await cacheStore().set(snapKey, JSON.stringify(snapshot), 60 * 60 * 6);

    return NextResponse.json(
      { ...model, upstreamDegraded: await breakerMsLeft() > 0 },
      { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "compose-failed", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
