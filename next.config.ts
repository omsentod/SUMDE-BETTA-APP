import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  experimental: {
    cpus: 4,
  },
  async headers() {
    // Di dev Turbopack pakai URL chunk yg stabil (nama sama walau isi berubah);
    // kalau kita apply cache 1-year immutable, browser serve JS lama selamanya
    // dan setiap edit tidak muncul. Rules hanya aktif di production build.
    if (process.env.NODE_ENV !== 'production') return [];
    return [
      {
        // Public static media assets — beri cache 30 hari dengan revalidasi harian
        source: '/(img|uploads|courier)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      },
      {
        // Favicon & logo icon
        source: '/favicon.ico',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      },
      {
        // Static asset Next.js — nama file sudah hashed, aman immutable cache 1 tahun.
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // HTML pages & dynamic routes — jangan di-cache CDN/browser agar data selalu fresh.
        source: '/((?!_next/static|_next/image|img|uploads|courier|favicon.ico).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
