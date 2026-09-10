import { afterEach, describe, expect, it } from "vitest";
import { siteUrl } from "@/lib/siteUrl";

const KEYS = ["NEXT_PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const only = (key: (typeof KEYS)[number], value: string) => {
  for (const k of KEYS) delete process.env[k];
  process.env[key] = value;
};

describe("siteUrl", () => {
  it("prefers an explicit answer", () => {
    only("NEXT_PUBLIC_SITE_URL", "https://staging.example");
    expect(siteUrl()).toBe("https://staging.example");
  });

  it("adds the protocol Vercel's variable leaves off", () => {
    only("VERCEL_PROJECT_PRODUCTION_URL", "fplgaffers.com");
    expect(siteUrl()).toBe("https://fplgaffers.com");
  });

  it("drops a trailing slash, which new URL() will not forgive", () => {
    only("NEXT_PUBLIC_SITE_URL", "https://fplgaffers.com/");
    expect(siteUrl()).toBe("https://fplgaffers.com");
    expect(() => new URL(siteUrl())).not.toThrow();
  });

  it("falls back to localhost with nothing set", () => {
    for (const k of KEYS) delete process.env[k];
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("never returns the per-deployment URL", () => {
    // VERCEL_URL changes on every push. A canonical that stops existing, and
    // a social card pointing at a dead deploy, are the two things this
    // resolver exists to avoid — so it must not be consulted even when it is
    // the only thing set.
    for (const k of KEYS) delete process.env[k];
    process.env.VERCEL_URL = "fpl-gaffers-abc123-tumi.vercel.app";
    expect(siteUrl()).toBe("http://localhost:3000");
    delete process.env.VERCEL_URL;
  });
});
