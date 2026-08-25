"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/gaffer/Wordmark";
import { AskBar } from "@/components/gaffer/ask/AskBar";
import { ThemeToggle } from "@/components/primitives/ThemeToggle";
import { cn } from "@/lib/ui/cn";

// FLOODLIGHT §11 IA — the primary destinations. The thumb bar carries the six
// that get used mid-gameweek; the stat boards sit behind the Field, which is
// where you already are when you want them.
const NAV = [
  { href: "/live", label: "Matchday", short: "Live" },
  { href: "/field", label: "Field", short: "Field" },
  { href: "/planner", label: "Planner", short: "Plan" },
  { href: "/board", label: "Board", short: "Board" },
  { href: "/leagues", label: "Leagues", short: "Mini" },
  { href: "/arcade", label: "Arcade", short: "Play" },
] as const;

/** Secondary boards — desktop nav only, linked from the Field as well. */
const BOARDS = [
  { href: "/bonus", label: "Bonus" },
  { href: "/defcon", label: "DEFCON" },
] as const;

/**
 * The shell. `liveSlot` and `statusSlot` arrive as already-rendered server
 * fragments wrapped in Suspense, so the chrome paints on the first flush and
 * upstream latency only delays the pills.
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
        {liveSlot}
        <header className="sticky top-0 z-40 h-14 bg-surface-0/90 backdrop-blur border-b border-hairline">
          <div className="mx-auto flex h-full max-w-[1360px] items-center gap-4 px-4 md:px-6">
            <Link href="/" className="text-lg shrink-0">
              <Wordmark />
            </Link>
            <nav aria-label="Primary" className="hidden lg:flex items-center gap-1 ml-2">
              {[...NAV, ...BOARDS].map((item) => (
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
