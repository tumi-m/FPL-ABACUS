import { describe, expect, it } from "vitest";
import { getGwPhase } from "@/lib/engines/matchState";
import { weekMoment, type MomentSpec } from "@/lib/engines/weekPhase";
import type { EventStatus, Fixture, FplEvent, GwPhase } from "@/lib/fpl/schemas";

const NOW = Date.parse("2026-08-20T12:00:00Z");

function event(over: Partial<FplEvent> = {}): FplEvent {
  return {
    id: 14,
    deadline_time: new Date(NOW + 3 * 86_400_000).toISOString(),
    data_checked: false,
    ...over,
  } as unknown as FplEvent;
}

function fixture(over: Partial<Fixture> = {}): Fixture {
  return { started: false, finished_provisional: false, ...over } as unknown as Fixture;
}

function status(days: { bonus_added: boolean }[] = []): EventStatus {
  return { status: days.map((d, i) => ({ event: 14, date: `2026-08-${20 + i}`, points: 0, ...d })) } as unknown as EventStatus;
}

function momentOf(phase: GwPhase, deadlineMs?: number): MomentSpec {
  return weekMoment(phase, NOW, deadlineMs != null ? new Date(deadlineMs).toISOString() : null);
}

describe("weekMoment maps every phase onto the week machine", () => {
  it("final and bonus-added phases are the autopsy", () => {
    expect(momentOf("final").key).toBe("autopsy");
    expect(momentOf("bonus_added").label).toBe("Autopsy");
    expect(momentOf("bonus_added").focus).toBe("/field/points");
  });

  it("provisional scores are a reveal, live is the match, idle is wait", () => {
    expect(momentOf("provisional").key).toBe("reveal");
    expect(momentOf("live").key).toBe("match");
    expect(momentOf("awaiting_kickoff").key).toBe("wait");
  });

  it("pre-deadline far out is the workshop, inside the window the war room", () => {
    expect(momentOf("pre_deadline", NOW + 10 * 86_400_000).key).toBe("workshop");
    expect(momentOf("pre_deadline", NOW + 36 * 3_600_000).key).toBe("warroom");
    expect(momentOf("pre_deadline", NOW + 2 * 3_600_000).key).toBe("warroom");
  });

  it("an unknown deadline keeps pre-deadline in the workshop", () => {
    expect(weekMoment("pre_deadline", NOW, null).key).toBe("workshop");
  });
});

describe("getGwPhase ordering (pins the input contract)", () => {
  it("data_checked wins over everything", () => {
    const p = getGwPhase(event({ data_checked: true }), [fixture({ started: true })], status([{ bonus_added: false }]), NOW);
    expect(p).toBe("final");
  });

  it("future deadline is pre_deadline even with started fixtures", () => {
    const p = getGwPhase(event(), [fixture({ started: true })], status(), NOW);
    expect(p).toBe("pre_deadline");
  });

  it("nothing started awaits kickoff; unfinished games are live", () => {
    expect(getGwPhase(event({ deadline_time: new Date(NOW - 1).toISOString() }), [], status(), NOW)).toBe("awaiting_kickoff");
    expect(
      getGwPhase(event({ deadline_time: new Date(NOW - 1).toISOString() }), [fixture({ started: true, finished_provisional: false })], status(), NOW),
    ).toBe("live");
  });

  it("all provisional plus every day bonus-added settles the phase", () => {
    const ev = event({ deadline_time: new Date(NOW - 1).toISOString() });
    const fxs = [fixture({ started: true, finished_provisional: true })];
    expect(getGwPhase(ev, fxs, status([{ bonus_added: false }]), NOW)).toBe("provisional");
    expect(getGwPhase(ev, fxs, status([{ bonus_added: true }, { bonus_added: true }]), NOW)).toBe("bonus_added");
  });
});
