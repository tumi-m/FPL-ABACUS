import Link from "next/link";

/**
 * The one-line version of the calendar offer, for a screen that is not about
 * calendars.
 *
 * The feed itself has lived on the Deadline Cockpit for a while and almost
 * nobody has met it, because the cockpit was in no navigation and the offer
 * was three scrolls down a page you had to know existed. This is the invite,
 * put where a manager already is on the days there is no football on — and
 * only on those days, because a strip about next Saturday during a match is
 * an advert.
 */
export function CalendarInvite() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-1 card-ring px-4 py-3">
      <p className="min-w-0 text-sm text-ink-mid">
        <span className="upper-label mr-2 text-2xs text-ink-lo">Deadlines</span>
        Put every deadline this season in your own calendar — Apple, Google or Outlook.
      </p>
      <Link
        href="/deadline"
        className="skewed inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md card-ring px-3 text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
      >
        <span>Set reminders</span>
      </Link>
    </div>
  );
}
