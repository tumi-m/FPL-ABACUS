/**
 * B1 — the gaffer's tools.
 *
 * One shot at one card could not answer "should I take a hit for Haaland and
 * who do I sell?" — that is three questions (price the hit, check the sale,
 * look at the captaincy) and it produced one card and a sentence. This
 * module lets the model name a sequence of registry components: the server
 * resolves each one, appends every card to the facts, and hands the grown
 * facts back so the model can decide whether it needs more.
 *
 * The honesty architecture is what makes this safe to grow:
 *
 *   - The model names components and parameters ONLY. Every number comes
 *     from the resolver (lib/genui/resolve.ts) — the model cannot add one.
 *   - The facts object grows with each resolved card, and the sentence
 *     gate's allowed-figure set grows with it for free: a figure is speakable
 *     exactly when it appeared in a resolved card.
 *   - Hard limits: MAX_TOOL_CALLS=3, BUDGET_MS=6000. A loop that hits either
 *     limit degrades to the cards it already has — which on the first call
 *     is exactly today's one-shot behaviour, so the zero-model router path
 *     and the single-intent path are unchanged.
 *
 * Pure functions only — the caller supplies a resolve callback, so tests
 * stub resolution and the route handler stays thin.
 */
import { COMPONENT_KEYS, coerceParams, isValidComponent } from "@/lib/genui/registry";

/** Hard cap on model-directed tool calls per question. */
export const MAX_TOOL_CALLS = 3;
/** Wall-clock budget for the whole loop, in ms. */
export const BUDGET_MS = 6_000;

/** One resolved card, in the shape the ask stream already sends. */
export interface ToolCard {
  component: string;
  title: string;
  prose: string;
  props: Record<string, unknown> | null;
  note?: string;
}

/** The model's tool selection: a component key plus optional params. */
export interface ToolCall {
  component: string;
  params: Record<string, unknown>;
}

export interface ToolRunResult {
  /** The resolved cards, in call order. Empty when nothing resolved. */
  cards: ToolCard[];
  /** How the run ended — for the server log and the meta frame. */
  stop: "complete" | "max-calls" | "budget" | "model-error" | "no-calls";
  /** Tool calls the model actually made (validated ones). */
  calls: number;
}

/**
 * Parse the model's reply into a validated tool call.
 *
 * The gateway contract is the same JSON reply modelSelect already speaks:
 * `{"component":"<key>","params":{...}}`. Params are coerced against the
 * registry schema — unknown keys stripped, bad shapes rejected — so a
 * hallucinated component or a malformed param never reaches the resolver.
 * Returns null when the reply names nothing usable.
 */
export function parseToolCall(raw: string): ToolCall | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed: { component?: unknown; params?: unknown };
  try {
    parsed = JSON.parse(match[0]) as { component?: unknown; params?: unknown };
  } catch {
    return null;
  }
  if (typeof parsed.component !== "string" || !isValidComponent(parsed.component)) return null;
  const params = coerceParams(parsed.component, parsed.params ?? {});
  if (params == null) return null;
  return { component: parsed.component, params };
}

/** The system prompt fragment that teaches the tool contract. */
export function toolsSystemPrompt(): string {
  return (
    "You compose an answer from UI components by naming them, one at a time. " +
    `Reply with ONLY JSON {"component":"<key>","params":{...}} using one of these keys: ${COMPONENT_KEYS.join(", ")}. ` +
    "Optional params: playerName, query, out, in, rivalEntry. " +
    "For a multi-part question, name the FIRST component that answers part of it — you will be asked again with the results so far, and you may name another or reply {\"done\":true} when nothing more would help. " +
    "Never invent numbers: components resolve real data themselves."
  );
}

/**
 * Run the loop.
 *
 * `select` is the model call: given the question and the JSON summary of the
 * facts so far, it returns a raw model reply. `resolve` is the server's
 * resolver, injected so tests can stub it.
 *
 * Termination: when the model replies with a done flag, names no usable
 * component, hits MAX_TOOL_CALLS, or the budget expires. Every stop reason
 * leaves the cards resolved so far intact.
 */
export async function runToolLoop(opts: {
  question: string;
  select: (question: string, factsSoFar: ToolCard[]) => Promise<string>;
  resolve: (call: ToolCall) => Promise<ToolCard | null>;
  budgetMs?: number;
  maxCalls?: number;
}): Promise<ToolRunResult> {
  const maxCalls = opts.maxCalls ?? MAX_TOOL_CALLS;
  const deadline = Date.now() + (opts.budgetMs ?? BUDGET_MS);
  const cards: ToolCard[] = [];

  for (let call = 0; call < maxCalls; call++) {
    if (Date.now() >= deadline) {
      return { cards, stop: "budget", calls: call };
    }
    let raw: string;
    try {
      raw = await opts.select(opts.question, cards);
    } catch {
      return { cards, stop: call === 0 ? "model-error" : "complete", calls: call };
    }
    const parsed = parseToolCall(raw);
    if (!parsed) {
      // Model replied with prose, a done flag, or an unusable component.
      // After at least one card that is a normal completion.
      return { cards, stop: call === 0 ? "no-calls" : "complete", calls: call };
    }
    const card = await opts.resolve(parsed);
    if (!card) {
      // Named a real component but the resolver had nothing — treat as done
      // rather than letting the model retry the same dead end.
      return { cards, stop: call === 0 ? "no-calls" : "complete", calls: call };
    }
    // Same component twice adds nothing new to the answer; stop here.
    if (cards.some((c) => c.component === card.component)) {
      return { cards, stop: "complete", calls: call + 1 };
    }
    cards.push(card);
    // A resolve that eats the rest of the budget ends the run here rather
    // than letting the model start work it cannot finish.
    if (Date.now() >= deadline) {
      return { cards, stop: "budget", calls: call + 1 };
    }
  }
  return { cards, stop: "max-calls", calls: maxCalls };
}