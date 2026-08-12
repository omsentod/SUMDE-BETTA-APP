import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  async headers() {
    return [
      {
        // HTML pages — jangan di-cache CDN/browser. HTML refer ke chunk hash
        // yang berubah tiap build; kalau HTML stale, chunk-nya 404.
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
      {
        // Static asset — nama file sudah hashed, aman immutable cache.
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
