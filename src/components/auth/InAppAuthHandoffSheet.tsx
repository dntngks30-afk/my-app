'use client';

/**
 * PR-AUTH-HANDOFF-01 — iOS 인앱 등에서 외부 브라우저로 handoff 할 때 1회 CTA
 */

interface InAppAuthHandoffSheetProps {
  handoffUrl: string;
  onDismiss: () => void;
}

export function InAppAuthHandoffSheet({ handoffUrl, onDismiss }: InAppAuthHandoffSheetProps) {
  const openHandoff = () => {
    window.location.href = handoffUrl;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(handoffUrl);
    } catch {
      /* noop */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 px-4 pb-8 pt-12 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="in-app-handoff-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0c1324] p-6 shadow-xl">
        <h2
          id="in-app-handoff-title"
          className="text-lg font-semibold text-[#dce1fb]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          리셋 이어서 시작하기
        </h2>
        <p
          className="mt-3 text-sm leading-relaxed text-[#c6c6cd]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          방금 확인한 결과는 그대로 유지됩니다. 안전한 로그인 화면으로 이어집니다.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={openHandoff}
            className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] text-base font-semibold text-[#4d2600] shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            안전하게 이어서 시작하기
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className="text-sm text-[#dce1fb]/80 underline-offset-2 hover:text-[#dce1fb]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            링크 복사하기
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-sm text-[#9a9aa8] hover:text-[#c6c6cd]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
