import path from "node:path";
import type { NextConfig } from "next";

// Type errors and hook-order bugs fail the build (ignoring them is how a crashing page shipped).
const nextConfig: NextConfig = {
  // The repo root has its own package-lock.json; the app is this folder.
  outputFileTracingRoot: path.join(__dirname),
  async redirects() {
    // The product was renamed from Mutiny to Something; keep old links working.
    return [{ source: "/founder/mutiny", destination: "/founder/something", permanent: true }]
  },
};

export default nextConfig;
