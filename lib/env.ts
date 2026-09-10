import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  /*
   * Who we say we are when we call FPL.
   *
   * The default pointed at https://gaffer.app — a domain nobody here owns and
   * which does not resolve. That is a poor thing to be sending an upstream
   * that has already refused us once this week: an unreachable contact URL is
   * exactly the shape of a scraper, and it gives whoever is looking at their
   * logs no way to reach us before reaching for a block instead.
   *
   * Written out rather than derived from `siteUrl()`, unlike everything else
   * that mentions the domain. This is a courtesy identifier a third party
   * reads in a log, so it wants to be one stable string, not something that
   * silently becomes "localhost:3000" on a developer's machine.
   */
  FPL_USER_AGENT: z.string().min(1).default("GAFFER/1.0 (+https://fplgaffers.com)"),
  /*
   * Declared for validation, read in `lib/siteUrl.ts` off process.env directly
   * — that resolver runs in metadata and build contexts that do not import
   * this module. Optional: on Vercel the production domain is already known
   * from VERCEL_PROJECT_PRODUCTION_URL, so this is only for a self-host or a
   * staging domain that should speak for itself.
   *
   * Replaces NEXT_PUBLIC_APP_URL, which was declared here, defaulted to
   * localhost, and read by nothing at all.
   */
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
export const hasRedis = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
export const hasDb = Boolean(env.DATABASE_URL);

let cachedUserAgent: string | null = null;
export function fplUserAgent(): string {
  if (cachedUserAgent === null) cachedUserAgent = env.FPL_USER_AGENT;
  return cachedUserAgent;
}
