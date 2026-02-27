'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { isAllowed, isAllowlistEmpty } from '@/lib/appAccess';

interface AppAuthGateProps {
  children: React.ReactNode;
}

function hasActivePlan(planStatus: string | null): boolean {
  return planStatus === 'active';
}

/** 탭 전환 시 동일 세션이면 재검증 스킵(users DB 조회 생략) */
export default function AppAuthGate({ children }: AppAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<'loading' | 'auth' | 'denied' | 'paywall' | 'allowed'>('loading');
  const lastAllowedUserIdRef = useRef<string | null>(null);

  const isAuthPage = pathname?.startsWith('/app/auth');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error || !session) {
          lastAllowedUserIdRef.current = null;
          setStatus('auth');
          if (!isAuthPage) {
            const next = encodeURIComponent(pathname || '/app/home');
            router.replace(`/app/auth?next=${next}`);
          }
          return;
        }

        const userId = session.user.id;
        if (lastAllowedUserIdRef.current === userId && status === 'allowed') {
          return;
        }

        const email = session.user?.email ?? null;
        if (!isAllowlistEmpty() && !isAllowed(email)) {
          lastAllowedUserIdRef.current = null;
          setStatus('denied');
          return;
        }

        const { data: user, error: userError } = await supabase
          .from('users')
          .select('plan_status')
          .eq('id', userId)
          .single();

        if (cancelled) return;

        if (userError || !user) {
          lastAllowedUserIdRef.current = null;
          setStatus('paywall');
          return;
        }

        if (hasActivePlan(user.plan_status)) {
          lastAllowedUserIdRef.current = userId;
          setStatus('allowed');
        } else {
          lastAllowedUserIdRef.current = null;
          setStatus('paywall');
        }
      } catch {
        if (!cancelled) {
          lastAllowedUserIdRef.current = null;
          setStatus('auth');
        }
      }
    }

    check();
    return () => { cancelled = true; };
  }, [pathname, isAuthPage, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <p className="text-sm text-[var(--muted)]">확인 중...</p>
      </div>
    );
  }

  if (status === 'auth' && isAuthPage) {
    return <>{children}</>;
  }

  if (status === 'auth') {
    return null;
  }

  if (status === 'denied') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] px-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">앱 접근 권한이 없습니다</h2>
        <p className="max-w-sm text-center text-sm text-[var(--muted)]">
          현재 베타 테스트용으로 허용된 계정만 접근할 수 있습니다. 관리자에게 문의해 주세요.
        </p>
      </div>
    );
  }

  if (status === 'paywall') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--bg)] px-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">유료 권한이 필요해요</h2>
        <p className="max-w-sm text-center text-sm text-[var(--muted)]">
          7일 루틴 이용 권한이 활성화되어야 앱을 사용할 수 있어요.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Link
            href="/deep-analysis?pay=1"
            className="rounded-lg bg-[var(--brand)] px-6 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
          >
            7일 심층 분석 시작하기
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-center text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            요금제 보기
          </Link>
          <button
            type="button"
            onClick={() => supabase.auth.signOut().then(() => router.replace('/app/auth'))}
            className="text-sm text-[var(--muted)] hover:text-[var(--text)] py-2"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
