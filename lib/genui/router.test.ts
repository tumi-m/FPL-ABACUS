import { describe, expect, it } from "vitest";
import { bestGuess, extractPlayerName, route } from "@/lib/genui/router";
import { REGISTRY, isValidComponent } from "@/lib/genui/registry";

describe("router — the zero-model contract", () => {
  it("resolves captaincy questions with no model calls", () => {
    const r = route("should I captain salah or haaland?");
    expect(r).not.toBeNull();
    expect(r!.component).toBe("captain-compare");
    expect(r!.params.playerName).toBe("salah");
  });

  it("resolves price questions", () => {
    expect(route("will mbeumo rise tonight?")!.component).toBe("price-gauge");
    expect(route("any price changes today")!.component).toBe("price-gauge");
    expect(route("is trippier falling in price")!.component).toBe("price-gauge");
  });

  it("resolves hit questions", () => {
    expect(route("is it worth taking a hit for a -4?")!.component).toBe("transfer-sim");
    expect(route("should i sell robertson and bring in chilwell")!.component).toBe("transfer-sim");
  });

  it("routes the rest of the surface", () => {
    expect(route("how are his fixtures looking?")!.component).toBe("fixture-run");
    expect(route("does gabriel hit 10 defcon?")!.component).toBe("defcon-check");
    expect(route("is he due or just finishing poorly? xg says what")!.component).toBe("xg-vs-actual");
    expect(route("what rank could i finish?")!.component).toBe("rank-projection");
    expect(route("when should I play my wildcard?")!.component).toBe("chip-timing");
    expect(route("any injury news on james?")!.component).toBe("injury-list");
    expect(route("what's the latest gossip?")!.component).toBe("news-search");
    expect(route("my exposure to the template is scary")!.component).toBe("exposure-scatter");
    expect(route("which event moved me most in the ranks?")!.component).toBe("swing-impact");
  });

  it("routes the v5 assistant intents", () => {
    const gen = route("build me a differential wildcard squad");
    expect(gen!.component).toBe("squad-generator");
    expect(gen!.params.risk).toBe("differential");
    expect(route("generate me a safe team")!.params.risk).toBe("safe");
    expect(route("who should I sell this week?")!.component).toBe("transfer-watch");
    expect(route("best week for my bench boost?")!.component).toBe("chip-timing");
    expect(route("how did I do last week?")!.component).toBe("review");
  });

  it("returns null on pure nonsense rather than guessing wildly", () => {
    expect(route("zzz qqq xyzzy")).toBeNull();
  });
});

describe("bestGuess — model-free fallback ladder", () => {
  it("keeps confident direct routes", () => {
    expect(bestGuess("captain pick for this gw and next")!.component).toBe("captain-compare");
  });

  it("maps single keyword fallbacks onto registry components", () => {
    expect(bestGuess("price")!.component).toBe("price-gauge");
    expect(bestGuess("chips")!.component).toBe("chip-timeline");
    expect(bestGuess("injuries")!.component).toBe("injury-list");
  });
});

describe("extractPlayerName", () => {
  it("prefers quoted names", () => {
    expect(extractPlayerName('captain "mohamed salah" this week')).toBe("mohamed salah");
  });
  it("falls back to verb-adjacent tokens", () => {
    expect(extractPlayerName("should I sell Trent now?")).toBe("Trent");
  });
});

describe("registry integrity", () => {
  it("every routed component exists in the registry", () => {
    for (const key of [
      "captain-compare", "price-gauge", "transfer-sim", "fixture-run", "defcon-check",
      "xg-vs-actual", "rank-projection", "swing-impact", "exposure-scatter",
      "chip-timeline", "injury-list", "news-search",
      "squad-generator", "transfer-watch", "chip-timing", "review",
    ]) {
      expect(isValidComponent(key)).toBe(true);
      expect(REGISTRY[key].engine.length).toBeGreaterThan(3);
    }
  });
});
