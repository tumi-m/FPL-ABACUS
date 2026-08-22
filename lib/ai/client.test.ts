import { describe, expect, it } from "vitest";
import { parseJson } from "./client";

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
