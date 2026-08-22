"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "@/components/primitives/icons";
import { cn } from "@/lib/ui/cn";

type ThemeMode = "system" | "light" | "dark";
const KEY = "gaffer_theme";

const OPTIONS: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { mode: "system", label: "System theme", icon: <Monitor /> },
  { mode: "light", label: "Light theme", icon: <Sun /> },
  { mode: "dark", label: "Dark theme", icon: <Moon /> },
];

function apply(mode: ThemeMode) {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themeMode = mode;
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = React.useState<ThemeMode>("system");

  React.useEffect(() => {
    let initial: ThemeMode = "system";
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "light" || stored === "dark" || stored === "system") initial = stored;
    } catch {
      // storage unavailable; keep system
    }
    setMode(initial);
    apply(initial);
  }, []);

  const choose = (next: ThemeMode) => {
    setMode(next);
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("inline-flex items-center gap-0.5 rounded-full card-ring p-0.5", className)}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.mode}
          role="radio"
          aria-checked={mode === o.mode}
          aria-label={o.label}
          onClick={() => choose(o.mode)}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-3 transition-colors dur-instant hover:text-ink-1",
            mode === o.mode && "bg-surface-3 text-ink-1",
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
