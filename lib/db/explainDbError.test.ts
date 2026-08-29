import { describe, expect, it } from "vitest";
import { explainDbError } from "@/lib/db";

/**
 * The failure this exists for: DATABASE_URL set, reachable, and pointed at a
 * database that has never had the schema applied. Every cron then 502s for
 * ever with a message that names a relation and no remedy.
 */
describe("explainDbError", () => {
  it("names the migration when a table is missing, by SQLSTATE", () => {
    const err = Object.assign(new Error('relation "cohort_snapshot" does not exist'), {
      code: "42P01",
    });
    expect(explainDbError(err)).toContain("pnpm db:migrate");
    // and still says which relation, so it is a diagnosis rather than a slogan
    expect(explainDbError(err)).toContain("cohort_snapshot");
  });

  it("recognises the same failure when the driver drops the code", () => {
    const err = new Error('relation "price_snapshot" does not exist');
    expect(explainDbError(err)).toContain("pnpm db:migrate");
  });

  it("leaves an unrelated database error exactly as it was", () => {
    const err = Object.assign(new Error("connection terminated unexpectedly"), { code: "57P01" });
    expect(explainDbError(err)).toBe("connection terminated unexpectedly");
  });

  it("does not invent a migration for a message that merely mentions a relation", () => {
    expect(explainDbError(new Error("no relation between xG and luck"))).not.toContain(
      "db:migrate",
    );
  });

  it("survives being handed something that is not an Error", () => {
    expect(explainDbError("boom")).toBe("boom");
    expect(explainDbError(null)).toBe("null");
  });
});
