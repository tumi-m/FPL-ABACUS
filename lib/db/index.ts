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
