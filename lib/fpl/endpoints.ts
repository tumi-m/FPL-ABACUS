import { z } from "zod";
import {
  zBootstrap,
  zElementSummary,
  zEntry,
  zEntryHistory,
  zEventStatus,
  zFixture,
  zLive,
  zPicks,
  zClassicStandings,
  zTransfers,
  type Bootstrap,
  type ElementSummary,
  type Entry,
  type EntryHistory,
  type EventStatus,
  type Fixture,
  type Live,
  type PicksResponse,
} from "@/lib/fpl/schemas";
import { fplFetch } from "@/lib/fpl/client";
import { cached } from "@/lib/cache/swr";
import { ttlFor, ttlForPicks } from "@/lib/cache/ttl";
import { currentPhase } from "@/lib/fpl/phase";
import type { GwPhase } from "@/lib/fpl/schemas";

/**
 * The phase provider, defaulted.
 *
 * The TTL table has an off-week column nobody ever reached because no caller
 * passed a provider — every key polled at live rates all week. Call sites may
 * still pass their own provider; the rest fall back to the phase the last
 * real page render computed (`lib/fpl/phase.ts`), which is exactly the signal
 * the table was written for and costs nothing.
 */
function phaseOpts(phase?: () => GwPhase | Promise<GwPhase>) {
  return { phase: phase ?? currentPhase };
}

export const getBootstrap = (phase?: () => GwPhase) =>
  cached<Bootstrap>("fpl:bootstrap", "bootstrap", () => fplFetch("/bootstrap-static/", zBootstrap), phaseOpts(phase));

export const getFixtures = (gw: number, phase?: () => GwPhase) =>
  cached<Fixture[]>(
    `fpl:fixtures:${gw}`,
    "fixtures",
    () => fplFetch(`/fixtures/?event=${gw}`, z.array(zFixture)),
    phaseOpts(phase),
  );

export const getFixturesAll = (phase?: () => GwPhase) =>
  cached<Fixture[]>(
    "fpl:fixtures:all",
    "fixtures",
    () => fplFetch("/fixtures/", z.array(zFixture)),
    phaseOpts(phase),
  );

export const getLive = (gw: number, phase?: () => GwPhase) =>
  cached<Live>(`fpl:live:${gw}`, "live", () => fplFetch(`/event/${gw}/live/`, zLive), phaseOpts(phase));

export const getEventStatus = (phase?: () => GwPhase) =>
  cached<EventStatus>("fpl:event-status", "eventStatus", () => fplFetch("/event-status/", zEventStatus), phaseOpts(phase));

export const getEntry = (id: number, phase?: () => GwPhase) =>
  cached<Entry>(`fpl:entry:${id}`, "entry", () => fplFetch(`/entry/${id}/`, zEntry), phaseOpts(phase));

export const getHistory = (id: number, phase?: () => GwPhase) =>
  cached<EntryHistory>(
    `fpl:history:${id}`,
    "history",
    () => fplFetch(`/entry/${id}/history/`, zEntryHistory),
    phaseOpts(phase),
  );

export const getTransfers = (id: number, phase?: () => GwPhase) =>
  cached(
    `fpl:transfers:${id}`,
    "history",
    () => fplFetch(`/entry/${id}/transfers/`, zTransfers),
    phaseOpts(phase),
  );

export const getPicks = async (id: number, gw: number, deadlinePassed: boolean, phase?: () => GwPhase) =>
  cached<PicksResponse>(
    `fpl:picks:${id}:${gw}`,
    ttlForPicks(deadlinePassed),
    () => fplFetch(`/entry/${id}/event/${gw}/picks/`, zPicks),
    phaseOpts(phase),
  );

export const getStandings = (leagueId: number, page = 1, phase?: () => GwPhase) =>
  cached(
    `fpl:league:${leagueId}:${page}`,
    "league",
    () => fplFetch(`/leagues-classic/${leagueId}/standings/?page_standings=${page}`, zClassicStandings),
    phaseOpts(phase),
  );

export const getElementSummary = (id: number) =>
  cached<ElementSummary>(
    `fpl:element-summary:${id}`,
    ttlFor("elementSummary", "final"),
    () => fplFetch(`/element-summary/${id}/`, zElementSummary),
  );
