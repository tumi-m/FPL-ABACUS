import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
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
 * Short-TTL cached so every poll doesn't re-query Postgres.
 */
export const getCohortEO = (gw: number) =>
  cached<CohortEO | null>(`gaffer:eoco:${gw}`, "live", async (): Promise<CohortEO | null> => {
    try {
      const [snap] = await db()
        .select({ id: cohortSnapshot.id, cohort: cohortSnapshot.cohort, sampleSize: cohortSnapshot.sampleSize })
        .from(cohortSnapshot)
        .where(eq(cohortSnapshot.event, gw))
        .orderBy(desc(cohortSnapshot.builtAt))
        .limit(1);
      if (!snap) return null;

      const rows = await db()
        .select({ element: cohortOwnership.element, eo: cohortOwnership.eo })
        .from(cohortOwnership)
        .where(eq(cohortOwnership.snapshotId, snap.id));

      if (rows.length === 0) return null;
      return {
        cohort: snap.cohort || COHORT_ID,
        sampleSize: snap.sampleSize,
        eo: new Map(rows.map((r) => [r.element, r.eo])),
      };
    } catch {
      // DB hiccup must never break the matchday pipeline — fall back to estimated.
      return null;
    }
  });
