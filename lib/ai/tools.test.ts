import { describe, expect, it, vi } from "vitest";
import {
  MAX_TOOL_CALLS,
  BUDGET_MS,
  parseToolCall,
  runToolLoop,
  toolsSystemPrompt,
  type ToolCard,
} from "./tools";
import { COMPONENT_KEYS } from "@/lib/genui/registry";

function card(component: string): ToolCard {
  return {
    component,
    title: component,
    prose: `Resolved ${component}.`,
    props: { component },
  };
}

function selectReply(replies: string[]) {
  let i = 0;
  return vi.fn(async () => replies[i++] ?? '{"done":true}');
}

describe("parseToolCall — the gateway contract", () => {
  it("parses a clean tool call and coerces params against the registry", () => {
    const call = parseToolCall('{"component":"captain-compare","params":{"playerName":"Haaland"}}');
    expect(call).toEqual({ component: "captain-compare", params: { playerName: "Haaland" } });
  });

  it("tolerates prose-wrapped and fenced replies", () => {
    const call = parseToolCall('Here you go:\n```json\n{"component":"price-gauge","params":{}}\n```');
    expect(call?.component).toBe("price-gauge");
  });

  it("rejects components outside the registry", () => {
    expect(parseToolCall('{"component":"make-up-card","params":{}}')).toBeNull();
  });

  it("rejects params that fail the registry schema", () => {
    // playerName must be 2–40 chars; a 200-char blob fails coercion
    const blob = "x".repeat(60);
    expect(parseToolCall(`{"component":"captain-compare","params":{"playerName":"${blob}"}}`)).toBeNull();
  });

  it("strips unknown param keys rather than forwarding them", () => {
    const call = parseToolCall('{"component":"price-gauge","params":{"playerName":"Salah","evil":"DROP TABLE"}}');
    expect(call).not.toBeNull();
    expect(call!.params).toEqual({ playerName: "Salah" });
  });

  it("returns null on pure prose", () => {
    expect(parseToolCall("I would take a hit, definitely.")).toBeNull();
  });
});

describe("runToolLoop — termination and honesty", () => {
  it("resolves a multi-part question into multiple cards", async () => {
    const resolve = vi.fn(async (call: { component: string }) => card(call.component));
    const res = await runToolLoop({
      question: "should I take a hit for Haaland and who do I sell?",
      select: selectReply([
        '{"component":"transfer-sim","params":{}}',
        '{"component":"captain-compare","params":{}}',
        '{"done":true}',
      ]),
      resolve,
    });
    expect(res.cards.map((c) => c.component)).toEqual(["transfer-sim", "captain-compare"]);
    expect(res.stop).toBe("complete");
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it("terminates at MAX_TOOL_CALLS with the cards it has", async () => {
    const resolve = vi.fn(async (call: { component: string }) => card(call.component));
    const res = await runToolLoop({
      question: "one of everything",
      select: selectReply(COMPONENT_KEYS.map((k) => `{"component":"${k}","params":{}}`)),
      resolve,
      maxCalls: MAX_TOOL_CALLS,
    });
    expect(res.cards).toHaveLength(MAX_TOOL_CALLS);
    expect(res.stop).toBe("max-calls");
  });

  it("stops on budget expiry and keeps the cards resolved so far", async () => {
    const resolve = vi.fn(
      async (call: { component: string }) =>
        new Promise<ToolCard | null>((r) => setTimeout(() => r(card(call.component)), 60)),
    );
    const names = ["price-gauge", "captain-compare", "transfer-sim", "fixture-run"];
    let i = 0;
    const res = await runToolLoop({
      question: "slow desk",
      select: async () => `{"component":"${names[i++ % names.length]}","params":{}}`,
      resolve,
      budgetMs: 150,
      maxCalls: 8,
    });
    expect(res.cards.length).toBeGreaterThanOrEqual(1);
    expect(res.cards.length).toBeLessThan(8);
    expect(res.stop).toBe("budget");
  });

  it("degrades to today's one-shot behaviour when the model errors on the first call", async () => {
    const res = await runToolLoop({
      question: "anything",
      select: async () => {
        throw new Error("gateway down");
      },
      resolve: vi.fn(),
    });
    expect(res.cards).toEqual([]);
    expect(res.stop).toBe("model-error");
  });

  it("treats a resolver miss as done rather than letting the model retry the dead end", async () => {
    const resolve = vi.fn(async () => null);
    const select = selectReply([
      '{"component":"captain-compare","params":{}}',
      '{"component":"price-gauge","params":{}}',
    ]);
    const res = await runToolLoop({ question: "q", select, resolve });
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(res.cards).toEqual([]);
  });

  it("never resolves the same component twice", async () => {
    const resolve = vi.fn(async (call: { component: string }) => card(call.component));
    const res = await runToolLoop({
      question: "again and again",
      select: selectReply([
        '{"component":"price-gauge","params":{}}',
        '{"component":"price-gauge","params":{}}',
        '{"component":"captain-compare","params":{}}',
      ]),
      resolve,
    });
    expect(res.cards.map((c) => c.component)).toEqual(["price-gauge"]);
  });

  it("default budget is the documented 6 s", () => {
    expect(BUDGET_MS).toBe(6_000);
    expect(MAX_TOOL_CALLS).toBe(3);
  });

  it("the system prompt names every registry component and forbids inventing numbers", () => {
    const prompt = toolsSystemPrompt();
    for (const key of COMPONENT_KEYS) expect(prompt).toContain(key);
    expect(prompt).toMatch(/Never invent numbers/i);
  });
});