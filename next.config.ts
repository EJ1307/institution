import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows several dev servers to run side by side (e.g. NEXT_DIST_DIR=.next-b next dev -p 3001)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  // The portal starts at sign-in. Redirect on the server so "/" never renders an
  // empty page while waiting for client-side JavaScript.
  async redirects() {
    return [{ source: "/", destination: "/login", permanent: false }];
  },
};

export default nextConfig;
