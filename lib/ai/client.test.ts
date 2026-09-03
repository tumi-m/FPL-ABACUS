import { describe, expect, it, vi } from "vitest";
import { parseJson, resolveAiEnv } from "./client";

describe("parseJson", () => {
  it("parses a bare object", () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("extracts JSON from prose and code fences", () => {
    const raw = 'Here you go:\n```json\n{"components":[{"id":"captain_compare"}]}\n```';
    expect(parseJson(raw)).toEqual({ components: [{ id: "captain_compare" }] });
  });

  it("returns null when there is no object", () => {
    expect(parseJson("no json here")).toBeNull();
  });

  it("returns null on malformed json", () => {
    expect(parseJson("{broken")).toBeNull();
  });
});

describe("resolveAiEnv", () => {
  it("prefers OLLAMA_* over the legacy LLM_* alias", () => {
    expect(
      resolveAiEnv({
        OLLAMA_API_KEY: "new",
        LLM_API_KEY: "old",
        OLLAMA_MODEL: "new-model",
        LLM_MODEL: "old-model",
      }),
    ).toMatchObject({ apiKey: "new", model: "new-model" });
  });

  it("falls back to LLM_* when OLLAMA_* is unset", () => {
    expect(
      resolveAiEnv({ LLM_API_KEY: "legacy", LLM_MODEL: "legacy-model", LLM_BASE_URL: "https://x.test/" }),
    ).toMatchObject({ apiKey: "legacy", model: "legacy-model", baseUrl: "https://x.test" });
  });

  it("treats empty strings as unset and applies defaults", () => {
    expect(resolveAiEnv({ OLLAMA_API_KEY: "", OLLAMA_MODEL: "" })).toMatchObject({
      apiKey: "",
      model: "deepseek-v4-flash:0731",
      baseUrl: "https://ollama.com",
    });
  });

  it("warns once about the legacy alias", async () => {
    vi.resetModules();
    const fresh = await import("./client");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      fresh.resolveAiEnv({ LLM_API_KEY: "x" });
      fresh.resolveAiEnv({ LLM_API_KEY: "x" });
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});
