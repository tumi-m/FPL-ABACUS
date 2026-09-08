"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/gaffer/Wordmark";
import { AskBar } from "@/components/gaffer/ask/AskBar";
import { CommandPalette } from "@/components/gaffer/CommandPalette";
import { ThemeToggle } from "@/components/primitives/ThemeToggle";
import { cn } from "@/lib/ui/cn";

// FLOODLIGHT §11 IA — the primary destinations. The thumb bar carries the five
// that get used mid-gameweek, and nothing else: the stat boards are modes on
// the Field, and the Arcade — where you pick your gaffer — hangs off the badge
// in the header, which is a picture of the gaffers themselves.
//
// `thumb: false` is the release valve. Combinations is a before-the-deadline
// tool, not a mid-gameweek one, so it has no claim on a thumb slot — but it
// was reachable only from a link inside the Planner header, which is to say
// not reachable at all. It takes the desktop nav, where there is room, and
// the Planner carries it on a phone.
//
// Newsdesk, Film and Manager DNA are reading, not doing: no thumb slot either,
// desktop only. They had no inbound link anywhere — typed-URL pages — which is
// the same failure Combinations had.
//
// The Deadline Cockpit was the last page with that failure, and the worst one
// to lose: it is where the calendar feed lives, so the feature that puts every
// deadline of the season in your phone was reachable only by typing the URL or
// by finding one link inside the Planner header.
const NAV = [
  { href: "/live", label: "Home", short: "Home", thumb: true },
  { href: "/field", label: "Field", short: "Field", thumb: true },
  { href: "/planner", label: "Planner", short: "Plan", thumb: true },
  { href: "/field/combos", label: "Combinations", short: "Pairs", thumb: false },
  { href: "/board", label: "Board", short: "Board", thumb: true },
  { href: "/leagues", label: "Leagues", short: "Mini", thumb: true },
  { href: "/deadline", label: "Deadline", short: "Lock", thumb: false },
  { href: "/news", label: "Newsdesk", short: "News", thumb: false },
  { href: "/film", label: "Film", short: "Film", thumb: false },
  { href: "/dna", label: "Manager DNA", short: "DNA", thumb: false },
] as const;

const THUMB = NAV.filter((item) => item.thumb);

/**
 * The shell. `liveSlot` and `statusSlot` arrive as already-rendered server
 * fragments wrapped in Suspense, so the chrome paints on the first flush and
 * upstream latency only delays the pills.
 *
 * The gameweek status used to float over the page as a fixed pill above the
 * thumb bar, which meant it sat on top of whatever you were reading on a
 * phone. It lives in the header now, with the fuller read on the landing page
 * and everything behind it one tap away at Matchday.
 *
 * Both bars are glass: the page passes behind them blurred rather than
 * disappearing under an opaque slab, so you keep your place while scrolling.
 * They are the two elements in the app that every screen scrolls behind, which
 * is exactly what the material is for — and the ring the glass carries does
 * the separating that a border used to, so there is no second hairline.
 */
export function AppShell({
  teamId,
  liveSlot,
  statusSlot,
  children,
}: {
  teamId: number | null;
  liveSlot?: React.ReactNode;
  statusSlot?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  /*
   * Most specific wins. Combinations lives at /field/combos, so a plain
   * prefix test lights up Field and Combinations at once and the chrome says
   * you are in two places. Match the longest href that covers the path.
   */
  const covers = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const deepest = NAV.filter((item) => covers(item.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  const isActive = (href: string) => deepest?.href === href;

  return (
    <div className="min-h-dvh">
      <div className="atmos" aria-hidden="true" />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 h-14 glass">
          <div className="mx-auto flex h-full max-w-[1360px] items-center gap-4 px-4 md:px-6">
            {/* The brand is the way into the Arcade: the badge is the four
                gaffers, and the Arcade is where you choose which one talks to
                you. It came off the thumb bar to make room there. */}
            <Link
              href="/arcade"
              aria-label="The Arcade — pick your gaffer"
              className="text-lg shrink-0 rounded-md transition-opacity dur-instant hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt"
            >
              <Wordmark compact />
            </Link>
            <nav aria-label="Primary" className="hidden xl:flex min-w-0 flex-1 items-center gap-1 ml-2">
              {THUMB.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  /* Never prefetched — see the thumb bar below for why. */
                  prefetch={false}
                  className={cn(
                    "h-11 inline-flex items-center whitespace-nowrap rounded-md px-2 text-xs transition-colors dur-instant",
                    isActive(item.href)
                      ? "bg-surface-3 text-ink-1 font-medium"
                      : "text-ink-3 hover:text-ink-1 hover:bg-surface-3/60",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap">
              <ExploreNav pathname={pathname} />
              {liveSlot}
              <CommandPalette />
              <AskBar />
              {teamId != null && statusSlot}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-[1360px] px-4 md:px-6 py-8 pb-28 xl:pb-12">{children}</main>

        <nav
          aria-label="Primary mobile"
          /* `display` belongs in the class list, not the style attribute: an
             inline `display:grid` outranks every class, so `lg:hidden` never
             fired and the phone thumb bar sat under the desktop nav on wide
             screens. Only the column count — which follows NAV — stays inline. */
          className="xl:hidden grid gap-1.5 fixed inset-x-0 bottom-0 z-40 glass px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
          style={{ gridTemplateColumns: `repeat(${THUMB.length}, minmax(0, 1fr))` }}
        >
          {THUMB.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              /*
               * Never prefetched.
               *
               * Every destination in NAV is force-dynamic and the shell is on
               * every screen, so the default fired six or seven RSC requests
               * on every single page view, for pages nobody had asked for —
               * measured in the browser, not assumed. A dynamic route's
               * payload cannot be reused, so that is work spent for nothing.
               *
               * Navigation feels the same without it: these are server renders
               * of 130ms, and the click starts one rather than waiting on a
               * speculative one.
               */
              prefetch={false}
              className={cn(
                "skewed flex h-11 min-w-[44px] items-center justify-center rounded-md text-2xs upper-label transition-colors dur-instant",
                isActive(item.href)
                  ? "bg-volt font-semibold text-on-accent"
                  : "bg-raised text-ink-mid card-ring hover:text-ink-hi hover:bg-surface-3",
              )}
            >
              <span>{item.short}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

/** Secondary tools stay one tap away without squeezing primary navigation. */
function ExploreNav({ pathname }: { pathname: string }) {
  const ref = React.useRef<HTMLDetailsElement>(null);
  React.useEffect(() => {
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target) && ref.current) ref.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <details ref={ref} className="relative" onKeyDown={(event) => {
      if (event.key === "Escape" && ref.current) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    }}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md px-2 text-xs text-ink-mid hover:bg-surface-3 [&::-webkit-details-marker]:hidden">More <span aria-hidden>⌄</span></summary>
      <nav aria-label="Explore GAFFER" className="absolute right-0 top-full mt-2 w-60 rounded-lg bg-overlay card-lift p-2">
        <p className="upper-label px-3 py-2 text-2xs text-ink-lo">See the bigger picture</p>
        {NAV.filter((item) => !item.thumb).map((item) => <Link key={item.href} href={item.href} prefetch={false} aria-current={pathname === item.href ? "page" : undefined} onClick={() => { if (ref.current) ref.current.open = false; }} className="flex min-h-11 items-center rounded-md px-3 text-sm text-ink-mid hover:bg-surface-3 hover:text-ink-hi aria-[current=page]:text-volt">{item.label}</Link>)}
        <Link href="/" prefetch={false} onClick={() => { if (ref.current) ref.current.open = false; }} className="mt-1 flex min-h-11 items-center border-t border-hairline px-3 text-sm text-ink-mid hover:text-ink-hi">Change team</Link>
      </nav>
    </details>
  );
}
