import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page shows live personal data, so we render on request
  // instead of opting into Cache Components.
  serverExternalPackages: ["@libsql/client", "libsql"],
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
