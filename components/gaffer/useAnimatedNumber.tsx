"use client";

import * as React from "react";

const DURATION = 420;

/** Count-up over dur-slow; disabled under prefers-reduced-motion. */
export function useAnimatedNumber(target: number): number {
  const [display, setDisplay] = React.useState(target);
  const fromRef = React.useRef(target);
  const rafRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 4);
      const current = from + (target - from) * eased;
      setDisplay(current);
      fromRef.current = current;
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return display;
}

export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const animated = useAnimatedNumber(value);
  return (
    <span className={className} key={value}>
      {format ? format(animated) : Math.round(animated).toLocaleString("en-GB")}
    </span>
  );
}
