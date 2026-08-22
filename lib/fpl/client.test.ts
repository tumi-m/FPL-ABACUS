import { describe, expect, it, vi, afterEach } from "vitest";
import { fplFetch, FplHttpError } from "@/lib/fpl/client";
import { z } from "zod";

const schema = z.object({ ok: z.boolean() });

function mockFetchOnce(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fplFetch", () => {
  it("retries on 5xx and succeeds", async () => {
    const responses = [mockFetchOnce(500, {}), mockFetchOnce(502, {}), mockFetchOnce(200, { ok: true })];
    const spy = vi.fn(() => Promise.resolve(responses.shift() ?? mockFetchOnce(200, { ok: true })));
    vi.stubGlobal("fetch", spy);

    const result = await fplFetch("/test/", schema);
    expect(result).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("does not retry on 404", async () => {
    const spy = vi.fn(() => Promise.resolve(mockFetchOnce(404, {})));
    vi.stubGlobal("fetch", spy);

    await expect(fplFetch("/missing/", schema)).rejects.toThrow(FplHttpError);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("throws FplHttpError after exhausting retries", async () => {
    const spy = vi.fn(() => Promise.resolve(mockFetchOnce(503, {})));
    vi.stubGlobal("fetch", spy);

    await expect(fplFetch("/down/", schema, { retries: 1 })).rejects.toThrow(FplHttpError);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
