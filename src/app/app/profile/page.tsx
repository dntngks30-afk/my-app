'use client';

import { useState, useEffect } from 'react';
import BottomNav from '../_components/BottomNav';
import { ProfileViewV2 } from '../_components/nav-v2/ProfileViewV2';
import { getSessionSafe } from '@/lib/supabase';
import { getActiveSession } from '@/lib/session/client';

export default function ProfilePage() {
  const [navV2, setNavV2] = useState(true);
  const [completedSessions, setCompletedSessions] = useState(0);

  useEffect(() => {
    try {
      if (process.env.NODE_ENV === 'production') {
        setNavV2(true);
        return;
      }
      const v = new URLSearchParams(window.location.search).get('navV2');
      setNavV2(v !== '0');
      if (v === '0') return;
      (async () => {
        try {
          const { session } = await getSessionSafe();
          if (!session?.access_token) return;
          const result = await getActiveSession(session.access_token);
          if (result.ok && result.data.progress) {
            setCompletedSessions(result.data.progress.completed_sessions ?? 0);
          }
        } catch { /* noop */ }
      })();
    } catch { /* noop */ }
  }, []);

  if (navV2) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <header className="px-4 pt-6 pb-4 border-b border-slate-100">
          <h1 className="text-2xl font-bold text-slate-800">마이</h1>
          <p className="mt-1 text-sm text-slate-500">프로필 및 설정</p>
        </header>
        <main>
          <ProfileViewV2 completed={completedSessions} />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      <header className="px-4 pt-6">
        <h1 className="text-2xl font-bold text-slate-800">마이</h1>
        <p className="mt-1 text-sm text-stone-500">
          설정 및 프로필
        </p>
      </header>
      <BottomNav />
    </div>
  );
}
