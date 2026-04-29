import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  sw: "sw.js",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    skipWaiting: false,
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

  // API 라우트 body size 제한 설정
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default withPWA(nextConfig);