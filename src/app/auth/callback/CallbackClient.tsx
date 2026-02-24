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

/** Supabase가 code를 해시(#)에 넣을 수 있음. 클라이언트에서 쿼리+해시 모두 파싱 */
function getCodeFromClientUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  let code = params.get('code');
  if (code) return code;
  const hash = window.location.hash?.substring(1);
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    code = hashParams.get('code');
  }
  return code;
}

function getNextFromClientUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  let next = params.get('next');
  if (next) return next;
  const hash = window.location.hash?.substring(1);
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    next = hashParams.get('next');
  }
  return next;
}

export default function CallbackClient({ codeParam, nextParam }: CallbackClientProps) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const code = codeParam ?? getCodeFromClientUrl();
      const next = sanitizeNext(nextParam ?? getNextFromClientUrl());

      if (!code) {
        router.replace('/app/auth?error=oauth');
        return;
      }

      const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);

      if (cancelled) return;

      if (error) {
        console.error('OAuth exchange error:', error.message, error);
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
