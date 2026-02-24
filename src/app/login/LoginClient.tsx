'use client';

import AuthCard from '@/components/auth/AuthCard';

interface LoginClientProps {
  errorParam?: string | null;
  /** 로그인 성공 후 복귀할 경로 (예: /deep-analysis) */
  nextParam?: string | null;
}

export default function LoginClient({ errorParam, nextParam }: LoginClientProps) {
  const redirectTo = nextParam && nextParam.startsWith('/') ? nextParam : '/';
  return <AuthCard mode="login" errorParam={errorParam} redirectTo={redirectTo} />;
}
