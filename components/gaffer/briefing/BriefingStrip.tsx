"use client";

import * as React from "react";
import Link from "next/link";
import { Est } from "@/components/gaffer/Est";
import { useWatchlist } from "@/components/gaffer/watch/useWatchlist";
import type { BriefingLine } from "@/lib/engines/briefing";

/**
 * The gaffer's opening line (v10 B2) — the proactive half of the assistant.
 *
 * Five deterministic triggers, composed server-side, rendered as a strip of
 * lines. With no triggers the component renders nothing at all: an assistant
 * that pads is a search box with a personality crisis. "Since you last
 * looked" is honest because the strip keeps its own clock — the last-seen
 * timestamp is recorded per browser, so the phrase names this device's
 * previous visit, and the triggers underneath are re-detected fresh.
 */

type State =
  | { kind: "idle" }
  | { kind: "ready"; lines: BriefingLine[] };

const LAST_SEEN_KEY = "gaffer_briefing_seen";

function readLastSeen(): number | null {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function stampLastSeen(): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
  } catch {
    /* storage blocked — the strip still reads, it just cannot date-stamp */
  }
}

export function BriefingStrip({ entryId }: { entryId: number }) {
  const { ids } = useWatchlist();
  const watchKey = ids.join(",");
  const [state, setState] = React.useState<State>({ kind: "idle" });

  React.useEffect(() => {
    let live = true;
    const load = () => {
      fetch(
        `/api/gaffer/briefing?entry=${entryId}${watchKey ? `&watch=${encodeURIComponent(watchKey)}` : ""}`,
      )
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: { lines: BriefingLine[] }) => {
          if (live) setState({ kind: "ready", lines: d.lines ?? [] });
        })
        .catch(() => {
          // Silence is the contract: a failed enhancement renders nothing.
          if (live) setState({ kind: "ready", lines: [] });
        });
    };
    load();
    return () => {
      live = false;
    };
  }, [entryId, watchKey]);

  // Stamp after a successful paint so "since you last looked" means the
  // previous visit, not this render cycle.
  React.useEffect(() => {
    if (state.kind === "ready") stampLastSeen();
  }, [state]);

  if (state.kind !== "ready" || state.lines.length === 0) return null;

  return (
    <BriefingView lines={state.lines} lastSeen={readLastSeen()} />
  );
}

function BriefingView({ lines, lastSeen }: { lines: BriefingLine[]; lastSeen: number | null }) {
  const since = lastSeen
    ? new Date(lastSeen).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;
  return (
    <section
      aria-label="The gaffer's briefing"
      className="rounded-lg bg-raised card-ring px-4 py-3"
    >
      <div className="mb-1.5 flex items-baseline gap-2">
        <h2 className="text-2xs font-semibold uppercase tracking-wide text-ink-3">
          The gaffer&rsquo;s briefing
        </h2>
        {since && (
          <span className="text-2xs text-ink-lo">first read since {since}</span>
        )}
      </div>
      <ul className="space-y-1">
        {lines.map((line) => (
          <LineRow key={line.id} line={line} />
        ))}
      </ul>
    </section>
  );
}

const STATE_CLASS: Record<BriefingLine["state"], string> = {
  critical: "text-critical",
  warn: "text-warning",
  note: "text-ink-2",
};

const STATE_GLYPH: Record<BriefingLine["state"], string> = {
  critical: "✕",
  warn: "!",
  note: "·",
};

function LineRow({ line }: { line: BriefingLine }) {
  const body = (
    <>
      <span aria-hidden className={`shrink-0 font-bold ${STATE_CLASS[line.state]}`}>
        {STATE_GLYPH[line.state]}
      </span>
      <span className="min-w-0 flex-1 text-sm leading-snug text-ink-1">
        {line.text}
        {line.est && (
          <span className="ml-1.5 fig-num text-sm text-ink-hi">
            <Est method={line.est.method}>{line.est.value}</Est>
          </span>
        )}
      </span>
    </>
  );
  return (
    <li>
      {line.href ? (
        <Link
          href={line.href}
          className="flex items-start gap-2 rounded-md px-1 py-1 transition-colors dur-instant hover:bg-surface-2"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-2 px-1 py-1">{body}</div>
      )}
    </li>
  );
}