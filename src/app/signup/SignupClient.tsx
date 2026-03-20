'use client';

import AuthCard from '@/components/auth/AuthCard';

/** 로그인·회원가입 후 기본 복귀 (app/auth/page.tsx와 동일 계약) */
const DEFAULT_POST_AUTH_PATH = '/app/home';

interface SignupClientProps {
  errorParam?: string | null;
  /** 결과·실행 퍼널 복귀용. 유효하지 않으면 기본 경로 */
  next?: string;
}

function resolveRedirectTo(next: string | undefined): string {
  if (typeof next !== 'string') return DEFAULT_POST_AUTH_PATH;
  const t = next.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return DEFAULT_POST_AUTH_PATH;
  return t;
}

export default function SignupClient({ errorParam, next }: SignupClientProps) {
  return <AuthCard mode="signup" errorParam={errorParam} redirectTo={resolveRedirectTo(next)} />;
}
