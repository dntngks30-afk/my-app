'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

/** SSOT: plan_status='active' (관리자 수동 부여 호환) */
function hasActivePlan(planStatus: string | null): boolean {
  return planStatus === 'active';
}

function isPostPaymentReturn(pathname: string | null): boolean {
  return pathname === '/payments/stripe-success' || pathname === '/payments/success';
}

interface PaymentsGateProps {
  children: React.ReactNode;
}

export default function PaymentsGate({ children }: PaymentsGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<'loading' | 'auth' | 'already-paid' | 'allowed'>('loading');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error || !session) {
          setStatus('auth');
          const next = encodeURIComponent(pathname || '/payments');
          router.replace(`/app/auth?next=${next}`);
          return;
        }

        if (isPostPaymentReturn(pathname)) {
          setStatus('allowed');
          return;
        }

        const { data: user, error: userError } = await supabase
          .from('users')
          .select('plan_status')
          .eq('id', session.user.id)
          .single();

        if (cancelled) return;

        if (userError || !user) {
          setStatus('allowed');
          return;
        }

        if (hasActivePlan(user.plan_status)) {
          setStatus('already-paid');
        } else {
          setStatus('allowed');
        }
      } catch {
        if (!cancelled) setStatus('auth');
        router.replace(`/app/auth?next=${encodeURIComponent(pathname || '/payments')}`);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [pathname, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <p className="text-sm text-[var(--muted)]">확인 중...</p>
      </div>
    );
  }

  if (status === 'auth') {
    return null;
  }

  if (status === 'already-paid') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--bg)] px-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">이미 이용 권한이 활성화되어 있어요</h2>
        <Link
          href="/app/home"
          className="rounded-lg bg-[var(--brand)] px-6 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
        >
          오늘 루틴으로
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
