"use client";

import * as React from "react";
import { fingerprintStrokes, type GwRecord } from "@/lib/generative/specs";

const TONE: Record<string, string> = {
  surge: "var(--surge)",
  flare: "var(--flare)",
  line: "var(--line-hi)",
};

/**
 * Season fingerprint (v2 §8) — one deterministic spoke per gameweek on a
 * canvas sized to the container. Drawn once; no animation loop. dPR capped
 * at 2 so retina stays crisp without burning fill-rate.
 */
export function SeasonFingerprint({
  seed,
  records,
  ariaLabel = "Radial fingerprint of your season, one spoke per gameweek",
}: {
  seed: number;
  records: GwRecord[];
  ariaLabel?: string;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const cssW = parent.clientWidth;
    const cssH = Math.max(220, Math.min(360, cssW * 0.6));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    // Read computed tokens so theme switches stay correct after redraw.
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string) => styles.getPropertyValue(name).trim() || "var(--line-hi)";

    const cx = cssW / 2;
    const cy = cssH / 2;
    const rOuter = Math.min(cssW, cssH) / 2 - 14;
    const strokes = fingerprintStrokes(seed, records);

    // base ring
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter * 0.42, 0, Math.PI * 2);
    ctx.strokeStyle = token("--line");
    ctx.lineWidth = 1;
    ctx.stroke();

    for (const s of strokes) {
      const r0 = rOuter * 0.42;
      const r1 = r0 + (rOuter - r0 - 4) * (0.25 + 0.75 * s.length) * (0.55 + 0.45 * s.magnitude);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(s.angle) * r0, cy + Math.sin(s.angle) * r0);
      ctx.lineTo(cx + Math.cos(s.angle) * r1, cy + Math.sin(s.angle) * r1);
      ctx.strokeStyle = TONE[s.tone] ?? token("--line-hi");
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, [seed, records]);

  return (
    <div className="w-full" role="img" aria-label={ariaLabel}>
      <canvas ref={ref} className="block w-full" />
    </div>
  );
}
