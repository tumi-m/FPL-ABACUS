import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

export type Db = PostgresJsDatabase<typeof schema>;

let client: Db | null = null;

/**
 * Lazy singleton over postgres.js. Works with Neon (TCP), Supabase (pooler)
 * and any vanilla Postgres. `prepare: false` keeps it compatible with
 * transaction-mode poolers. Throws when DATABASE_URL is absent — callers
 * must gate on `hasDb` first.
 */
export function db(): Db {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not configured");
  if (client === null) {
    const sql = postgres(url, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 8,
      prepare: false,
    });
    client = drizzle(sql, { schema });
  }
  return client;
}

/**
 * Turn a Postgres error into something a person can act on.
 *
 * The one that matters here is 42P01, undefined_table: it means DATABASE_URL
 * is set and reachable but the schema was never applied, which is a deployment
 * step rather than a server fault and stays broken until somebody runs the
 * migration. Left raw it reads as an opaque 502 for ever; named, it tells you
 * the command.
 */
export function explainDbError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string } | null)?.code;
  if (code === "42P01" || /relation ".*" does not exist/i.test(message)) {
    return `${message} — the database has no schema yet: run \`pnpm db:migrate\` against DATABASE_URL`;
  }
  return message;
}
