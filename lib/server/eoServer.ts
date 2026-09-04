import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dbRead } from "@/lib/db/read";
import { cohortOwnership, cohortSnapshot } from "@/lib/db/schema";
import { cached } from "@/lib/cache/swr";
import { COHORT_ID } from "@/lib/server/cohortBuilder";

export interface CohortEO {
  cohort: string;
  sampleSize: number;
  eo: Map<number, number>;
}

/**
 * Latest sampled cohort EO for a gameweek, or null (no DB / no snapshot yet).
 * Short-TTL cached so every poll doesn't re-query Postgres; the selects go
 * through `dbRead` so an unmigrated schema is an honest null, not a throw.
 */
export const getCohortEO = (gw: number) =>
  cached<CohortEO | null>(`gaffer:eoco:${gw}`, "live", async (): Promise<CohortEO | null> => {
    const snap = await dbRead(
      "cohortEO:snapshot",
      () => null,
      async () => {
        const [row] = await db()
          .select({ id: cohortSnapshot.id, cohort: cohortSnapshot.cohort, sampleSize: cohortSnapshot.sampleSize })
          .from(cohortSnapshot)
          .where(eq(cohortSnapshot.event, gw))
          .orderBy(desc(cohortSnapshot.builtAt))
          .limit(1);
        return row ?? null;
      },
    );
    if (!snap) return null;

    const rows = await dbRead(
      "cohortEO:ownership",
      () => [] as { element: number; eo: number }[],
      () =>
        db()
          .select({ element: cohortOwnership.element, eo: cohortOwnership.eo })
          .from(cohortOwnership)
          .where(eq(cohortOwnership.snapshotId, snap.id)),
    );

    if (rows.length === 0) return null;
    return {
      cohort: snap.cohort || COHORT_ID,
      sampleSize: snap.sampleSize,
      eo: new Map(rows.map((r) => [r.element, r.eo])),
    };
  });
