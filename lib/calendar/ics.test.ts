import { describe, expect, it } from "vitest";
import {
  buildDeadlineFeed,
  escapeText,
  foldLine,
  icsDate,
  parseAlarms,
  uidFor,
  type DeadlineEvent,
} from "@/lib/calendar/ics";

const gw = (id: number, deadline: string): DeadlineEvent => ({
  id,
  name: `Gameweek ${id}`,
  deadline,
});

describe("escapeText", () => {
  it("escapes the four characters that mean something to the format", () => {
    expect(escapeText("a,b")).toBe("a\\,b");
    expect(escapeText("a;b")).toBe("a\;b");
    expect(escapeText("a\\b")).toBe("a\\\\b");
    expect(escapeText("a\nb")).toBe("a\\nb");
  });

  it("escapes the backslash before it escapes anything else", () => {
    // Wrong order turns \, into \\\, and the comma stops being escaped.
    expect(escapeText("a\\,b")).toBe("a\\\\\\,b");
  });
});

describe("foldLine", () => {
  it("leaves a short line alone", () => {
    expect(foldLine("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("folds past 75 octets with a leading space", () => {
    const folded = foldLine("SUMMARY:" + "x".repeat(100));
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[1].startsWith(" ")).toBe(true);
    expect(parts[0].length).toBeLessThanOrEqual(75);
  });

  it("counts octets, not characters", () => {
    // 40 three-octet characters is 120 octets and has to fold, even though
    // it is well under 75 characters long.
    const folded = foldLine("SUMMARY:" + "€".repeat(40));
    expect(folded).toContain("\r\n ");
  });

  it("never splits a multi-byte character across the fold", () => {
    const folded = foldLine("X:" + "€".repeat(40));
    for (const part of folded.split("\r\n")) {
      expect(part).not.toContain("�");
      expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(75);
    }
  });

  it("unfolds back to the original", () => {
    const original = "DESCRIPTION:" + "abcdefghij".repeat(20);
    expect(foldLine(original).split("\r\n ").join("")).toBe(original);
  });
});

describe("icsDate", () => {
  it("writes the UTC basic format", () => {
    expect(icsDate("2026-08-15T10:30:00Z")).toBe("20260815T103000Z");
  });

  it("normalises an offset to UTC", () => {
    expect(icsDate("2026-08-15T11:30:00+01:00")).toBe("20260815T103000Z");
  });

  it("refuses a date it cannot read rather than emitting NaN", () => {
    expect(() => icsDate("not a date")).toThrow(RangeError);
  });
});

describe("uidFor", () => {
  it("is stable for a gameweek, so a refresh updates rather than duplicates", () => {
    expect(uidFor(12, "2026/27")).toBe(uidFor(12, "2026/27"));
  });

  it("separates seasons, so next August does not collide with this one", () => {
    expect(uidFor(1, "2026/27")).not.toBe(uidFor(1, "2027/28"));
  });
});

describe("buildDeadlineFeed", () => {
  const feed = buildDeadlineFeed([gw(1, "2026-08-15T10:30:00Z"), gw(2, "2026-08-22T10:30:00Z")], {
    season: "2026/27",
    origin: "https://example.test",
  });

  it("wraps the events in one calendar", () => {
    expect(feed.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(feed.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(feed.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it("ends every line with CRLF, the last one included", () => {
    expect(feed.split("\n").every((line, i, all) => i === all.length - 1 || line.endsWith("\r"))).toBe(
      true,
    );
  });

  it("carries the deadline as the start", () => {
    expect(feed).toContain("DTSTART:20260815T103000Z");
  });

  it("gives the event a body rather than zero length", () => {
    expect(feed).toContain("DTEND:20260815T104500Z");
  });

  it("stamps from the deadline, not from now — a poll must not look like an edit", () => {
    // Two builds a moment apart have to be byte-identical, or every refresh
    // re-notifies the subscriber about thirty-eight unchanged events.
    const again = buildDeadlineFeed([gw(1, "2026-08-15T10:30:00Z"), gw(2, "2026-08-22T10:30:00Z")], {
      season: "2026/27",
      origin: "https://example.test",
    });
    expect(again).toBe(feed);
    expect(feed).toContain("DTSTAMP:20260815T103000Z");
  });

  it("defaults to two reminders, the longer lead first", () => {
    const first = feed.slice(feed.indexOf("BEGIN:VEVENT"), feed.indexOf("END:VEVENT"));
    expect(first).toContain("TRIGGER:-PT120M");
    expect(first).toContain("TRIGGER:-PT15M");
    expect(first.indexOf("PT120M")).toBeLessThan(first.indexOf("PT15M"));
  });

  it("names the lead time in words a person can read", () => {
    expect(buildDeadlineFeed([gw(1, "2026-08-15T10:30:00Z")], { alarms: [1440] })).toContain(
      "deadline in 1 day",
    );
    expect(buildDeadlineFeed([gw(1, "2026-08-15T10:30:00Z")], { alarms: [120] })).toContain(
      "deadline in 2 hours",
    );
    expect(buildDeadlineFeed([gw(1, "2026-08-15T10:30:00Z")], { alarms: [45] })).toContain(
      "deadline in 45 minutes",
    );
  });

  it("can carry no alarm at all", () => {
    const quiet = buildDeadlineFeed([gw(1, "2026-08-15T10:30:00Z")], { alarms: [] });
    expect(quiet).not.toContain("BEGIN:VALARM");
    expect(quiet).toContain("BEGIN:VEVENT");
  });

  it("marks the entries free, so a deadline does not read as a busy block", () => {
    expect(feed).toContain("TRANSP:TRANSPARENT");
  });

  it("survives an empty season", () => {
    const empty = buildDeadlineFeed([]);
    expect(empty).toContain("BEGIN:VCALENDAR");
    expect(empty).not.toContain("BEGIN:VEVENT");
  });
});

describe("parseAlarms", () => {
  it("defaults when the parameter is absent", () => {
    expect(parseAlarms(null)).toEqual([120, 15]);
  });

  it("reads a comma list, longest lead first", () => {
    expect(parseAlarms("15,1440,120")).toEqual([1440, 120, 15]);
  });

  it("takes 'none' for a calendar entry without a buzz", () => {
    expect(parseAlarms("none")).toEqual([]);
    expect(parseAlarms("NONE")).toEqual([]);
  });

  it("drops nonsense instead of erroring — this URL lives in a calendar for a season", () => {
    expect(parseAlarms("abc")).toEqual([120, 15]);
    expect(parseAlarms("-5")).toEqual([120, 15]);
    expect(parseAlarms("99999")).toEqual([120, 15]);
  });

  it("keeps the good half of a partly-mangled list", () => {
    expect(parseAlarms("120,abc")).toEqual([120]);
  });

  it("de-duplicates and caps the count", () => {
    expect(parseAlarms("60,60")).toEqual([60]);
    expect(parseAlarms("10,20,30,40,50,60")).toHaveLength(4);
  });
});
