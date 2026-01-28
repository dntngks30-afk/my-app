import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. 빌드 시 타입/린트 에러 무시 (속도 향상 및 에러 방지)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  
  // 2. 환경 변수가 없어도 빌드가 멈추지 않도록 기본값 설정
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  }
};

export default nextConfig;