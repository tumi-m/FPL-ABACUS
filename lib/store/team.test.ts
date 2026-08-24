import { describe, expect, it } from "vitest";
import { parseGateInput, parseNameQuery, parseTeamInput } from "@/lib/store/team";

describe("parseGateInput — entry URL → league URL → bare digits", () => {
  it("takes bare digits as an entry id", () => {
    expect(parseGateInput("1851681")).toEqual({ kind: "entry", id: 1851681 });
    expect(parseGateInput(" 42 ")).toEqual({ kind: "entry", id: 42 });
  });

  it("extracts the entry id from full and partial team URLs", () => {
    expect(parseGateInput("https://fantasy.premierleague.com/entry/1851681/history")).toEqual({ kind: "entry", id: 1851681 });
    expect(parseGateInput("fantasy.premierleague.com/entry/999/event/14")).toEqual({ kind: "entry", id: 999 });
    expect(parseGateInput("/entry/314/")).toEqual({ kind: "entry", id: 314 });
  });

  it("extracts the league id from league URLs — plural and singular", () => {
    expect(parseGateInput("https://fantasy.premierleague.com/leagues/12345")).toEqual({ kind: "league", id: 12345 });
    expect(parseGateInput("fantasy.premierleague.com/league/77/join")).toEqual({ kind: "league", id: 77 });
  });

  it("prefers the entry id when both appear (entry segments sort first by position)", () => {
    const parsed = parseGateInput("https://fantasy.premierleague.com/entry/55/leagues/99");
    expect(parsed?.kind).toBe("entry");
  });

  it("returns null for names, garbage, and emptiness", () => {
    expect(parseGateInput("")).toBeNull();
    expect(parseGateInput("Salah is injured")).toBeNull();
    expect(parseGateInput("not-a-url")).toBeNull();
  });
});

describe("parseTeamInput — legacy wrapper keeps the entry-only contract", () => {
  it("returns the id for entries and null for leagues", () => {
    expect(parseTeamInput("entry/1851681")).toBe(1851681);
    expect(parseTeamInput("leagues/123")).toBeNull();
  });
});

describe("parseNameQuery — what the gate will search by name", () => {
  it("accepts team and manager names", () => {
    expect(parseNameQuery("Trent's Reds")).toBe("Trent's Reds");
    expect(parseNameQuery("  Mo Salah  ")).toBe("Mo Salah");
  });

  it("refuses ids, urls and short noise", () => {
    expect(parseNameQuery("1851681")).toBeNull();
    expect(parseNameQuery("https://fantasy.premierleague.com/entry/1851681")).toBeNull();
    expect(parseNameQuery("ab")).toBeNull();
    expect(parseNameQuery("")).toBeNull();
  });
});
