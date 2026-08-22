import { NextRequest } from "next/server";
import { env } from "@/lib/env";

export function cronGuard(req: NextRequest): Response | null {
  if (!env.CRON_SECRET) return null; // dev convenience: unguarded locally
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  return null;
}
