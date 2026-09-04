import { describe, expect, it } from "vitest";
import { parseWatchlist, toggleIn, WATCH_LIMIT } from "./watchlistCore";

describe("parseWatchlist", () => {
  it("reads a plain list of ids", () => {
    expect(parseWatchlist("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("treats missing and unparseable storage as empty, never as a crash", () => {
    expect(parseWatchlist(null)).toEqual([]);
    expect(parseWatchlist("")).toEqual([]);
    expect(parseWatchlist("{oops")).toEqual([]);
    expect(parseWatchlist('{"a":1}')).toEqual([]);
  });

  it("drops anything that is not a usable element id", () => {
    // hand-edited storage, or a shape an older build wrote
    expect(parseWatchlist('[1,"2",0,-3,1.5,null,"x",1]')).toEqual([1, 2]);
  });

  it("never returns more than the cap, however long the stored list is", () => {
    const many = JSON.stringify(Array.from({ length: 200 }, (_, i) => i + 1));
    expect(parseWatchlist(many)).toHaveLength(WATCH_LIMIT);
  });
});

describe("toggleIn", () => {
  it("puts a newly starred player at the top, not at the end", () => {
    expect(toggleIn([1, 2], 9)).toEqual([9, 1, 2]);
  });

  it("removes one that is already there", () => {
    expect(toggleIn([9, 1, 2], 1)).toEqual([9, 2]);
  });

  it("drops the oldest once the cap is reached", () => {
    const full = Array.from({ length: WATCH_LIMIT }, (_, i) => i + 1);
    const next = toggleIn(full, 999);
    expect(next).toHaveLength(WATCH_LIMIT);
    expect(next[0]).toBe(999);
    expect(next).not.toContain(WATCH_LIMIT); // the last one fell off the end
  });

  it("ignores an id that could not be an element", () => {
    expect(toggleIn([1], 0)).toEqual([1]);
    expect(toggleIn([1], -4)).toEqual([1]);
    expect(toggleIn([1], 2.5)).toEqual([1]);
  });

  it("does not mutate the list it was handed", () => {
    const before = [1, 2];
    toggleIn(before, 3);
    expect(before).toEqual([1, 2]);
  });
});
