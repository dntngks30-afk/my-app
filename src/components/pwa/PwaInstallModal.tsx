'use client';

/**
 * PWA 설치 가이드 모달 (PR-B + PR-PATCH)
 * 모든 환경에서 4장 가이드 이미지 공통 노출. 환경별로 상단 안내/설치 버튼만 분기.
 */

import { useEffect, useState } from 'react';
import { usePwaInstall } from '@/lib/pwa/usePwaInstall';

interface PwaInstallModalProps {
  open: boolean;
  onClose: () => void;
  context?: 'deepResult' | 'installPage';
}

const GUIDE_IMAGES = [
  {
    src: '/pwa/guide/ios-share-sheet-ko.png',
    alt: 'iOS Safari 공유 → 홈 화면에 추가',
    caption: 'iOS Safari: 공유 버튼(□↑) → "홈 화면에 추가" 선택',
  },
  {
    src: '/pwa/guide/android-menu-install-ko.png',
    alt: 'Android Chrome 메뉴에서 설치',
    caption: 'Android Chrome: 주소창 메뉴(⋮) → 설치 항목 찾기',
  },
  {
    src: '/pwa/guide/android-install-dialog-ko.png',
    alt: 'Android 설치 확인 다이얼로그',
    caption: 'Android: 설치 확인 다이얼로그에서 "설치" 선택',
  },
  {
    src: '/pwa/guide/android-add-home-screen-ko.png',
    alt: 'Android 홈 화면에 추가 완료',
    caption: 'Android: 홈 화면에 추가 완료 화면',
  },
] as const;

export default function PwaInstallModal({
  open,
  onClose,
}: PwaInstallModalProps) {
  const {
    canPromptInstall,
    isIOS,
    isInAppBrowser,
    promptInstall,
  } = usePwaInstall();
  const [promptFailed, setPromptFailed] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setPromptFailed(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleInstallClick = async () => {
    if (isInAppBrowser) return;
    if (isIOS) return;
    if (canPromptInstall && !promptFailed) {
      setIsPrompting(true);
      const outcome = await promptInstall();
      setIsPrompting(false);
      if (outcome === 'accepted') {
        onClose();
      } else if (outcome === 'unavailable' || outcome === 'dismissed') {
        setPromptFailed(true);
      }
    }
  };

  const showAndroidPrompt = !isIOS && !isInAppBrowser && canPromptInstall && !promptFailed;
  const showInApp = isInAppBrowser;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg max-h-[90vh] translate-x-[-50%] translate-y-[-50%] flex flex-col rounded-2xl border-2 border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
        <div className="flex justify-between items-start p-4 sm:p-6 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">
            앱으로 설치하기
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-500 hover:text-slate-800 text-xl leading-none font-bold"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-4">
          {showInApp && (
            <section className="mb-4">
              <p className="text-sm text-stone-600 leading-relaxed">
                카카오톡, 인스타그램 등 앱 안에서 열린 브라우저에서는 설치가
                제한됩니다. Safari 또는 Chrome에서 주소를 열어 설치해 주세요.
              </p>
            </section>
          )}

          {showAndroidPrompt && (
            <section className="mb-4">
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isPrompting}
                className="w-full rounded-full border-2 border-slate-900 bg-slate-800 py-4 text-center text-base font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)] disabled:opacity-70"
              >
                {isPrompting ? '처리 중...' : '설치하기'}
              </button>
            </section>
          )}

          <section>
            <h3 className="text-sm font-bold text-slate-800 mb-3">
              설치 가이드 이미지 (공통)
            </h3>
            <div className="space-y-5">
              {GUIDE_IMAGES.map((item) => (
                <div key={item.src} className="space-y-2">
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="w-full max-w-md mx-auto rounded-lg border-2 border-slate-900 object-contain"
                    style={{ height: 'auto' }}
                  />
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {item.caption}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-full border-2 border-slate-900 bg-white py-3 text-center text-sm font-bold text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
          >
            닫기
          </button>
        </div>
      </div>
    </>
  );
}
