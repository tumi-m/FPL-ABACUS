"use client";

import * as React from "react";
import { mulberry32 } from "@/lib/engines/simulate";

const FRAME_MS = 1000 / 12; // 12fps per spec §8 — deliberate, filmic
const BLOBS = 5;

/**
 * Reactive aurora (v2 §8) — slow colour wash behind hero sections. Runs at a
 * hard-capped 12fps and STOPS entirely under prefers-reduced-motion or when
 * Save-Data is on. Pauses when the tab is hidden.
 */
export function Aurora({ seed = 1 }: { seed?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (reduced || saveData) return; // static gradient stays as painted below

    const rng = mulberry32(seed);
    const blobs = Array.from({ length: BLOBS }, () => ({
      x: rng(),
      y: rng(),
      vx: (rng() - 0.5) * 0.0016,
      vy: (rng() - 0.5) * 0.0011,
      r: 0.25 + rng() * 0.2,
      hue: rng() < 0.5 ? "10,208,255" : "157,240,255",
    }));

    let raf = 0;
    let last = 0;
    let stopped = false;

    const paint = (t: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(paint);
      if (t - last < FRAME_MS) return; // hold 12fps
      last = t;
      for (const b of blobs) {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < -0.2 || b.x > 1.2) b.vx *= -1;
        if (b.y < -0.2 || b.y > 1.2) b.vy *= -1;
      }
      el.style.backgroundImage = blobs
        .map(
          (b) =>
            `radial-gradient(${(b.r * 100).toFixed(0)}% ${(b.r * 80).toFixed(0)}% at ${(b.x * 100).toFixed(1)}% ${(b.y * 100).toFixed(1)}%, rgba(${b.hue},0.055), transparent 70%)`,
        )
        .join(", ");
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = 0;
        raf = requestAnimationFrame(paint);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(paint);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [seed]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        ref={ref}
        className="absolute inset-[-20%]"
        style={{
          backgroundImage:
            "radial-gradient(40% 32% at 22% 30%, rgba(10,208,255,.05), transparent 70%), radial-gradient(34% 28% at 74% 62%, rgba(157,240,255,.045), transparent 70%)",
        }}
      />
    </div>
  );
}
