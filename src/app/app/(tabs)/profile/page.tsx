'use client';

/**
 * 여정 경로(`/app/profile`): production `navV2` 에서 실제 UI는 AppShell 안의 `MyTab` → `JourneyTabViewV2`.
 * 여기 페이지는 레거시 `navV2=0` 분기 또는 직렬 마운트 테스트용 유지에 가깝다.
 */

import { useState, useEffect } from 'react';
import BottomNav from '@/app/app/_components/BottomNav';
import { JourneyTabViewV2 } from '@/app/app/_components/nav-v2/JourneyTabViewV2';
import { APP_TAB_BG } from '@/app/app/_components/nav-v2/appTabTheme';
import { getSessionSafe } from '@/lib/supabase';
import { getActiveSession } from '@/lib/session/client';

export default function ProfilePage() {
  const [navV2, setNavV2] = useState(true);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [totalSessions, setTotalSessions] = useState<number | null>(null);

  useEffect(() => {
    const run = async () => {
      let showNavV2 = true;
      try {
        if (process.env.NODE_ENV === 'production') {
          showNavV2 = true;
        } else {
          const v = new URLSearchParams(window.location.search).get('navV2');
          showNavV2 = v !== '0';
        }
      } catch {
        showNavV2 = true;
      }
      setNavV2(showNavV2);
      if (!showNavV2) return;

      try {
        const { session } = await getSessionSafe();
        if (!session?.access_token) return;
        const result = await getActiveSession(session.access_token);
        if (result.ok && result.data.progress) {
          const p = result.data.progress;
          setCompletedSessions(p.completed_sessions ?? 0);
          const t = p.total_sessions;
          setTotalSessions(typeof t === 'number' && Number.isFinite(t) && t > 0 ? Math.floor(t) : null);
        }
      } catch {
        /* noop */
      }
    };
    void run();
  }, []);

  if (navV2) {
    return (
      <div className="min-h-screen pb-20" style={{ backgroundColor: APP_TAB_BG }}>
        <main className="overflow-y-auto">
          <JourneyTabViewV2 completedSessions={completedSessions} totalSessions={totalSessions} />
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
