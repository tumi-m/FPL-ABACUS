import "server-only";

/**
 * Server composition for the proactive briefing (v10 B2).
 *
 * `lib/engines/briefing.ts` is pure and silent; this file fetches the five
 * trigger inputs and feeds it. Everything here is an enhancement — a failing
 * feed or an empty store costs a trigger, never the surface it sits on:
 *
 *   starters   — the XI from the round's picks, with FPL's own flags.
 *   watchlist  — the browser's stars priced by the tonight model (a missing
 *                snapshot store degrades to zero covered rows, per the house
 *                rule that stored data enhances and never throws).
 *   chips      — the bootstrap's availability windows.
 *   rival      — the round's biggest low-EO haul from the raw event log, or
 *                nothing: the trigger only needs a name, an EO and points.
 *
 * "Since last visit" is deliberately NOT detected here. The triggers that
 * matter before a deadline (flags, the armband, prices) are re-detected every
 * visit; the strip records last_seen on its own clock in the browser.
 */
import { getPicks } from "@/lib/fpl/endpoints";
import { loadGwContext } from "@/lib/server/gw";
import { loadSnapshots, loadChangeLedger } from "@/lib/server/priceStore";
import { rankTonight, type PriceSnapshot } from "@/lib/engines/price";
import { collectEvents } from "@/lib/server/swingStore";
import { eventPoints, type RawEvent } from "@/lib/engines/swing";
import { parseScoring } from "@/lib/engines/scoring";
import { fallbackEO } from "@/lib/engines/eo";
import { composeBriefing, type BriefingInput, type BriefingLine } from "@/lib/engines/briefing";
import type { BootstrapLite } from "@/lib/fpl/bootstrapLite";
import type { Pos } from "@/lib/engines/types";

export interface BriefingData {
  lines: BriefingLine[];
}

/**
 * Compose the briefing for a team and one round of watchlist ids.
 *
 * The watchlist lives in the browser, so its ids arrive on the query string —
 * the same contract the watchlist route uses. Called without ids, no
 * watchlist line can fire; that is honesty, not an error.
 */
export async function buildBriefing(teamId: number, watchIds: number[]): Promise<BriefingData> {
  const ctx = await loadGwContext();
  const boot = ctx.boot;
  const currentGw = ctx.event.id;
  const deadlinePassed = new Date(ctx.event.deadline_time).getTime() < Date.now();

  // One wave: picks, the raw event log for the rival trigger, and the
  // watchlist's price model. Each fails alone; the briefing is an enhancement
  // over a page that already works.
  const [picksRes, rawEvents] = await Promise.all([
    getPicks(teamId, currentGw, deadlinePassed).catch(() => null),
    collectEvents(currentGw, ctx.fixtures).catch(() => [] as RawEvent[]),
  ]);

  // ── starters: the XI, in slot order, with FPL's flag fields ────────────
  // The bench never triggers — a flagged bench player costs nothing until he
  // is needed, so a line about him would be padding.
  const starters: BriefingInput["starters"] = (picksRes?.picks ?? [])
    .filter((p) => p.position <= 11)
    .map((p) => {
      const el = boot.elements[p.element];
      return {
        id: p.element,
        name: el?.web_name ?? `#${p.element}`,
        isCaptain: p.is_captain,
        status: el?.status ?? "a",
        news: el?.news ?? "",
        chanceOfPlaying: el?.chance_of_playing_next_round ?? el?.chance_of_playing_this_round ?? null,
      };
    });

  // ── watchlist: price exactly the ids the browser holds ─────────────────
  const watchIdsClean = watchIds
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 30);
  let watchlist: BriefingInput["watchlist"] = [];
  if (watchIdsClean.length > 0) {
    const [wSnapshots, wLedger] = await Promise.all([
      loadSnapshots(watchIdsClean).catch(() => new Map<number, PriceSnapshot[]>()),
      loadChangeLedger().catch(() => ({ lastByElement: new Map<number, { at: Date }>() })),
    ]);
    const tonight = rankTonight(
      watchIdsClean.map((id) => ({
        element: id,
        snapshots: wSnapshots.get(id) ?? [],
        lastChangeAt: wLedger.lastByElement.get(id)?.at ?? null,
      })),
    );
    const pMoveOf = new Map(tonight.map((r) => [r.element, r]));
    watchlist = watchIdsClean
      .map((id) => {
        const el = boot.elements[id];
        const t = pMoveOf.get(id);
        if (!el || !t) return null;
        return {
          id,
          name: el.web_name,
          direction: t.direction,
          pMove: Math.abs(t.pRise),
          covered: t.covered,
          label: el.status,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
  }

  // ── chips: windows from the bootstrap, exactly as FPL publishes them ───
  const chips = boot.chips.map((c) => ({
    key: c.name,
    label: c.name,
    startEvent: c.start_event,
    stopEvent: c.stop_event,
  }));

  const nextEvent =
    boot.events.find((e) => e.id === currentGw + 1) ?? boot.events.find((e) => e.is_next);

  // ── rival: the biggest differential haul this round, from the raw events ──
  // A goal-haul by a low-EO player while your pick scored nothing is the
  // swing the rank feed prices. The engine applies the 8-point cut.
  const rival = rivalOf(rawEvents, boot);

  return {
    lines: composeBriefing({
      starters,
      watchlist,
      chips,
      currentGw,
      nextDeadline: nextEvent?.deadline_time ?? null,
      rival,
    }).lines,
  };
}

/** The round's biggest differential haul: 8+ points at EO under 10%. */
function rivalOf(rawEvents: RawEvent[], boot: BootstrapLite): BriefingInput["rival"] {
  const scoring = parseScoring(boot.scoring);
  const mostCaptained = boot.events.find((e) => e.is_current)?.most_captained ?? null;

  // Sum the round's goal involvements per player — goals and assists are what
  // "hauling" means, and they are the events whose points scale by position.
  const hauls = new Map<number, number>();
  for (const e of rawEvents) {
    if (e.identifier !== "goals_scored" && e.identifier !== "assists") continue;
    const el = boot.elements[e.element];
    if (!el) continue;
    const pts = eventPoints(e.identifier, el.element_type as Pos, scoring);
    hauls.set(e.element, (hauls.get(e.element) ?? 0) + pts * e.value);
  }

  let best: { name: string; eo: number; points: number } | null = null;
  for (const [element, points] of hauls) {
    const el = boot.elements[element];
    if (!el || points < 8) continue;
    const eo = fallbackEO({
      selectedByPercent: el.selected_by_percent,
      pos: el.element_type,
      mostCaptainedId: mostCaptained,
      elementId: element,
    });
    if (eo >= 10) continue;
    if (!best || points > best.points) {
      best = { name: el.web_name, eo, points };
    }
  }
  return best;
}