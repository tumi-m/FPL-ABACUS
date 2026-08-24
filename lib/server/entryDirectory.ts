import "server-only";

/**
 * Entry directory — the managers Gaffer has actually seen. Populated from
 * league standings pages (gate pastes and cohort sweeps) and entry
 * confirmations; powers the gate's team-name / manager-name search.
 */
import { db } from "@/lib/db";
import { hasDb } from "@/lib/env";
import { entryDirectory } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export interface DirectoryRow {
  entry: number;
  teamName: string;
  managerName: string;
  rank: number | null;
}

/** Upsert seen managers — newest wins for non-empty names, rank sticks once seen. */
export async function rememberEntries(rows: DirectoryRow[], source: string): Promise<void> {
  const clean = rows.filter((r) => Number.isFinite(r.entry) && r.entry > 0 && r.teamName.trim().length > 0);
  if (!hasDb || clean.length === 0) return;
  for (let i = 0; i < clean.length; i += 200) {
    await db()
      .insert(entryDirectory)
      .values(
        clean.slice(i, i + 200).map((r) => ({
          entry: r.entry,
          teamName: r.teamName.slice(0, 160),
          managerName: r.managerName.slice(0, 160),
          rank: r.rank,
          source,
        })),
      )
      .onConflictDoUpdate({
        target: entryDirectory.entry,
        set: {
          teamName: sql`CASE WHEN excluded.team_name = '' THEN ${entryDirectory.teamName} ELSE excluded.team_name END`,
          managerName: sql`CASE WHEN excluded.manager_name = '' THEN ${entryDirectory.managerName} ELSE excluded.manager_name END`,
          rank: sql`COALESCE(excluded.rank, ${entryDirectory.rank})`,
          source: sql`excluded.source`,
          seenAt: new Date(),
        },
      });
  }
}

/** Name → entry ids. Mode picks the column; rank orders the best to the top. */
export async function searchEntries(
  q: string,
  mode: "team" | "manager",
  limit = 20,
): Promise<DirectoryRow[]> {
  if (!hasDb) return [];
  const needle = `%${q.replace(/([%_\\])/g, "\\$1")}%`;
  const column = mode === "team" ? entryDirectory.teamName : entryDirectory.managerName;
  const rows = await db()
    .select({
      entry: entryDirectory.entry,
      teamName: entryDirectory.teamName,
      managerName: entryDirectory.managerName,
      rank: entryDirectory.rank,
    })
    .from(entryDirectory)
    .where(sql`${column} ilike ${needle}`)
    .orderBy(sql`${entryDirectory.rank} asc nulls last`, sql`${entryDirectory.seenAt} desc`)
    .limit(limit);
  return rows;
}
