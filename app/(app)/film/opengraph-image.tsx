import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "FPL Gaffer — The Film: your season as an archive";

/** Share card for /film — deterministic sigil geometry, broadcast styling. */
export default function OpengraphImage() {
  // Fixed seed keeps the OG image stable (deterministic-art rule §8).
  const spec = { petals: 9, len: [0.9, 0.62, 0.78, 0.55, 0.86, 0.7, 0.6, 0.82, 0.66] };
  const cx = 600;
  const cy = 315;
  const rMax = 190;

  const petals = Array.from({ length: spec.petals }, (_, i) => {
    const a = (i / spec.petals) * Math.PI * 2 - Math.PI / 2;
    const len = rMax * spec.len[i];
    return (
      <path
        key={i}
        d={`M ${cx} ${cy} Q ${cx + Math.cos(a + 0.4) * len * 0.32} ${cy + Math.sin(a + 0.4) * len * 0.32} ${cx + Math.cos(a) * len} ${cy + Math.sin(a) * len}`}
        fill="none"
        stroke="#0AD0FF"
        strokeWidth="4"
        strokeLinecap="round"
        opacity={i % 2 === 0 ? 0.95 : 0.45}
      />
    );
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(178deg, #08213D, #030F22 78%)",
          position: "relative",
        }}
      >
        <svg width="480" height="480" viewBox="0 0 220 220" style={{ position: "absolute", top: -60 }}>
          {[18, 26, 34].map((r, i) => (
            <circle key={i} cx={110} cy={110} r={r * (0.55 + i * 0.15)} fill="none" stroke="#36597D" strokeDasharray="8 13" />
          ))}
          {petals.map((p) => p)}
          <circle cx={110} cy={110} r={20} fill="#061A31" stroke="#9DF0FF" strokeWidth="1.5" />
        </svg>
        <div
          style={{
            marginTop: 300,
            fontSize: 88,
            fontWeight: 900,
            fontStyle: "italic",
            color: "#EFF8FF",
            letterSpacing: "-0.03em",
          }}
        >
          The Film
        </div>
        <div style={{ marginTop: 12, fontSize: 28, color: "#87A2BB" }}>Your season, archived · FPL Gaffer</div>
      </div>
    ),
    size,
  );
}
