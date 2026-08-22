import { NextRequest } from "next/server";
import { env, hasRedis } from "@/lib/env";

let warned = false;

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
