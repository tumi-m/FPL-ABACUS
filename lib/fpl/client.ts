import { z } from "zod";
import { fplUserAgent } from "@/lib/env";

/**
 * Upstream base. Overridable so a local mirror can stand in for the real API
 * during development and offline verification; production leaves it unset.
 */
export const FPL_BASE = process.env.FPL_API_BASE ?? "https://fantasy.premierleague.com/api";

export class FplHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
  ) {
    super(`FPL ${status} on ${path}`);
    this.name = "FplHttpError";
  }
}

export class FplSchemaError extends Error {
  constructor(
    public readonly path: string,
    public readonly issues: z.ZodError["issues"],
  ) {
    super(`FPL schema mismatch on ${path}: ${issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    this.name = "FplSchemaError";
  }
}

export interface FetchOpts {
  timeoutMs?: number;
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/*
 * The schema's input type is deliberately left open. What comes back from FPL
 * is untrusted JSON, and a schema that fills in defaults for fields FPL may
 * rename has an input type that differs from its output — the narrower
 * `z.ZodType<T>` insists the two match, which quietly rules out exactly the
 * resilience the parsing needs.
 */
export async function fplFetch<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  opts: FetchOpts = {},
): Promise<T> {
  const maxRetries = opts.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${FPL_BASE}${path}`, {
        headers: {
          "User-Agent": fplUserAgent(),
          Accept: "application/json",
          "Accept-Language": "en-GB,en;q=0.9",
        },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new FplHttpError(res.status, path);
        }
        throw new FplHttpError(res.status, path);
      }
      const json: unknown = await res.json();
      const parsed = schema.safeParse(json);
      if (!parsed.success) throw new FplSchemaError(path, parsed.error.issues);
      return parsed.data;
    } catch (err) {
      lastError = err;
      const retryable =
        err instanceof FplHttpError ? (err.status >= 500 || err.status === 429) : !(err instanceof FplSchemaError);
      if (!retryable || attempt === maxRetries) break;
      await sleep(attempt === 0 ? 250 + Math.random() * 150 : 900 + Math.random() * 300);
    }
  }
  throw lastError;
}
