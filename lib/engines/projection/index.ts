import type { PlayerProjection } from "@/lib/engines/projection/ts";
import type { ProjectionContext } from "@/lib/engines/projection/ts";
import { projectPlayer } from "@/lib/engines/projection/ts";

export type { PlayerProjection, ProjectionContext };

/**
 * The swappable seam. A future RemoteProjectionEngine can call a Python
 * service without any component changing.
 */
export interface ProjectionEngine {
  playerGw(ctx: ProjectionContext, gw: number, scoring: { goals: Record<number, number>; cleanSheet: Record<number, number>; assist: number }): Promise<PlayerProjection>;
}

export class TsProjectionEngine implements ProjectionEngine {
  async playerGw(
    ctx: ProjectionContext,
    gw: number,
    scoring: { goals: Record<number, number>; cleanSheet: Record<number, number>; assist: number },
  ): Promise<PlayerProjection> {
    const proj = projectPlayer(ctx, scoring);
    proj.gw = gw;
    return proj;
  }
}
