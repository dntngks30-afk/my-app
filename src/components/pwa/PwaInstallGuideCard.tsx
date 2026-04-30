'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { usePwaInstallGuideState, type PwaInstallGuideMode } from '@/lib/pwa/usePwaInstallGuideState';

const DISMISS_KEY = 'move_re_pwa_install_card_dismissed_at';
const DISMISS_TTL_MS = 72 * 60 * 60 * 1000;

type GuideVariant = 'android' | 'ios_safari' | 'ios_in_app';

function getDismissedWithinTtl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function setDismissedNow() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // no-op
  }
}

export type PwaInstallGuideCardProps = {
  className?: string;
};

export function PwaInstallGuideCard({ className }: PwaInstallGuideCardProps) {
  const guide = usePwaInstallGuideState();
  const [dismissed, setDismissed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);
  const [guideVariant, setGuideVariant] = useState<GuideVariant>('android');

  const dismissedByTtl = useMemo(() => (guide.hydrated ? getDismissedWithinTtl() : false), [guide.hydrated]);

  const mode: PwaInstallGuideMode = guide.mode;
  if (!guide.hydrated) return null;
  if (mode === 'already_standalone') return null;
  if (dismissed || dismissedByTtl) return null;

  const onDismiss = () => {
    setDismissedNow();
    setDismissed(true);
  };

  const openGuide = (variant: GuideVariant) => {
    setGuideVariant(variant);
    setGuideOpen(true);
  };

  const handlePrimary = async () => {
    if (mode === 'android_install_prompt_available') {
      if (promptBusy) return;
      setPromptBusy(true);
      try {
        await guide.promptInstall();
      } finally {
        setPromptBusy(false);
      }
      return;
    }

    if (mode === 'ios_in_app_browser') {
      openGuide('ios_in_app');
      return;
    }

    if (mode === 'ios_safari') {
      openGuide('ios_safari');
      return;
    }

    openGuide('android');
  };

  const copy =
    mode === 'android_install_prompt_available'
      ? {
          title: 'MOVE RE를 앱처럼 설치하세요',
          body: '매번 테스트를 다시 열 필요 없이, 오늘의 리셋맵으로 바로 돌아올 수 있어요.',
          cta: '앱 설치하기',
        }
      : mode === 'android_install_prompt_unavailable'
        ? {
            title: '브라우저에서 MOVE RE를 설치할 수 있어요',
            body: 'Chrome 또는 Samsung Internet에서 열면 홈 화면에 앱처럼 추가할 수 있어요.',
            cta: '설치 방법 보기',
          }
        : mode === 'android_in_app_browser'
          ? {
              title: '외부 브라우저에서 설치해주세요',
              body: '현재 앱 안 브라우저에서는 설치가 제한될 수 있어요. Chrome 또는 Samsung Internet에서 열어 설치해주세요.',
              cta: '설치 방법 보기',
            }
          : mode === 'ios_safari'
            ? {
                title: 'iPhone 홈 화면에 MOVE RE 추가하기',
                body: '공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하면 앱처럼 바로 열 수 있어요.',
                cta: '설치 방법 보기',
              }
            : mode === 'ios_in_app_browser'
              ? {
                  title: 'Safari에서 열어 설치해주세요',
                  body: 'iPhone에서는 Safari에서 공유 버튼을 눌러 ‘홈 화면에 추가’해야 해요.',
                  cta: 'Safari 설치 방법 보기',
                }
              : {
                  title: 'MOVE RE를 바로가기처럼 저장하세요',
                  body: '브라우저 메뉴에서 홈 화면 또는 앱으로 설치를 선택할 수 있어요.',
                  cta: '설치 방법 보기',
                };

  return (
    <section className={`rounded-2xl border border-orange-300/25 bg-[rgba(10,20,34,0.88)] p-4 text-[#d7deec] shadow-[0_8px_24px_rgba(0,0,0,0.28)] ${className ?? ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#ffe5cc]">{copy.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#c4cfdf]">{copy.body}</p>
        </div>
        <button
          type="button"
          aria-label="설치 안내 닫기"
          onClick={onDismiss}
          className="rounded-md p-1 text-[#9fb1c9] hover:bg-white/10 hover:text-[#ffb37a]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        disabled={promptBusy}
        onClick={() => void handlePrimary()}
        className="mt-3 w-full rounded-lg border border-orange-300/35 bg-[rgba(171,76,0,0.28)] px-3 py-2.5 text-sm font-semibold text-[#ffbf8f] transition hover:bg-[rgba(171,76,0,0.4)] disabled:opacity-60"
      >
        {promptBusy ? '설치 창 여는 중…' : copy.cta}
      </button>

      {guideOpen && (
        <div className="mt-3 rounded-xl border border-orange-300/20 bg-[rgba(7,14,25,0.88)] p-3 text-xs leading-relaxed text-[#dbe6f6]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#ffcfaa]">설치 방법</p>
          {guideVariant === 'ios_safari' && (
            <ol className="list-decimal space-y-1 pl-4">
              <li>Safari 하단 또는 상단의 공유 버튼을 누르세요.</li>
              <li>‘홈 화면에 추가’를 선택하세요.</li>
              <li>추가 후 홈 화면의 MOVE RE 아이콘으로 다시 열어주세요.</li>
            </ol>
          )}
          {guideVariant === 'ios_in_app' && (
            <ol className="list-decimal space-y-1 pl-4">
              <li>우측 상단 메뉴에서 Safari로 열기를 선택하세요.</li>
              <li>Safari에서 공유 버튼을 누르세요.</li>
              <li>‘홈 화면에 추가’를 선택하세요.</li>
            </ol>
          )}
          {guideVariant === 'android' && (
            <ol className="list-decimal space-y-1 pl-4">
              <li>Chrome 또는 Samsung Internet에서 MOVE RE를 여세요.</li>
              <li>브라우저 메뉴 또는 설치 버튼을 누르세요.</li>
              <li>홈 화면에 추가 후 아이콘으로 다시 열어주세요.</li>
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
