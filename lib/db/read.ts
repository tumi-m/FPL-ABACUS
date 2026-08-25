/**
 * Safe reads.
 *
 * Every stored-data feature in the app is an enhancement over something that
 * already works without a database — price history sharpens the rise model,
 * the entry directory adds name search, the news store adds links. So a read
 * that cannot be served is never an error the user should see: it is simply
 * an absence, and the caller already knows how to say so honestly.
 *
 * `hasDb` alone was not a sufficient guard. A `DATABASE_URL` can be set while
 * the schema has never been applied — that is exactly what happens on a fresh
 * deploy before `pnpm db:migrate` — and Postgres then answers `relation
 * "price_change" does not exist`, which used to escape all the way into the
 * ask console. This wraps the read, hands back the caller's empty value, and
 * logs the real cause once per call site so the operator learns what to fix.
 */
import { hasDb } from "@/lib/env";

/** Postgres `undefined_table` — the schema has not been migrated. */
export const UNDEFINED_TABLE = "42P01";
/** Postgres `undefined_column` — the schema is behind the code. */
export const UNDEFINED_COLUMN = "42703";

export type DbReadFailure = "no-database" | "schema-missing" | "unavailable";

function codeOf(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Why a read could not be served — the operator-facing distinction between
 * "you never set this up", "you set it up but never migrated" and
 * "the database is there but the query failed".
 */
export function classifyDbError(err: unknown): DbReadFailure {
  const code = codeOf(err);
  if (code === UNDEFINED_TABLE || code === UNDEFINED_COLUMN) return "schema-missing";
  const message = err instanceof Error ? err.message : String(err);
  if (/relation .* does not exist|column .* does not exist/i.test(message)) return "schema-missing";
  return "unavailable";
}

/** The line an operator needs to see to fix it, or null when nothing is wrong. */
export function dbFailureAdvice(kind: DbReadFailure, label: string): string | null {
  switch (kind) {
    case "schema-missing":
      return `[db] ${label}: the schema is not applied to DATABASE_URL — run \`pnpm db:migrate\`. Serving without stored data until then.`;
    case "unavailable":
      return `[db] ${label}: read failed, serving without stored data.`;
    case "no-database":
      return null;
  }
}

const warned = new Set<string>();

/** Log each distinct problem once per process — a broken table would otherwise
 *  print on every request and bury everything else. */
function warnOnce(label: string, kind: DbReadFailure, err: unknown): void {
  const key = `${label}:${kind}`;
  if (warned.has(key)) return;
  warned.add(key);
  const advice = dbFailureAdvice(kind, label);
  if (advice) console.warn(advice, err instanceof Error ? err.message : err);
}

/** Test seam — the warn-once memory is process-global by design. */
export function resetDbReadWarnings(): void {
  warned.clear();
}

/**
 * Run a stored-data read, or hand back `fallback`.
 *
 * `fallback` is evaluated lazily so callers can pass a fresh empty Map or
 * array without allocating one on the happy path.
 */
export async function dbRead<T>(
  label: string,
  fallback: () => T,
  run: () => Promise<T>,
): Promise<T> {
  if (!hasDb) return fallback();
  try {
    return await run();
  } catch (err) {
    warnOnce(label, classifyDbError(err), err);
    return fallback();
  }
}
