'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isAllowed, isAllowlistEmpty } from '@/lib/appAccess';

interface AppAuthGateProps {
  children: React.ReactNode;
}

export default function AppAuthGate({ children }: AppAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<'loading' | 'auth' | 'denied' | 'allowed'>('loading');

  const isAuthPage = pathname?.startsWith('/app/auth');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error || !session) {
          setStatus('auth');
          if (!isAuthPage) {
            const next = encodeURIComponent(pathname || '/app');
            router.replace(`/app/auth?next=${next}`);
          }
          return;
        }

        const email = session.user?.email ?? null;
        if (isAllowlistEmpty()) {
          setStatus('allowed');
          return;
        }
        if (!isAllowed(email)) {
          setStatus('denied');
          return;
        }
        setStatus('allowed');
      } catch {
        if (!cancelled) setStatus('auth');
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

  return <>{children}</>;
}
