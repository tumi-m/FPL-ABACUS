import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "FPL Gaffer — The Field: your team on a night-lit pitch";

/** Share card for /field — the night-lit pitch rendered as a broadcast graphic. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "linear-gradient(178deg, #08213D, #030F22 78%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute", top: -140, left: "50%", transform: "translateX(-50%)",
            width: 900, height: 500,
            background: "radial-gradient(ellipse at center, rgba(157,240,255,.22), transparent 65%)",
          }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {[3, 5, 4].map((n, i) => (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              {Array.from({ length: n }).map((_, j) => (
                <div key={j} style={{
                  width: 64, height: 56, borderRadius: 8,
                  background: ["#FF3B41", "#7CC6F0", "#FFD84D"][i],
                  boxShadow: "inset 0 1px 0 rgba(230,248,255,.35)",
                }} />
              ))}
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 48, fontSize: 84, fontWeight: 900, fontStyle: "italic",
          color: "#EFF8FF", letterSpacing: "-0.03em",
        }}>
          The Field
        </div>
        <div style={{ marginTop: 12, fontSize: 30, color: "#87A2BB" }}>
          Your team, six ways · FPL Gaffer
        </div>
        <div style={{
          position: "absolute", bottom: 40, width: 220, height: 6,
          background: "#0AD0FF", borderRadius: 3,
        }} />
      </div>
    ),
    size,
  );
}
