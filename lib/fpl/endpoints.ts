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
import type { GwPhase } from "@/lib/fpl/schemas";

function phaseOpts(phase?: () => GwPhase | Promise<GwPhase>) {
  return phase ? { phase } : {};
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
