'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

interface CallbackClientProps {
  codeParam?: string | null;
  nextParam?: string | null;
}

function sanitizeNext(next: string | null | undefined): string {
  if (!next || typeof next !== 'string') return '/app';
  const trimmed = next.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/app';
  return trimmed;
}

export default function CallbackClient({ codeParam, nextParam }: CallbackClientProps) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const code = codeParam ?? null;
      const next = sanitizeNext(nextParam);

      if (!code) {
        router.replace('/app/auth?error=oauth');
        return;
      }

      const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);

      if (cancelled) return;

      if (error) {
        router.replace('/app/auth?error=oauth');
        return;
      }

      router.replace(next);
    }

    run();
    return () => { cancelled = true; };
  }, [codeParam, nextParam, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <p className="text-sm text-[var(--muted)]">처리 중...</p>
    </div>
  );
}
