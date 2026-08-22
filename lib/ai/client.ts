import "server-only";

/**
 * Thin OpenAI-compatible client for the hosted Ollama gateway.
 * Trust rule (v2 §9 / v3 §Honesty): the model selects components and parameters
 * ONLY. Every number rendered comes from our engines via the resolver.
 *
 * Env:
 *   OLLAMA_API_KEY   bearer token (set on Vercel + GitHub)
 *   OLLAMA_BASE_URL  defaults to https://api.ollama.com
 *   OLLAMA_MODEL     gateway model id, e.g. deepseek-v4-flash-high (whatever the provider documents)
 */

const BASE_URL = (process.env.OLLAMA_BASE_URL ?? "https://api.ollama.com").replace(/\/+$/, "");
const MODEL = process.env.OLLAMA_MODEL ?? "";
const API_KEY = process.env.OLLAMA_API_KEY ?? "";

export function aiEnabled(): boolean {
  return Boolean(API_KEY && MODEL);
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
    const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 400,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ollama ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? "";
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
