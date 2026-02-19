'use client';

import AuthCard from '@/components/auth/AuthCard';

interface SignupClientProps {
  errorParam?: string | null;
}

export default function SignupClient({ errorParam }: SignupClientProps) {
  return <AuthCard mode="signup" errorParam={errorParam} />;
}
