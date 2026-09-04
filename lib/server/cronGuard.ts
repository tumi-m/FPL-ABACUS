import { NextRequest } from "next/server";
import { env, hasRedis } from "@/lib/env";

let warned = false;
let writeWarned = false;

export function cronGuard(req: NextRequest): Response | null {
  if (!env.CRON_SECRET) {
    if (process.env.NODE_ENV === "production" && !warned) {
      warned = true;
      console.warn(
        `[gaffer] CRON_SECRET is not set — /api/cron/* endpoints are unauthenticated. ` +
          `Set it in production${hasRedis ? "" : " (Upstash is also missing: cron state resets on cold starts)"}.`,
      );
    }
    return null; // dev convenience: unguarded locally
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  return null;
}

/**
 * Guard for the endpoints that WRITE to Postgres (`/api/cron/finalise`,
 * `/api/cron/price`).
 *
 * Reads degrading when CRON_SECRET is missing is one thing — the data comes
 * back on the next tick. Accepting unauthenticated writes is another: anyone
 * who finds the URL could archive arbitrary gameweeks or pollute the price
 * ledger. So unlike `cronGuard`, this fails CLOSED in production: no secret,
 * no write. Local development keeps the open door.
 */
export function cronWriteGuard(req: NextRequest): Response | null {
  if (process.env.NODE_ENV === "production" && !env.CRON_SECRET) {
    if (!writeWarned) {
      writeWarned = true;
      console.error(
        "[gaffer] CRON_SECRET is not set — refusing unauthenticated database writes. " +
          "Set CRON_SECRET in production to re-enable the write crons.",
      );
    }
    return new Response("write crons require CRON_SECRET in production", { status: 503 });
  }
  return cronGuard(req);
}
