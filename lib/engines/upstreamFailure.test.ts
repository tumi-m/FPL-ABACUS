import { describe, expect, it } from "vitest";
import { describeFailure, readUpstreamFailure } from "@/lib/engines/upstreamFailure";
import { FplHttpError, FplSchemaError } from "@/lib/fpl/client";
import { BreakerOpenError } from "@/lib/cache/breaker";

describe("readUpstreamFailure", () => {
  it("does not offer a retry for something retrying cannot fix", () => {
    // The bug this replaces: "FPL may be busy. Try again shortly" was printed
    // for a mistyped league id, so the advice on screen was an infinite loop.
    expect(readUpstreamFailure(new FplHttpError(404, "/leagues-classic/1/")).retryable).toBe(false);
    expect(readUpstreamFailure(new FplHttpError(403, "/x")).retryable).toBe(false);
    expect(readUpstreamFailure(new FplSchemaError("/x", [])).retryable).toBe(false);
    expect(readUpstreamFailure(new BreakerOpenError()).retryable).toBe(false);
  });

  it("does offer one when the fault is transient", () => {
    expect(readUpstreamFailure(new FplHttpError(503, "/x")).retryable).toBe(true);
    expect(readUpstreamFailure(new FplHttpError(429, "/x")).retryable).toBe(true);
    expect(readUpstreamFailure(new Error("nope")).retryable).toBe(true);
  });

  it("names the subject on a 404 so the reader knows what to re-check", () => {
    const r = readUpstreamFailure(new FplHttpError(404, "/leagues-classic/99/"), "league 99");
    expect(r.kind).toBe("not-found");
    expect(r.title).toContain("league 99");
  });

  it("calls our own pause ours, and says a reload cannot hurry it", () => {
    const r = readUpstreamFailure(new BreakerOpenError());
    expect(r.kind).toBe("paused");
    expect(r.body).toMatch(/won't hurry it/);
  });

  it("never claims FPL is busy when it has not been asked", () => {
    // Every non-server case must avoid the old guess.
    for (const err of [
      new FplHttpError(404, "/x"),
      new FplHttpError(403, "/x"),
      new FplSchemaError("/x", []),
      new BreakerOpenError(),
    ]) {
      expect(`${readUpstreamFailure(err).title} ${readUpstreamFailure(err).body}`).not.toMatch(/busy/i);
    }
  });

  it("separates a timeout from a server error", () => {
    expect(readUpstreamFailure(Object.assign(new Error("x"), { name: "TimeoutError" })).kind).toBe("timeout");
    expect(readUpstreamFailure(new Error("cache cold-miss timeout for k")).kind).toBe("timeout");
    expect(readUpstreamFailure(new FplHttpError(500, "/x")).kind).toBe("server");
  });

  it("always produces a title, whatever was thrown", () => {
    for (const err of [undefined, null, "a string", { weird: true }, new Error("")]) {
      expect(readUpstreamFailure(err).title.length).toBeGreaterThan(0);
    }
  });
});

describe("describeFailure", () => {
  it("names a status without leaking the path, which carries the id", () => {
    expect(describeFailure(new FplHttpError(502, "/entry/4143072/"))).toBe("FPL returned 502");
  });

  it("falls back rather than printing an unknown throw", () => {
    expect(describeFailure({ weird: true })).toBe("The request to FPL failed");
  });
});
