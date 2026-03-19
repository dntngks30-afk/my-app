'use client';

/**
 * Stripe 결제 취소 페이지
 * Checkout 취소 시 리다이렉트 — next param으로 복귀
 */

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const ALLOWED_PREFIXES = [
  '/app',
  '/movement-test',
  '/onboarding-prep',
  '/payments',
];

function sanitizeNext(next: string | null): string {
  if (!next || typeof next !== 'string') return '/';
  const trimmed = next.trim();
  if (!trimmed.startsWith('/') || trimmed.includes('//')) return '/';
  const allowed = ALLOWED_PREFIXES.some((p) => trimmed === p || trimmed.startsWith(`${p}/`));
  return allowed ? trimmed : '/';
}

export default function StripeCancelPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get('next');
    const target = sanitizeNext(next);
    router.replace(target);
  }, [searchParams, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <p className="text-sm text-[var(--muted)]">결제가 취소되었습니다. 이동 중...</p>
    </main>
  );
}
