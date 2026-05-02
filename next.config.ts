import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  sw: "sw.js",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
  },
});

const LEGACY_ROUTES = ['routine', 'reset', 'record', 'my'] as const;

const nextConfig: NextConfig = {
  turbopack: {},
  // 빌드 시 타입 에러 무시 (속도 향상 및 에러 방지)
  typescript: { ignoreBuildErrors: true },
  // eslint 설정은 Next.js 16에서 제거됨

  // Legacy 라우트 containment — canonical: /app/home, public: /
  async redirects() {
    const appLegacy = LEGACY_ROUTES.flatMap((segment) => [
      { source: `/app/${segment}`, destination: '/app/home', permanent: true },
      { source: `/app/${segment}/:path*`, destination: '/app/home', permanent: true },
    ]);

    const legacyTopLevel = [
      { source: '/my-routine', destination: '/app/home', permanent: true },
      { source: '/my-routine/:path*', destination: '/app/home', permanent: true },
      { source: '/full-assessment', destination: '/', permanent: true },
      { source: '/full-assessment/:path*', destination: '/', permanent: true },
    ];

    return [...appLegacy, ...legacyTopLevel];
  },

  async headers() {
    const noStoreHeaders = [
      {
        key: 'Cache-Control',
        value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
      {
        key: 'Pragma',
        value: 'no-cache',
      },
      {
        key: 'Expires',
        value: '0',
      },
    ];

    return [
      {
        source: '/sw.js',
        headers: noStoreHeaders,
      },
      {
        source: '/:file(workbox-.+\\.js)',
        headers: noStoreHeaders,
      },
      {
        source: '/:file(worker-.+\\.js)',
        headers: noStoreHeaders,
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
    ];
  },

  // API 라우트 body size 제한 설정
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default withPWA(nextConfig);