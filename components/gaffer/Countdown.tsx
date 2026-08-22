"use client";

import * as React from "react";

export function Countdown({ deadlineTime }: { deadlineTime: string }) {
  const target = new Date(deadlineTime).getTime();
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (now === null) return <div className="h-12" aria-hidden />; // hydration-safe placeholder

  const diff = Math.max(0, target - now);
  const urgent = diff < 3 * 3_600_000;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);

  return (
    <div
      role="timer"
      aria-label={`Deadline countdown: ${days} days ${hours} hours ${mins} minutes`}
      className={`rounded-lg p-5 num-tabular ${urgent ? "bg-critical/10" : "bg-surface-1 card-ring"}`}
    >
      <div className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Deadline</div>
      <div className={`font-semibold text-3xl tracking-hero ${urgent ? "text-critical" : "text-ink-1"}`}>
        {days > 0 && `${days}d `}
        {String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>
      <p className="mt-1 text-xs text-ink-3">
        {new Date(deadlineTime).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}
