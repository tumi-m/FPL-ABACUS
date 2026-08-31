import { describe, expect, it } from "vitest";
import { explainDbError, isMissingSchema } from "@/lib/db";

/** postgres.js surfaces SQLSTATE on the error object. */
const pgError = (code: string, message: string) => Object.assign(new Error(message), { code });

describe("isMissingSchema", () => {
  it("recognises SQLSTATE 42P01", () => {
    expect(isMissingSchema(pgError("42P01", 'relation "cohort_snapshot" does not exist'))).toBe(true);
  });

  it("recognises the message alone, for drivers that drop the code", () => {
    expect(isMissingSchema(new Error('relation "price_snapshot" does not exist'))).toBe(true);
  });

  it("does not swallow a real outage", () => {
    // This is the line between "skip quietly" and "wake somebody up": anything
    // that could be transient must stay a failure, or the daily check becomes
    // the only thing watching production.
    expect(isMissingSchema(pgError("57P01", "terminating connection due to administrator command"))).toBe(false);
    expect(isMissingSchema(pgError("53300", "too many connections"))).toBe(false);
    expect(isMissingSchema(pgError("28P01", "password authentication failed"))).toBe(false);
    expect(isMissingSchema(new Error("connect ETIMEDOUT"))).toBe(false);
    expect(isMissingSchema(new Error("fetch failed"))).toBe(false);
  });

  it("does not fire on a missing column, which migrate may not fix", () => {
    expect(isMissingSchema(pgError("42703", 'column "xgi" does not exist'))).toBe(false);
  });

  it("is safe on anything at all", () => {
    for (const v of [null, undefined, "", 0, { code: 42 }, []]) {
      expect(isMissingSchema(v)).toBe(false);
    }
  });
});

describe("explainDbError", () => {
  it("appends the remedy for a missing schema", () => {
    const msg = explainDbError(pgError("42P01", 'relation "cohort_snapshot" does not exist'));
    expect(msg).toContain("pnpm db:migrate");
  });

  it("leaves any other error alone", () => {
    expect(explainDbError(new Error("too many connections"))).toBe("too many connections");
  });
});
