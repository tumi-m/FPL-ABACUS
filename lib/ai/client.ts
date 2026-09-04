import "server-only";

/**
 * Client for the hosted Ollama gateway (ollama.com) — NATIVE API.
 *   Base   https://ollama.com
 *   Chat   POST /api/chat        { model, messages, stream:false } → { message:{content} }
 *   Auth   Authorization: Bearer $OLLAMA_API_KEY
 * Trust rule (v2 §9 / v3 §Honesty): the model selects components and parameters
 * ONLY. Every number rendered comes from our engines via the resolver.
 *
 * Env (canonical — matches Vercel + GitHub):
 *   OLLAMA_API_KEY   bearer token (set on Vercel + GitHub)
 *   OLLAMA_BASE_URL  defaults to https://ollama.com
 *   OLLAMA_MODEL     gateway model id (exact string from the provider)
 * Legacy alias (deprecated, warns once): LLM_API_KEY / LLM_BASE_URL / LLM_MODEL.
 */

function pick(env: Record<string, string | undefined>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

let warnedLegacyAlias = false;

/**
 * Resolve the gateway config. OLLAMA_* wins; LLM_* is a deprecated fallback
 * for anyone who followed the v2 spec doc (which named them LLM_*).
 */
export function resolveAiEnv(env: Record<string, string | undefined> = process.env): {
  baseUrl: string;
  model: string;
  apiKey: string;
} {
  if (pick(env, "LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY") !== undefined && !warnedLegacyAlias) {
    warnedLegacyAlias = true;
    console.warn("[gaffer] LLM_* env vars are deprecated — rename them to OLLAMA_*; the alias will be removed.");
  }
  return {
    baseUrl: (pick(env, "OLLAMA_BASE_URL", "LLM_BASE_URL") ?? "https://ollama.com").replace(/\/+$/, ""),
    model: pick(env, "OLLAMA_MODEL", "LLM_MODEL") ?? "deepseek-v4-flash:0731",
    apiKey: pick(env, "OLLAMA_API_KEY", "LLM_API_KEY") ?? "",
  };
}

const AI_ENV = resolveAiEnv();
const BASE_URL = AI_ENV.baseUrl;
/** Default gateway model; override with OLLAMA_MODEL. List: GET /api/tags */
const MODEL = AI_ENV.model;
const API_KEY = AI_ENV.apiKey;

export function aiEnabled(): boolean {
  return Boolean(API_KEY);
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  /** Ask the gateway for a JSON object back. */
  json?: boolean;
  /** Hard timeout — selection calls must stay snappy (4s per spec §9.5). */
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}

export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  if (!aiEnabled()) throw new Error("AI disabled — set OLLAMA_API_KEY and OLLAMA_MODEL");

  // Never log or leak the key; only its presence matters here.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8_000);
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        ...(opts.json ? { format: "json" as const } : {}),
        options: {
          temperature: opts.temperature ?? 0.2,
          num_predict: opts.maxTokens ?? 400,
        },
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ollama ${res.status}`);
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content?.trim() ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The same call, streamed.
 *
 * The gaffer's line took twelve seconds to arrive as one block, which reads as
 * a hang rather than as thinking. Ollama answers `stream:true` as NDJSON, one
 * `{message:{content}}` per token, so the caller can show it arriving.
 *
 * `onDelta` is handed raw model text and must not put it on screen unchecked —
 * the caller is responsible for holding it back until it has been verified
 * against the facts (see verifyFigures). Streaming changes when text appears,
 * never whether it was checked.
 */
export async function chatStream(
  messages: ChatMessage[],
  opts: ChatOptions,
  onDelta: (chunk: string) => void | Promise<void>,
): Promise<string> {
  if (!aiEnabled()) throw new Error("AI disabled — set OLLAMA_API_KEY and OLLAMA_MODEL");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  let full = "";
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        options: {
          temperature: opts.temperature ?? 0.2,
          num_predict: opts.maxTokens ?? 400,
        },
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok || !res.body) throw new Error(`ollama ${res.status}`);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      // A chunk can split a line; keep the remainder for the next read.
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const obj = JSON.parse(t) as { message?: { content?: string }; done?: boolean };
          const piece = obj.message?.content ?? "";
          if (piece) {
            full += piece;
            await onDelta(piece);
          }
        } catch {
          /* a malformed line is one lost token, not a failed answer */
        }
      }
    }
    return full.trim();
  } finally {
    clearTimeout(timer);
  }
}

/** Tolerant JSON extraction — handles prose-wrapped or fenced responses. */
export function parseJson<T>(raw: string): T | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
