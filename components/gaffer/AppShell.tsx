"use client";

import Link from "next/link";
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
const NAV = [
  { href: "/live", label: "Home", short: "Home", thumb: true },
  { href: "/field", label: "Field", short: "Field", thumb: true },
  { href: "/planner", label: "Planner", short: "Plan", thumb: true },
  { href: "/field/combos", label: "Combinations", short: "Pairs", thumb: false },
  { href: "/board", label: "Board", short: "Board", thumb: true },
  { href: "/leagues", label: "Leagues", short: "Mini", thumb: true },
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
              <Wordmark />
            </Link>
            <nav aria-label="Primary" className="hidden lg:flex items-center gap-1 ml-2">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  /* Never prefetched — see the thumb bar below for why. */
                  prefetch={false}
                  className={cn(
                    "h-8 inline-flex items-center rounded-md px-3 text-sm transition-colors dur-instant",
                    isActive(item.href)
                      ? "bg-surface-3 text-ink-1 font-medium"
                      : "text-ink-3 hover:text-ink-1 hover:bg-surface-3/60",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              {liveSlot}
              <CommandPalette />
              <AskBar />
              {teamId != null && statusSlot}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-[1360px] px-4 md:px-6 py-8 pb-28 lg:pb-12">{children}</main>

        <nav
          aria-label="Primary mobile"
          /* `display` belongs in the class list, not the style attribute: an
             inline `display:grid` outranks every class, so `lg:hidden` never
             fired and the phone thumb bar sat under the desktop nav on wide
             screens. Only the column count — which follows NAV — stays inline. */
          className="lg:hidden grid gap-1.5 fixed inset-x-0 bottom-0 z-40 glass px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
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
                "skewed flex h-11 min-w-[44px] items-center justify-center rounded-md text-2xs uppercase-label transition-colors dur-instant",
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
