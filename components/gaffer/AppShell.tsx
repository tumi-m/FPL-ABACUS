"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/gaffer/Wordmark";
import { AskBar } from "@/components/gaffer/ask/AskBar";
import { ThemeToggle } from "@/components/primitives/ThemeToggle";
import { cn } from "@/lib/ui/cn";

// FLOODLIGHT §11 IA — the primary destinations. The thumb bar carries the five
// that get used mid-gameweek, and nothing else: the stat boards are modes on
// the Field, and the Arcade — where you pick your gaffer — hangs off the badge
// in the header, which is a picture of the gaffers themselves.
const NAV = [
  { href: "/live", label: "Home", short: "Home" },
  { href: "/field", label: "Field", short: "Field" },
  { href: "/planner", label: "Planner", short: "Plan" },
  { href: "/board", label: "Board", short: "Board" },
  { href: "/leagues", label: "Leagues", short: "Mini" },
] as const;

/**
 * The shell. `liveSlot` and `statusSlot` arrive as already-rendered server
 * fragments wrapped in Suspense, so the chrome paints on the first flush and
 * upstream latency only delays the pills.
 *
 * The gameweek status used to float over the page as a fixed pill above the
 * thumb bar, which meant it sat on top of whatever you were reading on a
 * phone. It lives in the header now, with the fuller read on the landing page
 * and everything behind it one tap away at Matchday.
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
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-dvh">
      <div className="atmos" aria-hidden="true" />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 h-14 bg-surface-0/90 backdrop-blur border-b border-hairline">
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
              <AskBar />
              {teamId != null && statusSlot}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-[1360px] px-4 md:px-6 py-8 pb-28 lg:pb-12">{children}</main>

        <nav
          aria-label="Primary mobile"
          className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface-0/90 px-2 pt-2 backdrop-blur pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
          style={{ gridTemplateColumns: `repeat(${NAV.length}, minmax(0, 1fr))`, display: "grid", gap: 6 }}
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
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
