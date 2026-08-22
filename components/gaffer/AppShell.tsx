"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/gaffer/Wordmark";
import { LiveBar } from "@/components/gaffer/LiveBar";
import { ThemeToggle } from "@/components/primitives/ThemeToggle";
import { Sheet, SheetContent, SheetTitle } from "@/components/primitives/Sheet";
import { ChevronRight } from "@/components/primitives/icons";
import type { LiveBarData } from "@/lib/ui/types";
import { cn } from "@/lib/ui/cn";

const NAV = [
  { href: "/live", label: "Matchday" },
  { href: "/squad", label: "Squad" },
  { href: "/leagues", label: "Leagues" },
  { href: "/deadline", label: "Deadline" },
  { href: "/players", label: "Players" },
  { href: "/planner", label: "Planner" },
  { href: "/dna", label: "DNA" },
] as const;

const TABS = ["live", "squad", "leagues", "deadline"] as const;
const MORE = NAV.filter((n) => !TABS.includes(n.href as (typeof TABS)[number]));

export function AppShell({ teamId, teamName, live, children }: { teamId: number | null; teamName: string | null; live?: LiveBarData | null; children?: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-dvh">
      <div className="atmos" aria-hidden="true" />
      <div className="relative z-10 flex min-h-dvh flex-col">
        {live ? (
          <LiveBar data={live} />
        ) : null}
        <header className="sticky top-0 z-40 h-14 bg-surface-0/90 backdrop-blur border-b border-hairline">
          <div className="mx-auto flex h-full max-w-[1360px] items-center gap-4 px-4 md:px-6">
            <Link href="/" className="text-lg shrink-0">
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
              {teamId != null && (
                <span className="hidden sm:inline-flex h-8 items-center rounded-full card-ring px-3 text-xs text-ink-2 num-tabular">
                  {teamName ?? `Team ${teamId}`}
                </span>
              )}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-[1360px] px-4 md:px-6 py-8 pb-24 lg:pb-12">{children}</main>

        <nav
          aria-label="Primary mobile"
          className="lg:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-hairline bg-surface-1/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
        >
          {TABS.map((t) => {
            const item = NAV.find((n) => n.href === `/${t}`)!;
            return (
              <Link
                key={t}
                href={item.href}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-2xs",
                  isActive(item.href) ? "text-brand font-semibold" : "text-ink-3",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-0.5 text-2xs",
                MORE.some((m) => isActive(m.href)) ? "text-brand font-semibold" : "text-ink-3",
              )}
            >
              More
            </button>
            <SheetContent side="bottom">
              <SheetTitle className="mb-3">More</SheetTitle>
              <ul className="divide-y divide-hairline -mx-1">
                {[{ href: "/", label: "Home" }, ...MORE].map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className="flex min-h-11 items-center justify-between px-1 py-2.5 text-base"
                    >
                      {item.label}
                      <ChevronRight className="text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </div>
  );
}
