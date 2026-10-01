import type { NextConfig } from "next";

// Type errors and hook-order bugs fail the build (ignoring them is how a crashing page shipped).
const nextConfig: NextConfig = {
  async redirects() {
    // The product was renamed from Mutiny to Something; keep old links working.
    return [{ source: "/founder/mutiny", destination: "/founder/something", permanent: true }]
  },
};

export default nextConfig;
