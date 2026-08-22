import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  FPL_USER_AGENT: z.string().min(1).default("GAFFER/1.0 (+https://gaffer.app)"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
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
