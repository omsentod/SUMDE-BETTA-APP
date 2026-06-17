import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // rewrites only apply during `next dev` (ignored in static export build)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.BACKEND_API_URL || 'http://localhost:5005/api/:path*',
      },
    ];
  },
};

export default nextConfig;
