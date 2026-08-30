import { describe, expect, it, beforeEach } from "vitest";
import { cached } from "@/lib/cache/swr";
import { breakerOpen } from "@/lib/cache/breaker";
import { MemoryStore, setCacheStore } from "@/lib/cache/store";
import { FplHttpError, FplSchemaError } from "@/lib/fpl/client";

/**
 * What is allowed to take the whole app off upstream.
 *
 * The breaker is global, and in production it lives in Redis — so it is shared
 * across every instance and every user. Whatever trips it trips it for
 * everybody, which makes "what counts as a failure" a question about blast
 * radius rather than about one request.
 */

/** Five is the threshold; this is enough to cross it if the errors count. */
async function hammer(err: () => unknown, times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await cached(`k${i}`, 60, async () => {
      throw err();
    }).catch(() => {});
  }
}

describe("what counts as FPL being down", () => {
  beforeEach(() => setCacheStore(new MemoryStore()));

  it("a mistyped entry id does not take the app off upstream", async () => {
    // The bug: eight compares against ids that do not exist opened the global
    // breaker, so bootstrap, live and fixtures stopped for everyone for a
    // minute — and the compare box told the user to press the button again.
    await hammer(() => new FplHttpError(404, "/entry/4143072/event/2/picks/"));
    expect(await breakerOpen()).toBe(false);
  });

  it("neither does any other request-shaped 4xx", async () => {
    await hammer(() => new FplHttpError(400, "/entry/0/"));
    expect(await breakerOpen()).toBe(false);
    await hammer(() => new FplHttpError(403, "/entry/1/"));
    expect(await breakerOpen()).toBe(false);
  });

  it("a schema mismatch does not, because retrying cannot fix it", async () => {
    await hammer(() => new FplSchemaError("/bootstrap-static/", []));
    expect(await breakerOpen()).toBe(false);
  });

  it("but rate limiting does — that is the upstream asking us to stop", async () => {
    await hammer(() => new FplHttpError(429, "/bootstrap-static/"));
    expect(await breakerOpen()).toBe(true);
  });

  it("and so does a 5xx", async () => {
    await hammer(() => new FplHttpError(503, "/bootstrap-static/"));
    expect(await breakerOpen()).toBe(true);
  });

  it("and so does a timeout, which arrives as a plain Error", async () => {
    await hammer(() => Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" }));
    expect(await breakerOpen()).toBe(true);
  });

  it("a few 404s mixed into healthy traffic leave the breaker shut", async () => {
    // Success resets the counter, so this only holds because 404s never
    // incremented it in the first place.
    for (let i = 0; i < 10; i++) {
      await cached(`miss${i}`, 60, async () => {
        throw new FplHttpError(404, "/entry/x/event/2/picks/");
      }).catch(() => {});
      await cached(`hit${i}`, 60, async () => ({ ok: true }));
    }
    expect(await breakerOpen()).toBe(false);
  });
});
