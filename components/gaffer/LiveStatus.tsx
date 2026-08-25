import Link from "next/link";
import type { LiveBarData } from "@/lib/ui/types";
import { LiveDot } from "@/components/gaffer/LiveDot";
import { cn } from "@/lib/ui/cn";

/**
 * The gameweek status, in two shapes.
 *
 * It used to be one fixed pill floating above the thumb bar on every screen.
 * On a phone that meant a permanent lozenge sitting on top of whatever you
 * were reading — the bottom of a table, the last row of the pitch — for the
 * sake of a number you could already see in the header. So it split in two:
 * a compact chip in the app header, and a full read on the landing page where
 * there is room to say what the week is actually doing.
 *
 * Both go to Matchday, which is where the detail lives.
 */

/** Header chip — the state in a glance, never over the content. */
export function StatusChip({ data }: { data: LiveBarData }) {
  const isLive = data.phase === "live" || data.phase === "provisional";
  const moment = data.moment;
  if (!isLive && !moment) return null;

  return (
    <Link
      href="/live"
      aria-label={
        isLive
          ? `Live, gameweek ${data.gameweek}, ${data.fixturesInPlay} fixtures in play`
          : `Gameweek ${data.gameweek} — ${moment?.label}`
      }
      className="skewed inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md card-ring px-2.5 text-2xs uppercase-label text-ink-mid num-tabular transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi sm:px-3"
    >
      {isLive ? (
        <>
          <LiveDot />
          <span className="font-semibold text-ink-hi">Live</span>
          {data.latestMinute != null && (
            <span className="hidden sm:inline">{Math.min(data.latestMinute, 90)}&prime;</span>
          )}
          <span className="hidden md:inline">{data.fixturesInPlay} in play</span>
        </>
      ) : (
        moment && (
          <>
            <span
              aria-hidden
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                moment.key === "warroom" ? "bg-warning" : "bg-hairline-strong",
              )}
            />
            <span className="hidden font-semibold text-ink-hi sm:inline">{moment.label}</span>
            <span>GW{data.gameweek}</span>
          </>
        )
      )}
    </Link>
  );
}

/**
 * Landing panel — the same state with room to breathe.
 *
 * The landing page is where somebody arrives without knowing what the week is
 * doing, so this is the one place that spells it out rather than abbreviating.
 */
export function StatusPanel({ data }: { data: LiveBarData }) {
  const isLive = data.phase === "live" || data.phase === "provisional";
  const moment = data.moment;
  if (!isLive && !moment) return null;

  return (
    <Link
      href="/live"
      className="group inline-flex items-center gap-3 rounded-lg border border-white/15 bg-black/40 px-4 py-2.5 backdrop-blur-[2px] transition-colors dur-instant hover:border-white/30 hover:bg-black/55"
    >
      {isLive ? (
        <>
          <LiveDot />
          <span className="text-xs font-semibold uppercase tracking-wide text-white/95">
            Live · GW{data.gameweek}
          </span>
          <span aria-hidden className="h-3.5 w-px bg-white/20" />
          <span className="num-tabular text-xs text-white/70">
            {data.fixturesInPlay} {data.fixturesInPlay === 1 ? "fixture" : "fixtures"} in play
            {data.latestMinute != null ? ` · ${Math.min(data.latestMinute, 90)}′` : ""}
          </span>
        </>
      ) : (
        moment && (
          <>
            <span
              aria-hidden
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                moment.key === "warroom" ? "bg-warning" : "bg-white/40",
              )}
            />
            <span className="text-xs font-semibold uppercase tracking-wide text-white/95">
              {moment.label}
            </span>
            <span aria-hidden className="h-3.5 w-px bg-white/20" />
            <span className="num-tabular text-xs text-white/70">Gameweek {data.gameweek}</span>
          </>
        )
      )}
      <span aria-hidden className="text-xs text-white/45 transition-transform dur-instant group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
