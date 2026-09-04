import { describe, expect, it } from "vitest";
import { followUpsFor } from "@/lib/genui/followUps";
import { COMPONENT_KEYS } from "@/lib/genui/registry";
import { route } from "@/lib/genui/router";

describe("followUpsFor", () => {
  it("leads with suggestions specific to the card that was shown", () => {
    expect(followUpsFor("price-gauge", true)[0]).toMatch(/rise/i);
  });

  it("never repeats a suggestion", () => {
    const out = followUpsFor("crowding", true, 6);
    expect(new Set(out.map((s) => s.toLowerCase())).size).toBe(out.length);
  });

  it("does not offer squad questions to somebody with no team set", () => {
    const out = followUpsFor(null, false, 6);
    expect(out.join(" ")).not.toMatch(/am I most exposed/i);
  });

  it("still has something to offer for an unknown component", () => {
    expect(followUpsFor("not-a-component", false).length).toBeGreaterThan(0);
  });

  it("honours the limit", () => {
    expect(followUpsFor("review", true, 2)).toHaveLength(2);
  });

  /*
   * The one that matters: a suggested question the router cannot answer sends
   * the reader into the fallback and teaches them the desk is dumber than it
   * is. Every suggestion has to route.
   */
  it("only ever suggests questions the router can actually answer", () => {
    const all = new Set<string>();
    for (const key of [...COMPONENT_KEYS, null]) {
      for (const q of followUpsFor(key, true, 10)) all.add(q);
    }
    expect(all.size).toBeGreaterThan(5);
    const unroutable = [...all].filter((q) => route(q) == null);
    expect(unroutable).toEqual([]);
  });
});
