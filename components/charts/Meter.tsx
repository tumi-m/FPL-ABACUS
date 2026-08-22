"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";

/** Single horizontal progress meter — DEFCON, price pressure. */
export function Meter({
  value,
  label,
  hint,
  tone = "brand",
  className,
}: {
  /** 0..1 */
  value: number;
  label?: string;
  hint?: string;
  tone?: "brand" | "warning";
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className={cn("w-full", className)}>
      {(label || hint) && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          {label && <span className="text-2xs font-semibold uppercase tracking-wide text-ink-3">{label}</span>}
          {hint && <span className="text-xs text-ink-2 num-tabular">{hint}</span>}
        </div>
      )}
      <div
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "progress"}
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--surface-3)" }}
      >
        <div
          className="h-full rounded-full transition-all dur-slow ease-out-quint"
          style={{ width: `${pct}%`, background: tone === "warning" ? "var(--warning)" : "var(--brand)" }}
        />
      </div>
    </div>
  );
}

/** Bullet bar — your value vs cohort target with a range band. */
export function BulletBar({
  value,
  target,
  band,
  max = 100,
  label,
  formatValue = (v: number) => String(Math.round(v)),
}: {
  value: number;
  target?: number;
  band?: [number, number];
  max?: number;
  label?: string;
  formatValue?: (v: number) => string;
}) {
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-2xs font-semibold uppercase tracking-wide text-ink-3">{label}</span>
          <span className="text-xs text-ink-1 num-tabular font-medium">{formatValue(value)}</span>
        </div>
      )}
      <div className="relative h-3 w-full rounded-full" style={{ background: "var(--surface-3)" }}>
        {band && (
          <div
            aria-hidden
            className="absolute top-0 h-full rounded-full"
            style={{ left: pct(band[0]), width: pct(band[1] - band[0]), background: "var(--seq-100)" }}
          />
        )}
        <div
          className="absolute top-[3px] h-[6px] rounded-full"
          style={{ left: 0, width: pct(value), background: entityYou() }}
        />
        {target !== undefined && (
          <div
            aria-hidden
            className="absolute top-[-2px] h-[16px] w-[2px] rounded-full"
            style={{ left: pct(target), background: "var(--ink-3)" }}
            title={`Cohort ${formatValue(target)}`}
          />
        )}
      </div>
    </div>
  );
}

function entityYou() {
  return "var(--series-3)";
}
