'use client';

/**
 * 전역 헤더 컴포넌트
 *
 * PostureLab 로고 + 로그인/회원가입 버튼
 * 로그인/회원가입 → /app/auth (OAuth) 재사용, next로 복귀
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  const authNext = encodeURIComponent(pathname || '/');
  const authHref = `/app/auth?next=${authNext}`;

  useEffect(() => {
    // 로그인 상태 확인
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || undefined });
      }
    };
    checkUser();

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || undefined });
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <nav className="relative z-20 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4 shadow-sm">
      <Link href="/" className="text-xl font-bold text-[var(--text)]">
        PostureLab
      </Link>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="text-sm text-[var(--muted)]">{user.email}</span>
            <Link
              href="/my-report"
              className="text-sm text-[var(--text)] hover:text-[var(--brand)] transition-colors"
            >
              내 리포트
            </Link>
          </>
        ) : (
          <>
            <Link
              href={authHref}
              className="text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            >
              로그인
            </Link>
            <Link
              href={authHref}
              className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[#ea580c] transition-colors"
            >
              회원가입
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
