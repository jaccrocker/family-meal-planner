import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone server bundle for the homelab Docker image.
  output: "standalone",
  // Do not write a managed AGENTS.md on `next dev`.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
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
