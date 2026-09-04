"use client";

/**
 * Global error boundary — the last catch.
 *
 * `app/(app)/error.tsx` covers route segments while the root layout is still
 * mounted. When the root layout itself throws there is nothing left to render
 * into, so Next needs this file. It renders its own <html> because no shell
 * survives whatever happened here — and its colours are inline because when
 * this renders, globals.css was never loaded for tokens to point at.
 */

import { COPY } from "@/lib/copy/deck";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#010C1F",
          color: "#F5FBF7",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
            {COPY.global.title}
          </h1>
          <p style={{ fontSize: 12, lineHeight: 1.6, opacity: 0.7, marginTop: 8 }}>
            {COPY.global.body}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              height: 36,
              padding: "0 16px",
              borderRadius: 6,
              border: "1px solid rgba(245,251,247,.25)",
              background: "transparent",
              color: "inherit",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ fontSize: 10, opacity: 0.45, marginTop: 16 }}>ref {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}