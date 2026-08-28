"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";

const LEADS = [
  { minutes: "1440,120", label: "1 day + 2 hours" },
  { minutes: "120,15", label: "2 hours + 15 min" },
  { minutes: "60", label: "1 hour" },
  { minutes: "none", label: "No reminder" },
] as const;

/**
 * Put the deadline in the calendar you already look at.
 *
 * Deliberately not an integration. Google's Calendar API would want an OAuth
 * consent screen, app verification and a refresh token held per user, and
 * Apple publishes no write API at all — so "connect your calendar" would be a
 * login, a privacy policy and a token to leak, in exchange for one reminder a
 * week. A subscribed feed does the same job for both, and for Outlook, with
 * nothing stored on our side: the URL *is* the subscription, and unsubscribing
 * is deleting the calendar rather than asking us to forget you.
 *
 * The lead time is in the URL rather than in a preference, for the same
 * reason — the calendar holds the setting, so there is nothing here to keep.
 */
export function CalendarSubscribe({ origin }: { origin: string }) {
  const [lead, setLead] = React.useState<string>("120,15");
  const [copied, setCopied] = React.useState(false);

  const path = `/api/calendar/deadlines.ics?alarm=${encodeURIComponent(lead)}`;
  const https = `${origin}${path}`;
  // webcal:// is what makes iOS and macOS offer to subscribe rather than
  // importing a dead copy of today's events.
  const webcal = https.replace(/^https?:/, "webcal:");
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <section aria-labelledby="cal-h" className="rounded-lg has-gloss card-lift bg-raised px-5 py-4">
      <h2 id="cal-h" className="upper-label text-2xs text-ink-lo">
        Never miss a deadline
      </h2>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-mid">
        Subscribe once and every deadline for the rest of the season lands in your calendar, with a
        reminder. If FPL moves one, your calendar moves with it.
      </p>

      <fieldset className="mt-4">
        <legend className="upper-label text-2xs text-ink-lo">Remind me</legend>
        <div role="group" className="mt-2 flex flex-wrap gap-1 rounded-md glass-edge p-1">
          {LEADS.map((option) => (
            <button
              key={option.minutes}
              type="button"
              aria-pressed={lead === option.minutes}
              onClick={() => setLead(option.minutes)}
              className={cn(
                "skewed rounded-md px-3 py-2 text-xs uppercase-label transition-colors dur-instant",
                lead === option.minutes
                  ? "bg-volt text-on-accent"
                  : "text-ink-mid hover:bg-surface-3 hover:text-ink-hi",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap gap-2">
        {/*
         * A plain anchor, not next/link: these leave the app entirely — one
         * hands the URL to the operating system's calendar handler, one to
         * Google. Routing them through the client router would do nothing but
         * delay them.
         */}
        <a
          href={webcal}
          className="skewed inline-flex h-11 items-center gap-2 rounded-md bg-volt px-5 text-xs uppercase-label text-on-accent btn-glow transition-transform dur-instant active:scale-[0.98]"
        >
          <span>Apple Calendar</span>
          <span aria-hidden>↗</span>
        </a>
        <a
          href={google}
          target="_blank"
          rel="noreferrer noopener"
          className="skewed inline-flex h-11 items-center gap-2 rounded-md bg-raised px-5 text-xs uppercase-label text-ink-mid card-ring transition-colors dur-instant hover:text-ink-hi"
        >
          <span>Google Calendar</span>
          <span aria-hidden>↗</span>
        </a>
        <a
          href={`${path}&only=next`}
          download="fpl-deadline.ics"
          className="skewed inline-flex h-11 items-center rounded-md bg-raised px-5 text-xs uppercase-label text-ink-mid card-ring transition-colors dur-instant hover:text-ink-hi"
        >
          Just the next one
        </a>
      </div>

      <div className="mt-4">
        <p className="text-2xs text-ink-lo">
          Outlook, Fantastical or anything else: add this URL as a subscribed calendar.
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-sunk px-3 py-2 text-2xs text-ink-mid">
            {https}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(https).then(
                () => setCopied(true),
                () => undefined,
              );
            }}
            className="skewed inline-flex h-9 shrink-0 items-center rounded-md bg-raised px-3 text-2xs uppercase-label text-ink-mid card-ring transition-colors dur-instant hover:text-ink-hi"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p aria-live="polite" className="sr-only">
          {copied ? "Calendar URL copied to clipboard" : ""}
        </p>
      </div>

      <p className="mt-3 max-w-[62ch] text-2xs leading-relaxed text-ink-lo">
        Nothing is stored and no account is connected — the link is the subscription. Remove the
        calendar and it is gone. Apple refreshes subscribed calendars roughly hourly; Google can take
        longer, so subscribe before deadline day rather than on it.
      </p>
    </section>
  );
}
