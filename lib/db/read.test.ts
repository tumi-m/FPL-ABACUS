import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyDbError, dbFailureAdvice } from "@/lib/db/read";

/** postgres.js surfaces the SQLSTATE on the error object. */
function pgError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

describe("classifyDbError", () => {
  it("recognises an unmigrated schema by SQLSTATE", () => {
    // The exact failure a fresh deploy hits before `pnpm db:migrate`.
    expect(classifyDbError(pgError("42P01", 'relation "price_change" does not exist'))).toBe(
      "schema-missing",
    );
    expect(classifyDbError(pgError("42703", 'column "match_id" does not exist'))).toBe(
      "schema-missing",
    );
  });

  it("recognises it from the message when no code survives the driver", () => {
    expect(classifyDbError(new Error('relation "price_snapshot" does not exist'))).toBe(
      "schema-missing",
    );
  });

  it("calls anything else unavailable", () => {
    expect(classifyDbError(pgError("57P01", "terminating connection"))).toBe("unavailable");
    expect(classifyDbError(new Error("connect ETIMEDOUT"))).toBe("unavailable");
    expect(classifyDbError("something odd")).toBe("unavailable");
    expect(classifyDbError(null)).toBe("unavailable");
  });
});

describe("dbFailureAdvice", () => {
  it("names the fix when the schema was never applied", () => {
    const advice = dbFailureAdvice("schema-missing", "price snapshots");
    expect(advice).toContain("pnpm db:migrate");
    expect(advice).toContain("price snapshots");
  });

  it("stays quiet when there is simply no database configured", () => {
    expect(dbFailureAdvice("no-database", "price snapshots")).toBeNull();
  });

  it("says a read failed without prescribing a migration", () => {
    const advice = dbFailureAdvice("unavailable", "news items");
    expect(advice).toContain("news items");
    expect(advice).not.toContain("db:migrate");
  });
});

describe("dbRead", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  /** `hasDb` is read at module load, so each case needs a fresh module graph. */
  async function loadWithDb(url?: string) {
    vi.resetModules();
    // An empty string would fail env validation — "no database" means absent.
    vi.stubEnv("DATABASE_URL", url as string);
    return import("@/lib/db/read");
  }

  it("skips the read entirely with no database configured", async () => {
    const { dbRead } = await loadWithDb(undefined);
    const run = vi.fn(async () => "live");
    await expect(dbRead("t", () => "empty", run)).resolves.toBe("empty");
    expect(run).not.toHaveBeenCalled();
  });

  it("returns the read when it succeeds", async () => {
    const { dbRead } = await loadWithDb("postgres://localhost/x");
    await expect(dbRead("t", () => "empty", async () => "live")).resolves.toBe("live");
  });

  it("degrades to the fallback when the table is missing", async () => {
    const { dbRead } = await loadWithDb("postgres://localhost/x");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = await dbRead("price snapshots", () => [] as number[], async () => {
      throw pgError("42P01", 'relation "price_change" does not exist');
    });
    expect(rows).toEqual([]);
  });

  it("degrades on any other failure too", async () => {
    const { dbRead } = await loadWithDb("postgres://localhost/x");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const map = await dbRead("t", () => new Map<number, string>(), async () => {
      throw new Error("connect ETIMEDOUT");
    });
    expect(map.size).toBe(0);
  });

  it("warns once per call site, not once per request", async () => {
    const { dbRead } = await loadWithDb("postgres://localhost/x");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const boom = async () => {
      throw pgError("42P01", 'relation "price_change" does not exist');
    };
    for (let i = 0; i < 5; i++) await dbRead("price snapshots", () => null, boom);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("pnpm db:migrate");
  });

  it("builds the fallback lazily so callers can hand back fresh collections", async () => {
    const { dbRead } = await loadWithDb(undefined);
    const a = await dbRead("t", () => new Map<number, string>(), async () => new Map());
    const b = await dbRead("t", () => new Map<number, string>(), async () => new Map());
    a.set(1, "only mine");
    expect(b.size).toBe(0);
  });
});
