import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal standalone server for the Docker/Cloud Run image.
  output: "standalone",
};

export default nextConfig;
