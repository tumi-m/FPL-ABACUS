import { describe, expect, it } from "vitest";
import { sortWatchRows } from "./watchlistSort";

const rows = [
  { id: 1, price: 100, eo_predicted: 5 },
  { id: 2, price: 80, eo_predicted: 40 },
  { id: 3, price: 120, eo_predicted: 12 },
];

describe("sortWatchRows", () => {
  it("starred keeps the fetched order", () => {
    expect(sortWatchRows(rows, "starred").map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("deadline EO puts the coming bandwagon first", () => {
    expect(sortWatchRows(rows, "eo").map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("price puts the dearest first", () => {
    expect(sortWatchRows(rows, "price").map((r) => r.id)).toEqual([3, 1, 2]);
  });

  it("ties break by id, deterministically", () => {
    const tied = [
      { id: 9, price: 100, eo_predicted: 10 },
      { id: 4, price: 100, eo_predicted: 10 },
    ];
    expect(sortWatchRows(tied, "eo").map((r) => r.id)).toEqual([4, 9]);
  });
});