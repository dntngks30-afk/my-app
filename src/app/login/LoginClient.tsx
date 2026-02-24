'use client';

import AuthCard from '@/components/auth/AuthCard';

interface LoginClientProps {
  errorParam?: string | null;
}

export default function LoginClient({ errorParam }: LoginClientProps) {
  return <AuthCard mode="login" errorParam={errorParam} />;
}
