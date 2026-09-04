import { describe, expect, it, beforeEach, vi } from "vitest";
import { notePhase, currentPhase } from "@/lib/fpl/phase";

describe("phase note/read", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
    return () => vi.useRealTimers();
  });

  it("reads live before anything was noted", () => {
    expect(currentPhase()).toBe("live");
  });

  it("returns the noted phase while fresh", () => {
    notePhase("final");
    expect(currentPhase()).toBe("final");
  });

  it("falls back to live once the note goes stale", () => {
    notePhase("final");
    vi.advanceTimersByTime(121_000);
    expect(currentPhase()).toBe("live");
  });

  it("a newer note wins", () => {
    notePhase("final");
    vi.advanceTimersByTime(60_000);
    notePhase("live");
    expect(currentPhase()).toBe("live");
  });
});