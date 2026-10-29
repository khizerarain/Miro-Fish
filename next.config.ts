import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Default bottom-left sits on top of the sidebar's "New experiment" button.
  devIndicators: { position: "bottom-right" },
  experimental: {
    // Drafts can carry a downscaled ad image (≤ ~0.9 MB as a data URL).
    serverActions: { bodySizeLimit: "2mb" },
  },
  // PGlite ships WASM + data files that must be loaded from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
