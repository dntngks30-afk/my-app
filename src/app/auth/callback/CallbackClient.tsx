'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { replaceRouteAfterAuthSession } from '@/lib/readiness/navigateAfterAuth';

type OAuthProvider = 'google' | 'kakao';

function sanitizeProvider(provider: string | null | undefined): OAuthProvider | null {
  return provider === 'google' || provider === 'kakao' ? provider : null;
}

function buildAuthErrorPath(provider: OAuthProvider | null): string {
  const params = new URLSearchParams();
  params.set('error', 'oauth');
  if (provider) params.set('provider', provider);
  return `/app/auth?${params.toString()}`;
}

interface CallbackClientProps {
  codeParam?: string | null;
  nextParam?: string | null;
  providerParam?: string | null;
}

function sanitizeNext(next: string | null | undefined): string {
  if (!next || typeof next !== 'string') return '/app/home';
  const trimmed = next.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/app/home';
  return trimmed;
}

export default function CallbackClient({
  codeParam,
  nextParam,
  providerParam,
}: CallbackClientProps) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const code = codeParam ?? null;
      const next = sanitizeNext(nextParam);
      const provider = sanitizeProvider(providerParam);

      console.info('[AUTH-OAUTH]', {
        event: 'oauth_callback_start',
        provider,
        hasCode: Boolean(code),
        currentOrigin: typeof window !== 'undefined' ? window.location.origin : null,
        sanitizedNext: next,
      });

      if (!code) {
        console.warn('[AUTH-OAUTH]', {
          event: 'oauth_callback_missing_code',
          provider,
          hasCode: false,
        });
        router.replace(buildAuthErrorPath(provider));
        return;
      }

      const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);

      if (cancelled) return;

      if (error) {
        const status =
          error && typeof error === 'object' && 'status' in error
            ? (error as { status?: number }).status
            : undefined;
        console.error('[AUTH-OAUTH]', {
          event: 'oauth_exchange_failed',
          provider,
          message: error.message,
          name: error.name,
          status,
        });
        router.replace(buildAuthErrorPath(provider));
        return;
      }

      console.info('[AUTH-OAUTH]', {
        event: 'oauth_exchange_success',
        provider,
      });

      await replaceRouteAfterAuthSession(router, next);
    }

    run();
    return () => { cancelled = true; };
  }, [codeParam, nextParam, providerParam, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <p className="text-sm text-[var(--muted)]">처리 중...</p>
    </div>
  );
}
