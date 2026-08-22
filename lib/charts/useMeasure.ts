"use client";

import * as React from "react";

export function useMeasure<T extends HTMLElement = HTMLDivElement>(): [
  React.RefObject<T | null>,
  { width: number; height: number },
] {
  const ref = React.useRef<T | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.contentRect;
        setSize({ width: Math.round(box.width), height: Math.round(box.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}
