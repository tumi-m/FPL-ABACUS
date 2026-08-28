/**
 * iCalendar (RFC 5545) for the FPL deadlines.
 *
 * There is no way to write into somebody's Apple Calendar. Apple publishes no
 * API for it, and Google's needs an OAuth consent screen, a verified app and a
 * refresh token per user — a login and a privacy policy in exchange for one
 * reminder a week. A published .ics feed is what both of those calendars, and
 * Outlook, are actually built to consume: subscribe once and every deadline
 * for the rest of the season arrives, alarms and all, and follows FPL if a
 * deadline moves.
 *
 * The format is unforgiving in three specific ways, which is why this is a
 * module with tests rather than a template string:
 *   - lines are folded at 75 octets, and octets are not characters
 *   - commas, semicolons and backslashes inside a TEXT value must be escaped
 *   - every line ends CRLF, including the last one
 * A feed that gets any of those wrong is not "mostly fine"; iOS silently
 * refuses to subscribe to it.
 */

export interface DeadlineEvent {
  /** Gameweek number. */
  id: number;
  /** FPL's own name, e.g. "Gameweek 12". */
  name: string;
  /** ISO-8601 UTC instant of the deadline. */
  deadline: string;
}

export interface FeedOptions {
  /**
   * Minutes before the deadline to fire an alarm, one per entry. Empty means
   * a calendar entry with no reminder, which some people want — they keep an
   * eye on the week without being buzzed.
   */
  alarms?: number[];
  /** Absolute origin, used to link each event back at the app. */
  origin?: string;
  /** Season label for the calendar name, e.g. "2026/27". */
  season?: string;
}

/** RFC 5545 §3.3.11 — escape the four characters that mean something in TEXT. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * RFC 5545 §3.1 — fold to 75 octets, continuing with a leading space.
 *
 * The limit counts octets, not characters, so a line of accented names folds
 * earlier than its length suggests. Folding by character would produce lines
 * that are legal by count and illegal by size, and a multi-byte character
 * split across the fold would corrupt the value outright.
 */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let bytes = 0;
  // 74 on continuation lines: the leading space of the fold is itself an octet.
  let limit = 75;
  for (const char of line) {
    const size = enc.encode(char).length;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
      limit = 74;
    }
    current += char;
    bytes += size;
  }
  if (current) out.push(current);
  return out.join("\r\n ");
}

/** UTC basic format: 20260815T103000Z. */
export function icsDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new RangeError(`unparseable date: ${iso}`);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** A stable identity per gameweek, so a refresh updates rather than duplicates. */
export function uidFor(gw: number, season: string): string {
  return `fpl-gw${gw}-${season.replace(/\W/g, "")}@fpl-gaffers`;
}

function alarm(minutes: number, summary: string): string[] {
  return [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(summary)}`,
    // A negative duration is "before the start". PT0M would be "at the start",
    // which is the moment it is already too late to be useful.
    `TRIGGER:-PT${minutes}M`,
    "END:VALARM",
  ];
}

function describeLead(minutes: number): string {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${minutes} minutes`;
}

/**
 * The whole feed.
 *
 * DTSTAMP and LAST-MODIFIED are derived from the deadline rather than from
 * "now" on purpose. Stamping the moment of the request would mark all
 * thirty-eight events as modified on every poll, which is how a subscribed
 * calendar starts re-notifying people about events that have not changed.
 * Deriving them from the deadline means nothing churns — and if FPL moves a
 * deadline, the stamp moves with it and the client correctly sees an edit.
 */
export function buildDeadlineFeed(events: DeadlineEvent[], opts: FeedOptions = {}): string {
  const { alarms = [120, 15], origin, season = "" } = opts;
  const name = season ? `FPL deadlines ${season}` : "FPL deadlines";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GAFFER//FPL deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    `NAME:${escapeText(name)}`,
    "X-WR-TIMEZONE:UTC",
    `X-WR-CALDESC:${escapeText("Every Fantasy Premier League transfer deadline, with reminders.")}`,
    // Both spellings: the standard property and the one Apple actually reads.
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];

  for (const event of events) {
    const start = icsDate(event.deadline);
    // A deadline is an instant, but a zero-length event is drawn as a hairline
    // or dropped entirely depending on the client. Fifteen minutes gives it a
    // body you can see in a week view without pretending the window is longer
    // than it is.
    const end = icsDate(new Date(new Date(event.deadline).getTime() + 15 * 60_000).toISOString());
    const summary = `${event.name} deadline`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uidFor(event.id, season)}`,
      `DTSTAMP:${start}`,
      `LAST-MODIFIED:${start}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(
        `Transfers, captain and bench for ${event.name} lock at this time.` +
          (origin ? `\n\n${origin}/deadline` : ""),
      )}`,
      "TRANSP:TRANSPARENT",
      "STATUS:CONFIRMED",
      "CATEGORIES:Fantasy Premier League",
    );
    if (origin) lines.push(`URL:${origin}/deadline`);
    for (const minutes of alarms) {
      lines.push(...alarm(minutes, `${event.name} deadline in ${describeLead(minutes)}`));
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // Trailing CRLF included: the last line is a line like any other.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * Parse the `alarm` query parameter.
 *
 * Accepts a comma list of minutes, or "none". Anything unparseable falls back
 * to the default rather than 400-ing: this URL lives in somebody's calendar
 * client for a season, and a feed that starts erroring because a character got
 * mangled in a copy-paste is worse than a feed with the default reminders.
 */
export function parseAlarms(raw: string | null, fallback: number[] = [120, 15]): number[] {
  if (raw === null) return fallback;
  if (raw.trim().toLowerCase() === "none") return [];
  const parsed = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 10_080); // a week at most
  if (parsed.length === 0) return fallback;
  // Longest lead first, de-duplicated, capped: nobody needs nine reminders.
  return [...new Set(parsed)].sort((a, b) => b - a).slice(0, 4);
}
