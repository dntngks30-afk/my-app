'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import {
  usePwaInstallGuideState,
  type PwaInstallGuideMode,
} from '@/lib/pwa/usePwaInstallGuideState';

const bodyFont = { fontFamily: 'var(--font-sans-noto)' } as const;

export type PwaInstallGuideCardProps = {
  className?: string;
};

export function PwaInstallGuideCard({ className }: PwaInstallGuideCardProps) {
  const guide = usePwaInstallGuideState();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalVariant, setModalVariant] = useState<
    'in_app_android' | 'in_app_ios' | 'android_manual' | 'ios_safari_detail'
  >('in_app_android');
  const [copied, setCopied] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);

  const closeModal = useCallback(() => setModalOpen(false), []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, closeModal]);

  useEffect(() => {
    if (modalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [modalOpen]);

  const copyPageUrl = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }, []);

  const openHowTo = useCallback((variant: typeof modalVariant) => {
    setModalVariant(variant);
    setModalOpen(true);
  }, []);

  const onSaveHomeAndroid = useCallback(async () => {
    if (promptBusy) return;
    setPromptBusy(true);
    try {
      await guide.promptInstall();
    } finally {
      setPromptBusy(false);
    }
  }, [guide, promptBusy]);

  if (!guide.hydrated) {
    return (
      <div
        className={`min-h-[4.5rem] w-full animate-pulse rounded-xl bg-[rgba(46,52,71,0.25)] backdrop-blur-sm ${className ?? ''}`}
        aria-hidden
      />
    );
  }

  const mode: PwaInstallGuideMode = guide.mode;

  if (mode === 'standalone') {
    return (
      <div
        className={`rounded-xl border border-amber-500/15 bg-[rgba(251,191,36,0.06)] px-4 py-3 text-center backdrop-blur-sm ${className ?? ''}`}
        style={bodyFont}
      >
        <p className="text-sm font-light leading-relaxed text-[#e7e5e4]">
          홈 화면에서 바로 이어갈 수 있어요.
        </p>
      </div>
    );
  }

  if (mode === 'in_app') {
    const isIos = guide.isIos;
    return (
      <>
        <div
          className={`rounded-xl border border-amber-500/20 bg-[rgba(251,191,36,0.07)] px-4 py-4 backdrop-blur-xl ${className ?? ''}`}
          style={bodyFont}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-amber-200/80">홈 화면에 저장하려면</p>
          <p className="mt-2 text-sm font-light leading-relaxed text-[#c6c6cd]">
            지금은 앱 안에서 열려 있어요.
            <br />
            {isIos ? 'Safari' : 'Chrome'}로 열면 저장할 수 있어요.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openHowTo(isIos ? 'in_app_ios' : 'in_app_android')}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-amber-500/35 bg-[rgba(171,76,0,0.25)] px-3 text-sm font-semibold text-[#ffb77d] transition hover:bg-[rgba(171,76,0,0.35)]"
            >
              방법 보기
            </button>
            <button
              type="button"
              onClick={() => void copyPageUrl()}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-[#dce1fb] transition hover:bg-white/10"
            >
              {copied ? '복사됐어요' : '링크 복사'}
            </button>
          </div>
        </div>

        {modalOpen && (modalVariant === 'in_app_android' || modalVariant === 'in_app_ios') && (
          <InAppHowToModal
            variant={modalVariant}
            onClose={closeModal}
            onCopy={copyPageUrl}
            copied={copied}
          />
        )}
      </>
    );
  }

  if (mode === 'android_chrome_prompt') {
    return (
      <>
        <div
          className={`rounded-xl border border-amber-500/20 bg-[rgba(251,191,36,0.07)] px-4 py-4 backdrop-blur-xl ${className ?? ''}`}
          style={bodyFont}
        >
          <p className="text-sm font-medium text-[#fde68a]">홈 화면에 저장하고 시작하세요</p>
          <p className="mt-1 text-sm font-light leading-relaxed text-[#c6c6cd]">
            저장하면 내 리셋맵으로
            <br />
            바로 돌아올 수 있어요.
          </p>
          <button
            type="button"
            disabled={promptBusy}
            onClick={() => void onSaveHomeAndroid()}
            className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-lg border border-amber-500/40 bg-gradient-to-br from-[#ffb77d]/90 to-[#ab4c00]/80 text-sm font-semibold text-[#4d2600] shadow-[0_12px_28px_rgba(0,0,0,0.2)] transition hover:brightness-110 disabled:opacity-60"
          >
            {promptBusy ? '준비 중…' : '홈 화면에 저장하기'}
          </button>
          <button
            type="button"
            onClick={() => openHowTo('android_manual')}
            className="mt-2 w-full text-center text-xs font-medium text-[#c6c6cd]/80 underline-offset-2 hover:text-[#ffb77d] hover:underline"
          >
            수동으로 추가하는 방법
          </button>
        </div>

        {modalOpen && modalVariant === 'android_manual' && (
          <AndroidManualModal onClose={closeModal} onCopy={copyPageUrl} copied={copied} />
        )}
      </>
    );
  }

  if (mode === 'android_chrome_manual') {
    return (
      <>
        <div
          className={`rounded-xl border border-amber-500/20 bg-[rgba(251,191,36,0.07)] px-4 py-4 backdrop-blur-xl ${className ?? ''}`}
          style={bodyFont}
        >
          <p className="text-sm font-medium text-[#fde68a]">홈 화면에 저장하고 시작하세요</p>
          <p className="mt-1 text-sm font-light leading-relaxed text-[#c6c6cd]">
            Chrome 메뉴(⋮)에서 &apos;홈 화면에 추가&apos;를 선택할 수 있어요.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openHowTo('android_manual')}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-amber-500/35 bg-[rgba(171,76,0,0.25)] px-3 text-sm font-semibold text-[#ffb77d] transition hover:bg-[rgba(171,76,0,0.35)]"
            >
              방법 보기
            </button>
            <button
              type="button"
              onClick={() => void copyPageUrl()}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-[#dce1fb]"
            >
              {copied ? '복사됐어요' : '링크 복사'}
            </button>
          </div>
        </div>
        {modalOpen && modalVariant === 'android_manual' && (
          <AndroidManualModal onClose={closeModal} onCopy={copyPageUrl} copied={copied} />
        )}
      </>
    );
  }

  if (mode === 'ios_safari') {
    return (
      <>
        <div
          className={`rounded-xl border border-amber-500/20 bg-[rgba(251,191,36,0.07)] px-4 py-4 backdrop-blur-xl ${className ?? ''}`}
          style={bodyFont}
        >
          <p className="text-sm font-medium text-[#fde68a]">iPhone 홈 화면에 저장하기</p>
          <p className="mt-1 text-sm font-light leading-relaxed text-[#c6c6cd]">
            공유 버튼에서
            <br />
            &apos;홈 화면에 추가&apos;를 선택하세요.
          </p>
          <button
            type="button"
            onClick={() => openHowTo('ios_safari_detail')}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-amber-500/35 bg-[rgba(171,76,0,0.25)] px-3 text-sm font-semibold text-[#ffb77d] transition hover:bg-[rgba(171,76,0,0.35)]"
          >
            방법 보기
          </button>
        </div>
        {modalOpen && modalVariant === 'ios_safari_detail' && <IosSafariStepsModal onClose={closeModal} />}
      </>
    );
  }

  return (
    <div
      className={`rounded-xl border border-amber-500/15 bg-[rgba(251,191,36,0.05)] px-4 py-3 text-center backdrop-blur-sm ${className ?? ''}`}
      style={bodyFont}
    >
      <p className="text-sm font-light leading-relaxed text-[#c6c6cd]">
        모바일 홈 화면에 저장하면
        <br />
        매일 더 쉽게 이어갈 수 있어요.
      </p>
    </div>
  );
}

function StepRow({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex gap-3 text-left">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/25 text-xs font-bold text-[#ffb77d]">
        {n}
      </span>
      <p className="text-sm font-light leading-relaxed text-[#e7e5e4]" style={bodyFont}>
        {children}
      </p>
    </div>
  );
}

function InAppHowToModal({
  variant,
  onClose,
  onCopy,
  copied,
}: {
  variant: 'in_app_android' | 'in_app_ios';
  onClose: () => void;
  onCopy: () => void | Promise<void>;
  copied: boolean;
}) {
  const android = variant === 'in_app_android';
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className="relative z-[101] flex max-h-[min(88svh,28rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(35,39,54,0.97)] shadow-2xl"
        style={bodyFont}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <h2 id="pwa-install-modal-title" className="text-lg font-semibold text-[#fde68a]">
            {android ? 'Chrome에서 열어주세요' : 'Safari에서 열어주세요'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#c6c6cd] hover:bg-white/10 hover:text-white"
            aria-label="모달 닫기"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {android ? (
            <>
              <StepRow n={1}>오른쪽 위 ⋯ 버튼</StepRow>
              <StepRow n={2}>브라우저에서 열기</StepRow>
              <StepRow n={3}>홈 화면에 추가</StepRow>
            </>
          ) : (
            <>
              <StepRow n={1}>공유 또는 더보기 버튼</StepRow>
              <StepRow n={2}>Safari에서 열기</StepRow>
              <StepRow n={3}>홈 화면에 추가</StepRow>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-white/5 bg-black/20 px-5 py-4">
          <button
            type="button"
            onClick={() => void onCopy()}
            className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] text-sm font-semibold text-[#4d2600] shadow-inner"
          >
            {copied ? '복사됐어요' : '링크 복사하기'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-white/10 py-2 text-sm font-medium text-[#dce1fb] hover:bg-white/5"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function AndroidManualModal({
  onClose,
  onCopy,
  copied,
}: {
  onClose: () => void;
  onCopy: () => void | Promise<void>;
  copied: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-android-manual-title"
    >
      <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label="닫기" onClick={onClose} />
      <div
        className="relative z-[101] flex max-h-[min(88svh,26rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(35,39,54,0.97)] shadow-2xl"
        style={bodyFont}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <h2 id="pwa-android-manual-title" className="text-lg font-semibold text-[#fde68a]">
            Chrome에서 저장하기
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#c6c6cd] hover:bg-white/10" aria-label="닫기">
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <StepRow n={1}>오른쪽 위 메뉴(⋮) 열기</StepRow>
          <StepRow n={2}>홈 화면에 추가 또는 설치 선택</StepRow>
          <StepRow n={3}>확인 후 홈 화면 아이콘으로 시작</StepRow>
        </div>
        <div className="flex flex-col gap-2 border-t border-white/5 bg-black/20 px-5 py-4">
          <button
            type="button"
            onClick={() => void onCopy()}
            className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] text-sm font-semibold text-[#4d2600]"
          >
            {copied ? '복사됐어요' : '링크 복사하기'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-white/10 py-2 text-sm font-medium text-[#dce1fb]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function IosSafariStepsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-ios-safari-title"
    >
      <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label="닫기" onClick={onClose} />
      <div
        className="relative z-[101] flex max-h-[min(88svh,26rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(35,39,54,0.97)] shadow-2xl"
        style={bodyFont}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <h2 id="pwa-ios-safari-title" className="text-lg font-semibold text-[#fde68a]">
            홈 화면에 저장하기
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#c6c6cd] hover:bg-white/10" aria-label="닫기">
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <StepRow n={1}>아래 공유 버튼</StepRow>
          <StepRow n={2}>홈 화면에 추가</StepRow>
          <StepRow n={3}>MOVE RE 아이콘으로 시작</StepRow>
        </div>
        <div className="border-t border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[48px] w-full items-center justify-center rounded-lg border border-white/10 text-sm font-medium text-[#dce1fb] hover:bg-white/5"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
