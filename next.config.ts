import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components' timer scheduling hangs in the Workers runtime.
  // These replay routes prerender without Cache Components or partial prefetching.
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
