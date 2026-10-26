import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page shows live personal data, so we render on request
  // instead of opting into Cache Components.
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    // Meal photos are resized in the browser, but still need more than the 1 MB default.
    serverActions: { bodySizeLimit: "6mb" },
  },
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
