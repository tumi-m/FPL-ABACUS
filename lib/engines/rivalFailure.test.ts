import { describe, expect, it } from "vitest";
import { describeFailure, readRivalFailure } from "@/lib/engines/rivalFailure";
import { FplHttpError, FplSchemaError } from "@/lib/fpl/client";
import { BreakerOpenError } from "@/lib/cache/breaker";

const notFound = new FplHttpError(404, "/entry/4143072/event/2/picks/");

describe("readRivalFailure", () => {
  it("never blames the id when the confirming lookup itself failed", () => {
    // The bug: the probe was `.catch(() => null)` and null read as "missing",
    // so a timeout on the second request told the user their rival's team did
    // not exist — a confident, wrong statement about something they typed
    // correctly.
    const r = readRivalFailure(notFound, { kind: "failed", err: new FplHttpError(503, "/entry/4143072/") });
    expect(r.reason).toBe("upstream");
    expect(r.detail).toBe("FPL returned 503");
  });

  it("nor when the probe never ran at all", () => {
    expect(readRivalFailure(notFound).reason).toBe("upstream");
  });

  it("blames the id only when FPL says the entry is missing", () => {
    expect(readRivalFailure(notFound, { kind: "missing" }).reason).toBe("no-such-entry");
  });

  it("says picks-not-set when the team exists but has no side", () => {
    expect(readRivalFailure(notFound, { kind: "exists" }).reason).toBe("picks-not-set");
  });

  it("calls our own pause by its name rather than blaming FPL", () => {
    // FPL was not asked; we declined to ask. "FPL didn't answer" was wrong.
    const r = readRivalFailure(new BreakerOpenError());
    expect(r.reason).toBe("upstream-busy");
  });

  it("does not probe on a non-404 — that is our failure, not their id", () => {
    expect(readRivalFailure(new FplHttpError(500, "/x"), { kind: "missing" }).reason).toBe("upstream");
  });

  it("carries a description for every upstream case", () => {
    for (const err of [new FplHttpError(429, "/x"), new FplSchemaError("/x", []), new Error("boom")]) {
      const r = readRivalFailure(err);
      expect(r.reason).toBe("upstream");
      expect(r.detail && r.detail.length).toBeGreaterThan(0);
    }
  });
});

describe("describeFailure", () => {
  it("names a status without leaking the path, which carries the entry id", () => {
    expect(describeFailure(new FplHttpError(502, "/entry/4143072/"))).toBe("FPL returned 502");
  });

  it("reads a timeout as a timeout", () => {
    expect(describeFailure(Object.assign(new Error("aborted"), { name: "TimeoutError" }))).toBe("FPL timed out");
    expect(describeFailure(new Error("cache cold-miss timeout for fpl:picks:1:2"))).toBe("FPL timed out");
  });

  it("falls back rather than printing an unknown throw", () => {
    expect(describeFailure({ weird: true })).toBe("The request to FPL failed");
    expect(describeFailure(undefined)).toBe("The request to FPL failed");
  });
});
