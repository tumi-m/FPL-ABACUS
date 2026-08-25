import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF first: the trophy hero and every player face drop roughly a third
    // of their transfer size against WebP at the same visual quality.
    formats: ["image/avif", "image/webp"],
    // Faces are served at 40–96px; the default 16→384 ladder wastes a fetch
    // on sizes we never render.
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: "https", hostname: "resources.premierleague.com" },
      { protocol: "https", hostname: "fantasy.premierleague.com" },
    ],
  },
  experimental: {
    // Tree-shake the barrel imports instead of pulling whole packages into
    // every client chunk that touches one component.
    optimizePackageImports: [
      "d3-scale",
      "d3-shape",
      "@radix-ui/react-dialog",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },
  compiler: {
    // Strip console noise from the production bundle (errors still ship).
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
};

export default nextConfig;
