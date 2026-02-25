'use client';

/**
 * PWA 설치 가이드 모달 (PR-B)
 * Android: promptInstall() 버튼, 실패 시 이미지 fallback
 * iOS: 공유→홈화면 안내 이미지
 * 인앱브라우저: Safari/Chrome에서 열기 안내 (강제 이동 없음)
 */

import { useEffect, useState } from 'react';
import { usePwaInstall } from '@/lib/pwa/usePwaInstall';

interface PwaInstallModalProps {
  open: boolean;
  onClose: () => void;
  context?: 'deepResult' | 'installPage';
}

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

  const showAndroidFallback = !isIOS && !isInAppBrowser && (promptFailed || !canPromptInstall);
  const showAndroidPrompt = !isIOS && !isInAppBrowser && canPromptInstall && !promptFailed;
  const showIOS = true; // 모든 기기에서 iOS 가이드 이미지 노출
  const showInApp = isInAppBrowser;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg max-h-[90vh] translate-x-[-50%] translate-y-[-50%] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            앱으로 설치하기
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--text)] text-xl leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {showInApp && (
          <section>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              카카오톡, 인스타그램 등 앱 안에서 열린 브라우저에서는 설치가
              제한됩니다. 주소를 복사한 뒤 Safari 또는 Chrome에서 열어
              설치해 주세요.
            </p>
          </section>
        )}

        {showIOS && (
          <section>
            <p className="text-sm text-[var(--muted)] mb-3">
              Safari에서 공유 버튼(□↑) → &quot;홈 화면에 추가&quot;를 선택하세요.
            </p>
            <img
              src="/pwa/guide/ios-share-sheet-ko.png"
              alt="iOS 홈 화면에 추가 방법"
              className="w-full rounded-lg border border-[var(--border)]"
            />
          </section>
        )}

        {showAndroidPrompt && (
          <section>
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={isPrompting}
              className="w-full rounded-lg bg-[var(--brand)] py-4 text-center text-base font-semibold text-white disabled:opacity-70"
            >
              {isPrompting ? '처리 중...' : '설치하기'}
            </button>
          </section>
        )}

        {showAndroidFallback && (
          <section className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              Chrome 주소창 오른쪽 메뉴(⋮)에서 설치를 진행하세요.
            </p>
            <img
              src="/pwa/guide/android-menu-install-ko.png"
              alt="Android 메뉴에서 설치"
              className="w-full rounded-lg border border-[var(--border)]"
            />
            <img
              src="/pwa/guide/android-install-dialog-ko.png"
              alt="Android 설치 대화상자"
              className="w-full rounded-lg border border-[var(--border)]"
            />
            <img
              src="/pwa/guide/android-add-home-screen-ko.png"
              alt="Android 홈 화면에 추가"
              className="w-full rounded-lg border border-[var(--border)]"
            />
          </section>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-[var(--border)] py-3 text-center text-sm font-medium"
        >
          닫기
        </button>
      </div>
    </>
  );
}
