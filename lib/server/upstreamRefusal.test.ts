import { describe, expect, it } from "vitest";
import { fplRefusal } from "@/lib/server/upstreamRefusal";
import { BreakerOpenError } from "@/lib/cache/breaker";
import { FplHttpError, FplSchemaError } from "@/lib/fpl/client";

describe("fplRefusal", () => {
  it("names the 403 that took the scheduler red", () => {
    // The exact failure: FPL answered 403 on a path with no parameters in it,
    // so there was nothing we could have asked wrong.
    expect(fplRefusal(new FplHttpError(403, "/bootstrap-static/"))).toBe(
      "FPL 403 on /bootstrap-static/",
    );
  });

  it("counts being rate-limited and being down", () => {
    expect(fplRefusal(new FplHttpError(429, "/fixtures/"))).toContain("429");
    expect(fplRefusal(new FplHttpError(503, "/fixtures/"))).toContain("503");
  });

  it("counts an open breaker — the request never left the building", () => {
    expect(fplRefusal(new BreakerOpenError())).toContain("breaker");
  });

  it("counts a network fault reaching them", () => {
    expect(fplRefusal(new TypeError("fetch failed"))).toContain("unreachable");
  });

  it("refuses to blame FPL for our own bug", () => {
    // The whole point of the default. A crash in our code that got called an
    // outage goes unreported for as long as it lasts.
    expect(fplRefusal(new Error("Cannot read properties of undefined"))).toBeNull();
    expect(fplRefusal(new TypeError("x.map is not a function"))).toBeNull();
    expect(fplRefusal(null)).toBeNull();
  });

  it("refuses to blame FPL for a payload that stopped matching", () => {
    // Schema drift is somebody's homework, not weather. No retry fixes it and
    // waiting it out means shipping wrong numbers in the meantime.
    expect(fplRefusal(new FplSchemaError("/bootstrap-static/", []))).toBeNull();
  });
});
