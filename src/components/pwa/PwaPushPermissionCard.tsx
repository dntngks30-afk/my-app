'use client';

import { useMemo } from 'react';
import { usePwaPushPermissionState } from '@/lib/pwa/usePwaPushPermissionState';

export function PwaPushPermissionCard({ className }: { className?: string }) {
  const { hydrated, state, requestAndSubscribe, dismissForNow } = usePwaPushPermissionState();

  const hidden = useMemo(
    () =>
      !hydrated ||
      state === 'unsupported' ||
      state === 'not_standalone' ||
      state === 'permission_granted_subscribed',
    [hydrated, state]
  );

  if (hidden) return null;

  let title = '오늘 루틴 알림을 켜둘까요?';
  let body = 'MOVE RE는 짧게라도 자주 이어갈 때 효과가 좋아요. 알림을 켜두면 오늘의 리셋 시간을 놓치지 않게 도와드릴게요.';
  let cta = '알림 켜기';
  let onClick = () => void requestAndSubscribe();

  if (state === 'permission_granted_no_subscription') {
    title = '알림 연결을 마무리할게요';
    body = '권한은 허용되어 있어요. 이 기기에서 MOVE RE 알림을 받을 수 있게 연결해둘게요.';
    cta = '알림 연결하기';
  } else if (state === 'permission_denied') {
    title = '알림이 차단되어 있어요';
    body = '기기 또는 브라우저 설정에서 MOVE RE 알림을 다시 허용할 수 있어요.';
    cta = '설정 안내 보기';
    onClick = () => {
      if (typeof window !== 'undefined') {
        window.alert('브라우저/기기 설정에서 알림 권한을 허용해 주세요.');
      }
    };
  } else if (state === 'subscribe_error') {
    title = '알림 연결에 실패했어요';
    body = '네트워크 상태를 확인한 뒤 다시 시도해주세요.';
    cta = '다시 시도';
  } else if (state === 'subscribe_pending') {
    cta = '연결 중…';
  }

  return (
    <section
      className={`rounded-xl border border-amber-500/20 bg-[rgba(251,191,36,0.07)] px-4 py-4 backdrop-blur-xl ${className ?? ''}`}
      style={{ fontFamily: 'var(--font-sans-noto)' }}
    >
      <p className="text-sm font-medium text-[#fde68a]">{title}</p>
      <p className="mt-1 text-sm font-light leading-relaxed text-[#c6c6cd]">{body}</p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={state === 'subscribe_pending'}
          onClick={onClick}
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-amber-500/35 bg-[rgba(171,76,0,0.25)] px-3 text-sm font-semibold text-[#ffb77d] transition hover:bg-[rgba(171,76,0,0.35)] disabled:opacity-60"
        >
          {cta}
        </button>
        <button
          type="button"
          onClick={dismissForNow}
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-[#dce1fb] transition hover:bg-white/10"
        >
          나중에
        </button>
      </div>
    </section>
  );
}
