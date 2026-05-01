'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSessionSafe } from '@/lib/supabase';
import {
  getExistingPushSubscription,
  isPwaStandalone,
  isPushSupported,
} from '@/lib/push/pushClient';

type TestPushResponse = {
  ok?: boolean;
  code?: string;
};

function messageForCode(code: string | undefined): string {
  if (code === 'NO_ACTIVE_SUBSCRIPTION') return '알림 연결을 먼저 완료해주세요';
  if (code === 'MISSING_WEB_PUSH_ENV') return '서버 알림 설정이 필요해요';
  if (code === 'UNAUTHORIZED') return '로그인이 필요해요';
  return '테스트 알림 전송에 실패했어요';
}

export function PwaPushTestCard({ className }: { className?: string }) {
  const [hydrated, setHydrated] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkVisibility = async () => {
      setHydrated(true);

      if (!isPushSupported() || !isPwaStandalone()) return;
      if (Notification.permission !== 'granted') return;

      const existing = await getExistingPushSubscription();
      if (!cancelled) setVisible(Boolean(existing));
    };

    void checkVisibility();

    return () => {
      cancelled = true;
    };
  }, []);

  const sendTestPush = useCallback(async () => {
    if (pending) return;

    setPending(true);
    setMessage(null);

    try {
      const { session } = await getSessionSafe();
      const token = session?.access_token;
      if (!token) {
        setMessage('로그인이 필요해요');
        return;
      }

      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as TestPushResponse;

      if (!res.ok || !data.ok) {
        setMessage(messageForCode(data.code));
        return;
      }

      setMessage('테스트 알림을 보냈어요');
    } catch {
      setMessage('테스트 알림 전송에 실패했어요');
    } finally {
      setPending(false);
    }
  }, [pending]);

  if (!hydrated || !visible) return null;

  return (
    <section
      className={`rounded-xl border border-sky-300/15 bg-white/[0.035] px-4 py-3 backdrop-blur-xl ${className ?? ''}`}
      style={{ fontFamily: 'var(--font-sans-noto)' }}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-sky-100/80">Debug push</p>
          {message && <p className="mt-1 text-xs text-[#c6c6cd]">{message}</p>}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={sendTestPush}
          className="min-h-[38px] shrink-0 rounded-lg border border-sky-300/25 bg-sky-300/10 px-3 text-xs font-semibold text-sky-100 transition hover:bg-sky-300/15 disabled:opacity-60"
        >
          {pending ? '전송 중' : '테스트 알림 보내기'}
        </button>
      </div>
    </section>
  );
}
