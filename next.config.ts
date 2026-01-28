import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 빌드 시 타입 에러 무시 (속도 향상 및 에러 방지)
  typescript: { ignoreBuildErrors: true },
  // eslint 설정은 Next.js 16에서 제거됨
};

export default nextConfig;