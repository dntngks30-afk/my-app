'use client';

import { useState } from 'react';
import AuthCard from '@/components/auth/AuthCard';

interface AppAuthClientProps {
  next: string;
  errorParam?: string | null;
}

export default function AppAuthClient({ next, errorParam }: AppAuthClientProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-center">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            mode === 'login'
              ? 'bg-[var(--brand)] text-white'
              : 'bg-[var(--surface-2)] text-[var(--muted)]'
          }`}
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            mode === 'signup'
              ? 'bg-[var(--brand)] text-white'
              : 'bg-[var(--surface-2)] text-[var(--muted)]'
          }`}
        >
          회원가입
        </button>
      </div>
      <AuthCard
        mode={mode}
        errorParam={errorParam}
        redirectTo={mode === 'login' ? next : '/'}
      />
    </div>
  );
}
