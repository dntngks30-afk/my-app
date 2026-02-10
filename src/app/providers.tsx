'use client';

import { useEffect } from 'react';
import { supabaseBrowser as supabase } from '@/lib/supabase';
import { migrateLocalToServerOnLogin } from '@/features/movement-test/utils/supabaseSync';
import { Toaster } from 'sonner';

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 이미 로그인 상태면 즉시 1번 실행
    void migrateLocalToServerOnLogin();

    // 로그인/로그아웃 이벤트 구독
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void migrateLocalToServerOnLogin();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <>
      {process.env.NODE_ENV === 'development' && <Toaster />}
      {children}
    </>
  );
}
