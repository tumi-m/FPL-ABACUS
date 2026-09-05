"use client";

import * as React from "react";

/**
 * The share affordance (v10 E3). Writes the OG card's URL to the clipboard —
 * a share link is a crawler's URL, and the card is what the crawler renders.
 * navigator.share when the platform has it, clipboard always, and a visible
 * confirmation either way: a button that says "Copied" and means it.
 */
export function ShareCard({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  const url = React.useMemo(() => {
    if (typeof window === "undefined") return path;
    return new URL(path, window.location.origin).toString();
  }, [path]);

  const share = async () => {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    try {
      if (nav.share) {
        await nav.share({ title: "FPL Gaffer", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user dismissed the sheet — nothing to confirm */
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="skewed inline-flex h-8 shrink-0 items-center rounded-md card-ring bg-surface-0 px-3 text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
    >
      <span>{copied ? "Link copied" : label}</span>
    </button>
  );
}