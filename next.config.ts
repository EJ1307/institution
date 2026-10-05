import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows several dev servers to run side by side (e.g. NEXT_DIST_DIR=.next-b next dev -p 3001)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
};

export default nextConfig;
